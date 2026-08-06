import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

const statusUpdateSchema = z.object({
  status: z.enum(['accepted', 'completed', 'cancelled'])
});

const prescriptionSchema = z.object({
  consultationId: z.string().uuid().optional(),
  patientId: z.string().uuid(),
  medicineData: z.array(z.object({
    name: z.string().min(1),
    dosage: z.string().min(1),
    frequency: z.string().min(1),
    instruction: z.string().optional()
  })),
  notes: z.string().optional()
});

const messageSchema = z.object({
  receiverId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  content: z.string().min(1),
  audioUrl: z.string().optional()
});

router.use(authenticateToken);
router.use(requireRole(['doctor']));

// GET /api/doctor/appointments
router.get('/appointments', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT a.*, u.name as patient_name, u.age as patient_age, u.gender as patient_gender 
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE a.doctor_id = $1
       ORDER BY a.appointment_date ASC`,
      [req.user?.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve appointments' });
  }
});

// PUT /api/doctor/appointments/:id
router.put('/appointments/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { status } = statusUpdateSchema.parse(req.body);
    const result = await query(
      'UPDATE appointments SET status = $1 WHERE id = $2 AND doctor_id = $3 RETURNING *',
      [status, req.params.id, req.user?.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Appointment not found' });
    res.json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: 'Failed to update appointment status' });
  }
});

// GET /api/doctor/patient-history/:patientId
router.get('/patient-history/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { patientId } = req.params;

    // Fetch user details
    const userRes = await query(
      'SELECT id, email, name, phone, age, gender, height, weight, pregnancy_status FROM users WHERE id = $1',
      [patientId]
    );
    if (userRes.rows.length === 0) return res.status(404).json({ error: 'Patient not found' });

    // Fetch chronic illnesses & allergies
    const recordsRes = await query(
      'SELECT * FROM health_records WHERE patient_id = $1 ORDER BY date_recorded DESC',
      [patientId]
    );

    // Fetch past consultations
    const consultationsRes = await query(
      'SELECT * FROM consultations WHERE patient_id = $1 ORDER BY created_at DESC',
      [patientId]
    );

    // Fetch past prescriptions
    const prescriptionsRes = await query(
      `SELECT p.*, u.name as doctor_name FROM prescriptions p 
       JOIN users u ON p.doctor_id = u.id 
       WHERE p.patient_id = $1 ORDER BY p.date_issued DESC`,
      [patientId]
    );

    res.json({
      profile: userRes.rows[0],
      records: recordsRes.rows,
      consultations: consultationsRes.rows,
      prescriptions: prescriptionsRes.rows
    });
  } catch (error) {
    console.error('Fetch patient history error:', error);
    res.status(500).json({ error: 'Failed to retrieve patient medical history' });
  }
});

// POST /api/doctor/prescriptions
router.post('/prescriptions', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = prescriptionSchema.parse(req.body);
    const doctorId = req.user?.id;

    // Generate mock PDF URL
    const pdfUrl = `/prescriptions/pdf_${Date.now()}.pdf`;

    const result = await query(
      `INSERT INTO prescriptions (consultation_id, patient_id, doctor_id, medicine_data, notes, pdf_url)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [
        data.consultationId || null,
        data.patientId,
        doctorId,
        JSON.stringify(data.medicineData),
        data.notes || '',
        pdfUrl
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error: any) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Prescription create error:', error);
    res.status(500).json({ error: 'Failed to create digital prescription' });
  }
});

// CHAT MESSAGES WITH PATIENTS
// GET /api/doctor/messages/:patientId
router.get('/messages/:patientId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = req.user?.id;
    const patientId = req.params.patientId;

    const result = await query(
      `SELECT * FROM messages 
       WHERE (sender_id = $1 AND receiver_id = $2) 
          OR (sender_id = $2 AND receiver_id = $1)
       ORDER BY created_at ASC`,
      [doctorId, patientId]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

// POST /api/doctor/messages
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

// GET /api/doctor/messages/:appointmentId — fetch message history
router.get('/messages/:appointmentId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { appointmentId } = req.params;
    const doctorId = req.user?.id;

    // Verify doctor owns this appointment
    const appts = await query(
      `SELECT * FROM appointments WHERE id = $1 AND doctor_id = $2`,
      [appointmentId, doctorId]
    );
    if (!appts || appts.rows.length === 0) {
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
    res.json(messages?.rows || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

// GET /api/doctor/appointments/active — active time-window appointments for doctor
router.get('/appointments/active', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = req.user?.id;
    const now = new Date().toISOString();

    const appts = await query(
      `SELECT a.*, u.name as patient_name, u.email as patient_email
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       WHERE a.doctor_id = $1
         AND a.status = 'accepted'
         AND a.appointment_date <= $2
         AND a.appointment_date >= $3`,
      [doctorId, now, new Date(Date.now() - 60 * 60 * 1000).toISOString()]
    );
    res.json(appts?.rows || []);
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch active appointments' });
  }
});

export default router;
