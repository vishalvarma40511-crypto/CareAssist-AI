import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import dns from 'dns';

// Force Node.js to prioritize IPv4 over IPv6 when resolving hosts (fixes ENETUNREACH on Render/Supabase)
dns.setDefaultResultOrder('ipv4first');
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import jwt from 'jsonwebtoken';
import { query } from './db';

// Import routes
import authRoutes from './routes/auth';
import aiRoutes from './routes/ai';
import patientRoutes from './routes/patient';
import doctorRoutes from './routes/doctor';
import adminRoutes from './routes/admin';

dotenv.config();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-careassist-key-12345';

// Security Middleware
app.use(helmet({
  crossOriginResourcePolicy: false,
}));

app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Rate Limiter: 150 requests per 15 minutes
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 150,
  message: { error: 'Too many requests from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/patient', patientRoutes);
app.use('/api/doctor', doctorRoutes);
app.use('/api/admin', adminRoutes);

// Root welcome endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    service: 'CareAssist AI Backend API',
    version: '1.0.0',
    message: '🏥 CareAssist AI is running. Use /health to check status or /api/* for endpoints.',
    endpoints: {
      health: '/health',
      auth: '/api/auth',
      ai: '/api/ai',
      patient: '/api/patient',
      doctor: '/api/doctor'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'CareAssist AI backend is running smoothly' });
});

// 404 Route handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Global Error Handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ error: err.message || 'Internal server error occurred' });
});

// ─────────────────────────────────────────────────────────
//  Socket.IO — Real-Time Consultation Chat
// ─────────────────────────────────────────────────────────
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Helper: Check if current time is within the booked 1-hour slot
function isWithinConsultationSlot(appointmentDate: string): boolean {
  const start = new Date(appointmentDate);
  const end = new Date(start.getTime() + 60 * 60 * 1000); // +1 hour
  const now = new Date();
  return now >= start && now <= end;
}

// Socket.IO Middleware: Authenticate JWT on connection
io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    const decoded = jwt.verify(token as string, JWT_SECRET) as any;
    socket.data.user = decoded;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const user = socket.data.user;
  console.log(`[Socket] Connected: ${user?.name} (${user?.role})`);

  // Join a consultation room
  socket.on('join_consultation', async ({ appointmentId }: { appointmentId: string }) => {
    try {
      // Verify this user belongs to this appointment
      const appts = await query(
        `SELECT * FROM appointments WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2) AND status = 'accepted'`,
        [appointmentId, user.id]
      );
      if (!appts || appts.rows.length === 0) {
        socket.emit('error', { message: 'Appointment not found or not accepted' });
        return;
      }
      const appt = appts.rows[0];

      if (!isWithinConsultationSlot(appt.appointment_date)) {
        socket.emit('error', { message: 'Consultation session is not active at this time' });
        return;
      }

      const room = `consultation_${appointmentId}`;
      socket.join(room);
      socket.data.appointmentId = appointmentId;
      socket.data.appointmentDate = appt.appointment_date;

      console.log(`[Socket] ${user.name} joined room ${room}`);
      socket.emit('joined', { room, appointmentId });

      // Send message history
      const messages = await query(
        `SELECT m.*, u.name as sender_name, u.role as sender_role
         FROM messages m
         JOIN users u ON m.sender_id = u.id
         WHERE m.appointment_id = $1
         ORDER BY m.created_at ASC LIMIT 100`,
        [appointmentId]
      );
      socket.emit('message_history', messages || []);
    } catch (err) {
      console.error('[Socket] join_consultation error:', err);
      socket.emit('error', { message: 'Failed to join consultation' });
    }
  });

  // Send a chat message
  socket.on('send_message', async ({ appointmentId, content }: { appointmentId: string; content: string }) => {
    try {
      if (!content?.trim()) return;

      // Re-validate time slot on every message
      const appts = await query(
        `SELECT * FROM appointments WHERE id = $1 AND (patient_id = $2 OR doctor_id = $2) AND status = 'accepted'`,
        [appointmentId, user.id]
      );
      if (!appts || appts.rows.length === 0) {
        socket.emit('error', { message: 'Appointment not found' });
        return;
      }

      if (!isWithinConsultationSlot(appts.rows[0].appointment_date)) {
        socket.emit('error', { message: 'Consultation time window has ended' });
        return;
      }

      // Determine receiver
      const appt = appts.rows[0];
      const receiverId = user.id === appt.patient_id ? appt.doctor_id : appt.patient_id;

      // Save to DB
      const saved = await query(
        `INSERT INTO messages (sender_id, receiver_id, appointment_id, content, created_at)
         VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
        [user.id, receiverId, appointmentId, content.trim()]
      );

      const message = {
        ...(saved?.rows?.[0] || {}),
        sender_name: user.name,
        sender_role: user.role,
        content: content.trim(),
        created_at: new Date().toISOString()
      };

      // Broadcast to all in the room (both doctor and patient)
      io.to(`consultation_${appointmentId}`).emit('new_message', message);
    } catch (err) {
      console.error('[Socket] send_message error:', err);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Disconnected: ${user?.name}`);
  });
});

// Start Server using httpServer (not app.listen) so Socket.IO works
httpServer.listen(PORT, () => {
  console.log(`CareAssist AI Server is listening on http://localhost:${PORT}`);
  console.log(`Socket.IO real-time consultation enabled`);
});
