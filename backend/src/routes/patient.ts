import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Zod validation schemas
const healthRecordSchema = z.object({
  type: z.enum(['allergy', 'chronic_disease', 'lab_report', 'vaccination', 'note']),
  title: z.string().min(2),
  description: z.string().optional(),
  attachments: z.array(z.string()).optional()
});

const reminderSchema = z.object({
  medicineName: z.string().min(2),
  dosage: z.string().optional(),
  morning: z.boolean().default(false),
  afternoon: z.boolean().default(false),
  evening: z.boolean().default(false),
  night: z.boolean().default(false)
});

const adherenceSchema = z.object({
  reminderId: z.string().uuid(),
  date: z.string(), // YYYY-MM-DD
  taken: z.boolean()
});

const appointmentSchema = z.object({
  doctorId: z.string().uuid(),
  appointmentDate: z.string(), // ISO String
  type: z.enum(['video', 'voice', 'chat']),
  reason: z.string().optional()
});

const messageSchema = z.object({
  receiverId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  content: z.string().min(1),
  audioUrl: z.string().optional()
});

// Use authentication and lock to 'patient' role
router.use(authenticateToken);
router.use(requireRole(['patient']));

// GET /api/patient/dashboard
router.get('/dashboard', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.id;

    // 1. Fetch upcoming appointments
    const appointments = await query(
      `SELECT a.*, u.name as doctor_name, dp.specialty 
       FROM appointments a
       JOIN users u ON a.doctor_id = u.id
       JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE a.patient_id = $1 AND a.appointment_date >= NOW() AND a.status != 'cancelled'
       ORDER BY a.appointment_date ASC LIMIT 5`,
      [patientId]
    );

    // 2. Fetch medication reminders
    const reminders = await query(
      `SELECT * FROM reminders WHERE patient_id = $1 AND active = true`,
      [patientId]
    );

    // 3. Fetch adherence log for today
    const today = new Date().toISOString().split('T')[0];
    const logs = await query(
      `SELECT al.* FROM adherence_logs al
       JOIN reminders r ON al.reminder_id = r.id
       WHERE r.patient_id = $1 AND al.date = $2`,
      [patientId, today]
    );

    // 4. Fetch recent consultations
    const consultations = await query(
      `SELECT * FROM consultations WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5`,
      [patientId]
    );

    // 5. Fetch prescriptions
    const prescriptions = await query(
      `SELECT p.*, u.name as doctor_name 
       FROM prescriptions p
       JOIN users u ON p.doctor_id = u.id
       WHERE p.patient_id = $1 ORDER BY p.date_issued DESC LIMIT 5`,
      [patientId]
    );

    // Calculate a dynamic health score based on adherence rates and risk reports
    // Defaults to 80, drops based on high risk consultations or poor medication adherence
    let healthScore = 85;
    const pastLogs = await query(
      `SELECT taken FROM adherence_logs al 
       JOIN reminders r ON al.reminder_id = r.id 
       WHERE r.patient_id = $1`, 
      [patientId]
    );
    if (pastLogs.rows.length > 0) {
      const takenCount = pastLogs.rows.filter(l => l.taken).length;
      const adherenceRate = (takenCount / pastLogs.rows.length) * 100;
      healthScore = Math.round(50 + (adherenceRate * 0.5));
    }

    res.json({
      healthScore,
      appointments: appointments.rows,
      reminders: reminders.rows,
      adherenceToday: logs.rows,
      recentConsultations: consultations.rows,
      prescriptions: prescriptions.rows
    });
  } catch (error) {
    console.error('Patient dashboard fetch error:', error);
    res.status(500).json({ error: 'Failed to retrieve dashboard metadata' });
  }
});

// HEALTH RECORDS
// GET /api/patient/records
router.get('/records', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      'SELECT * FROM health_records WHERE patient_id = $1 ORDER BY date_recorded DESC',
      [req.user?.id]
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Fetch health records error:', error);
    res.status(500).json({ error: 'Failed to fetch health records' });
  }
});

// POST /api/patient/records
router.post('/records', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = healthRecordSchema.parse(req.body);
    const result = await query(
      `INSERT INTO health_records (patient_id, type, title, description, attachments) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [req.user?.id, data.type, data.title, data.description || '', JSON.stringify(data.attachments || [])]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Add health record error:', error);
    res.status(500).json({ error: 'Failed to add health record' });
  }
});

// REMINDERS & ADHERENCE
// GET /api/patient/reminders
router.get('/reminders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query('SELECT * FROM reminders WHERE patient_id = $1 ORDER BY created_at DESC', [req.user?.id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reminders' });
  }
});

// POST /api/patient/reminders
router.post('/reminders', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = reminderSchema.parse(req.body);
    const result = await query(
      `INSERT INTO reminders (patient_id, medicine_name, dosage, morning, afternoon, evening, night)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.user?.id, data.medicineName, data.dosage || '', data.morning, data.afternoon, data.evening, data.night]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to create reminder' });
  }
});

