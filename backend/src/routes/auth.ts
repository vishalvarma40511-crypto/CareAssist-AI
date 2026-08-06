import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { query } from '../db';
import { z } from 'zod';
import { authenticateToken, AuthenticatedRequest } from '../middleware/auth';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-careassist-key-12345';

// Zod schemas for input validation
const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['patient', 'doctor']),
  name: z.string().min(2),
  phone: z.string().optional(),
  age: z.number().int().positive().optional(),
  gender: z.string().optional(),
  height: z.number().positive().optional(),
  weight: z.number().positive().optional(),
  specialty: z.string().optional(), // for doctor
  licenseNumber: z.string().optional(), // for doctor
  bio: z.string().optional(), // for doctor
  clinicAddress: z.string().optional(), // for doctor
  consultationFee: z.number().nonnegative().optional(), // for doctor
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// Helper for OTP generation
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = registerSchema.parse(req.body);
    
    // Check if user already exists
    const existing = await query('SELECT id FROM users WHERE email = $1', [data.email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(data.password, salt);

    // Insert user (Auto-verified on registration, no OTP required)
    const userRes = await query(
      `INSERT INTO users (email, password_hash, role, name, phone, age, gender, height, weight, otp_code, otp_expires_at, is_verified) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id, email, role, name`,
      [
        data.email, 
        passwordHash, 
        data.role, 
        data.name, 
        data.phone || null, 
        data.age || null, 
        data.gender || null, 
        data.height || null, 
        data.weight || null,
        null,
        null,
        true
      ]
    );

    const userId = userRes.rows[0].id;

    // If doctor, insert doctor profile
    if (data.role === 'doctor') {
      if (!data.specialty || !data.licenseNumber) {
        return res.status(400).json({ error: 'Specialty and License Number are required for doctors' });
      }
      await query(
        `INSERT INTO doctor_profiles (user_id, specialty, license_number, bio, clinic_address, consultation_fee, is_verified)
         VALUES ($1, $2, $3, $4, $5, $6, true)`, // Set doctor profile as verified too
        [
          userId,
          data.specialty,
          data.licenseNumber,
          data.bio || '',
          data.clinicAddress || '',
          data.consultationFee || 0.0
        ]
      );
    }

    res.status(201).json({
      message: 'Registration successful! You can now log in.',
      userId,
      email: data.email
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error', details: error?.message || String(error) });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const userRes = await query('SELECT * FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = userRes.rows[0];

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    // If user is doctor, fetch verification state
    let doctorProfile = null;
    if (user.role === 'doctor') {
      const docRes = await query('SELECT * FROM doctor_profiles WHERE user_id = $1', [user.id]);
      if (docRes.rows.length > 0) {
        doctorProfile = docRes.rows[0];
      }
    }

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name,
        isVerified: user.is_verified,
        age: user.age,
        gender: user.gender,
        height: user.height,
        weight: user.weight,
        pregnancyStatus: user.pregnancy_status,
        doctorProfile
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error', details: error?.message || String(error) });
  }
});

// POST /api/auth/verify-otp
router.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP code are required' });
    }

    const userRes = await query(
      'SELECT id, otp_code, otp_expires_at FROM users WHERE email = $1',
      [email]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];

    if (user.otp_code !== otp) {
      return res.status(400).json({ error: 'Invalid OTP code' });
    }

    if (new Date() > new Date(user.otp_expires_at)) {
      return res.status(400).json({ error: 'OTP code expired' });
    }

    // Set user as verified
    await query(
      'UPDATE users SET is_verified = true, otp_code = NULL, otp_expires_at = NULL WHERE id = $1',
      [user.id]
    );

    res.json({ message: 'Account verified successfully!' });
  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const otp = generateOTP();
    const otpExpires = new Date(Date.now() + 10 * 60 * 1000);

    await query(
      'UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE email = $3',
      [otp, otpExpires, email]
    );

    console.log(`[CareAssist Forgot Password OTP] OTP for ${email} is ${otp}`);

    res.json({
      message: 'Verification code sent to email',
      otpDebug: otp
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userRes = await query(
      'SELECT id, email, role, name, phone, age, gender, height, weight, pregnancy_status, is_verified, created_at FROM users WHERE id = $1',
      [authReq.user?.id]
    );

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    let doctorProfile = null;

    if (user.role === 'doctor') {
      const docRes = await query('SELECT * FROM doctor_profiles WHERE user_id = $1', [user.id]);
      if (docRes.rows.length > 0) {
        doctorProfile = docRes.rows[0];
      }
    }

    res.json({
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
      age: user.age,
      gender: user.gender,
      height: user.height,
      weight: user.weight,
      pregnancyStatus: user.pregnancy_status,
      isVerified: user.is_verified,
      createdAt: user.created_at,
      doctorProfile
    });
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
