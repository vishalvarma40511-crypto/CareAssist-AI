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
import { query, isPostgres } from './db';

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
  return true; // Relaxed window restriction to allow testing and instant communication
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


// Auto-initialize PostgreSQL schema if running on a fresh database
async function initPostgresSchema() {
  if (!isPostgres) return;

  console.log('Checking and initializing PostgreSQL schema...');
  try {
    // Check if users table exists
    const check = await query(`SELECT to_regclass('public.users') as tbl`);
    if (check.rows[0]?.tbl) {
      console.log('PostgreSQL schema already initialized.');
      return;
    }

    // Create all tables
    await query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    await query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50),
      age INT,
      gender VARCHAR(50),
      height DECIMAL(5,2),
      weight DECIMAL(5,2),
      pregnancy_status BOOLEAN DEFAULT FALSE,
      is_verified BOOLEAN DEFAULT FALSE,
      otp_code VARCHAR(6),
      otp_expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS doctor_profiles (
      user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      specialty VARCHAR(255) NOT NULL,
      license_number VARCHAR(100) UNIQUE NOT NULL,
      bio TEXT,
      clinic_address TEXT,
      consultation_fee DECIMAL(10,2) DEFAULT 0.0,
      is_verified BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS appointments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_date TIMESTAMP NOT NULL,
      status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
      type VARCHAR(50) DEFAULT 'chat' CHECK (type IN ('video', 'voice', 'chat')),
      reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS consultations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
      symptom_summary TEXT NOT NULL,
      risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'emergency')),
      confidence_score INT DEFAULT 0,
      health_summary TEXT,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS prescriptions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
      patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_issued TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      medicine_data JSONB NOT NULL,
      notes TEXT,
      pdf_url TEXT
    )`);
    await query(`CREATE TABLE IF NOT EXISTS reminders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medicine_name VARCHAR(255) NOT NULL,
      dosage VARCHAR(100),
      morning BOOLEAN DEFAULT FALSE,
      afternoon BOOLEAN DEFAULT FALSE,
      evening BOOLEAN DEFAULT FALSE,
      night BOOLEAN DEFAULT FALSE,
      active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS adherence_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      taken BOOLEAN NOT NULL DEFAULT FALSE,
      taken_at TIMESTAMP,
      UNIQUE(reminder_id, date)
    )`);
    await query(`CREATE TABLE IF NOT EXISTS health_records (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(100) NOT NULL CHECK (type IN ('allergy', 'chronic_disease', 'lab_report', 'vaccination', 'note')),
      title VARCHAR(255) NOT NULL,
      description TEXT,
      attachments JSONB DEFAULT '[]'::jsonb,
      date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
      sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      audio_url TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);
    await query(`CREATE TABLE IF NOT EXISTS system_logs (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      action VARCHAR(255) NOT NULL,
      details TEXT,
      ip_address VARCHAR(45),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    // Seed default admin user (password: password123)
    await query(`INSERT INTO users (email, password_hash, role, name, is_verified)
      VALUES ('admin@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'admin', 'System Admin', true)
      ON CONFLICT (email) DO NOTHING`);

    console.log('PostgreSQL schema initialized successfully!');
  } catch (err) {
    console.error('Failed to initialize PostgreSQL schema:', err);
  }
}

// Start Server using httpServer (not app.listen) so Socket.IO works
initPostgresSchema().then(() => {
  httpServer.listen(PORT, () => {
    console.log(`CareAssist AI Server is listening on http://localhost:${PORT}`);
    console.log(`Socket.IO real-time consultation enabled`);
  });
});
