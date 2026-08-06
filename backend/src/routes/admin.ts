import { Router, Response } from 'express';
import { query } from '../db';
import { authenticateToken, requireRole, AuthenticatedRequest } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

router.use(authenticateToken);
router.use(requireRole(['admin']));

// GET /api/admin/users
router.get('/users', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT id, email, role, name, phone, age, gender, is_verified, created_at 
       FROM users 
       ORDER BY created_at DESC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to retrieve users' });
  }
});

// DELETE /api/admin/users/:id
router.delete('/users/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query('DELETE FROM users WHERE id = $1 RETURNING id, name', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    // Log action
    await query(
      "INSERT INTO system_logs (action, details, user_id) VALUES ($1, $2, $3)",
      ['DELETE_USER', `Deleted user ${result.rows[0].name} (${req.params.id})`, req.user?.id]
    );

    res.json({ message: 'User deleted successfully', user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// GET /api/admin/doctors/pending
router.get('/doctors/pending', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT u.id, u.name, u.email, dp.specialty, dp.license_number, dp.clinic_address, dp.consultation_fee, dp.is_verified
       FROM users u
       JOIN doctor_profiles dp ON u.id = dp.user_id
       WHERE dp.is_verified = false`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending doctors' });
  }
});

// POST /api/admin/doctors/verify/:id
router.post('/doctors/verify/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const doctorId = req.params.id;

    // Begin Transaction
    await query('BEGIN');
    
    const dpUpdate = await query(
      'UPDATE doctor_profiles SET is_verified = true WHERE user_id = $1 RETURNING user_id',
      [doctorId]
    );

    if (dpUpdate.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    await query(
      'UPDATE users SET is_verified = true WHERE id = $1',
      [doctorId]
    );

    await query('COMMIT');

    // Log action
    await query(
      "INSERT INTO system_logs (action, details, user_id) VALUES ($1, $2, $3)",
      ['VERIFY_DOCTOR', `Verified doctor license for user ID: ${doctorId}`, req.user?.id]
    );

    res.json({ message: 'Doctor verified successfully' });
  } catch (error) {
    await query('ROLLBACK');
    console.error('Verify doctor error:', error);
    res.status(500).json({ error: 'Failed to verify doctor' });
  }
});

// GET /api/admin/logs
router.get('/logs', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await query(
      `SELECT l.*, u.name as admin_name 
       FROM system_logs l
       LEFT JOIN users u ON l.user_id = u.id
       ORDER BY l.created_at DESC LIMIT 100`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// GET /api/admin/analytics
router.get('/analytics', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const usersCount = await query("SELECT COUNT(*), role FROM users GROUP BY role");
    const apptsCount = await query("SELECT COUNT(*), status FROM appointments GROUP BY status");
    const consultsRisk = await query("SELECT COUNT(*), risk_level FROM consultations GROUP BY risk_level");

    res.json({
      users: usersCount.rows,
      appointments: apptsCount.rows,
      consultationsRisk: consultsRisk.rows
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to compile analytics' });
  }
});

export default router;