// PUT /api/patient/reminders/:id
router.put('/reminders/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { active } = req.body;
    const result = await query(
      'UPDATE reminders SET active = $1 WHERE id = $2 AND patient_id = $3 RETURNING *',
      [active, req.params.id, req.user?.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update reminder' });
  }
});

// DELETE /api/patient/reminders/:id
router.delete('/reminders/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query('DELETE FROM reminders WHERE id = $1 AND patient_id = $2 RETURNING *', [req.params.id, req.user?.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Reminder not found' });
    res.json({ message: 'Reminder deleted' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete reminder' });
  }
});

// POST /api/patient/adherence
router.post('/adherence', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { reminderId, date, taken } = adherenceSchema.parse(req.body);
    
    // Verify reminder belongs to patient
    const check = await query('SELECT id FROM reminders WHERE id = $1 AND patient_id = $2', [reminderId, req.user?.id]);
    if (check.rows.length === 0) return res.status(403).json({ error: 'Invalid reminder ID' });

    const result = await query(
      `INSERT INTO adherence_logs (reminder_id, date, taken, taken_at)
       VALUES ($1, $2, $3, CASE WHEN $3 = true THEN NOW() ELSE NULL END)
       ON CONFLICT (reminder_id, date) 
       DO UPDATE SET taken = EXCLUDED.taken, taken_at = EXCLUDED.taken_at
       RETURNING *`,
      [reminderId, date, taken]
    );
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Adherence logging error:', error);
    res.status(500).json({ error: 'Failed to log adherence status' });
  }
});

// DOCTORS & APPOINTMENTS
// GET /api/patient/doctors
router.get('/doctors', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, u.phone, dp.specialty, dp.license_number, dp.bio, dp.clinic_address, dp.consultation_fee
       FROM users u
       JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE u.role = 'doctor' AND dp.is_verified = true`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch verified doctors list' });
  }
});

// POST /api/patient/appointments
router.post('/appointments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { doctorId, appointmentDate, type, reason } = appointmentSchema.parse(req.body);
    const result = await query(
      `INSERT INTO appointments (patient_id, doctor_id, appointment_date, type, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending') RETURNING *`,
      [req.user?.id, doctorId, appointmentDate, type, reason || '']
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to book appointment' });
  }
});

// GET /api/patient/prescriptions
router.get('/prescriptions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT p.*, u.name as doctor_name, dp.specialty
       FROM prescriptions p
       JOIN users u ON p.doctor_id = u.id
       JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE p.patient_id = $1 ORDER BY p.date_issued DESC`,
      [req.user?.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch prescriptions' });
  }
});

// CHAT MESSAGES WITH DOCTORS
// GET /api/patient/messages/:doctorId
router.get('/messages/:doctorId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.id;
    const doctorId = req.params.doctorId;

    const result = await query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [patientId, doctorId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// POST /api/patient/messages
router.post('/messages', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { receiverId, appointmentId, content, audioUrl } = messageSchema.parse(req.body);
    const senderId = req.user?.id;

    const result = await query(
      `INSERT INTO messages (sender_id, receiver_id, appointment_id, content, audio_url)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [senderId, receiverId, appointmentId || null, content, audioUrl || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// GET /api/patient/messages/:appointmentId — fetch message history for a consultation
router.get('/messages/:appointmentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const patientId = req.user?.id;

    // Verify patient owns this appointment
    const appts = await query(
      `SELECT * FROM appointments WHERE id = $1 AND patient_id = $2`,
      [appointmentId, patientId]
    );
    if (!appts || appts.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const messages = await query(
      `SELECT m.*, u.name as sender_name, u.role as sender_role
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.appointment_id = $1
       ORDER BY m.created_at ASC LIMIT 200`,
      [appointmentId]
    );
    res.json(messages || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/patient/appointments/active — get accepted appointments within current time window
router.get('/appointments/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const patientId = req.user?.id;
    const now = new Date().toISOString();

    const appts = await query(
      `SELECT a.*, u.name as doctor_name, dp.specialty
       FROM appointments a
       JOIN users u ON a.doctor_id = u.id
       JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE a.patient_id = $1
         AND a.status = 'accepted'
         AND a.appointment_date <= $2
         AND a.appointment_date >= $3`,
      [patientId, now, new Date(Date.now() - 60 * 60 * 1000).toISOString()]
    );
    res.json(appts || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch active appointments' });
  }
});

export default router;
