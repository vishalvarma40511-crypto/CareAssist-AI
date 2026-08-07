import { Pool } from 'pg';
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;
// If connection string is missing or doesn't start with postgres/postgresql, we fallback to SQLite
export let isPostgres = !!(connectionString?.startsWith('postgres://') || connectionString?.startsWith('postgresql://'));

let pgPool: Pool | null = null;
let sqliteDb: sqlite3.Database | null = null;

function initializeSqlite() {
  if (sqliteDb) return;
  
  const dbPath = path.resolve(__dirname, '../database.sqlite');
  const dbExists = fs.existsSync(dbPath);
  
  console.log(`Using local SQLite database at: ${dbPath}`);
  sqliteDb = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('Failed to connect to SQLite database:', err);
    } else {
      console.log('SQLite database connected successfully');
      // Enable foreign key support
      sqliteDb?.run('PRAGMA foreign_keys = ON;', (pragmaErr) => {
        if (pragmaErr) {
          console.error('Failed to enable foreign keys in SQLite:', pragmaErr);
        }
      });
      
      // Auto-initialize schema if DB is newly created
      if (!dbExists) {
        initSqliteSchema();
      }
    }
  });
}

if (isPostgres) {
  pgPool = new Pool({
    connectionString,
    ssl: connectionString?.includes('supabase') || connectionString?.includes('render.com') || connectionString?.includes('dpg-')
      ? { rejectUnauthorized: false }
      : undefined,
  });

  pgPool.on('connect', () => {
    console.log('PostgreSQL database connected successfully');
  });

  pgPool.on('error', (err) => {
    console.error('Unexpected error on idle client', err);
  });
} else {
  initializeSqlite();
}

function initSqliteSchema() {
  console.log('Initializing SQLite database schema...');
  if (!sqliteDb) return;

  const schema = [
    // Users table
    `CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
      name TEXT NOT NULL,
      phone TEXT,
      age INTEGER,
      gender TEXT,
      height REAL,
      weight REAL,
      pregnancy_status BOOLEAN DEFAULT 0,
      blood_group TEXT,
      allergies TEXT,
      medical_history TEXT,
      emergency_contacts TEXT,
      is_verified BOOLEAN DEFAULT 0,
      otp_code TEXT,
      otp_expires_at TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Doctor profiles
    `CREATE TABLE IF NOT EXISTS doctor_profiles (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      specialty TEXT NOT NULL,
      license_number TEXT UNIQUE NOT NULL,
      bio TEXT,
      clinic_address TEXT,
      consultation_fee REAL DEFAULT 0.0,
      is_verified BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Appointments
    `CREATE TABLE IF NOT EXISTS appointments (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      appointment_date TEXT NOT NULL,
      status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
      type TEXT DEFAULT 'chat' CHECK (type IN ('video', 'voice', 'chat')),
      reason TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Consultations
    `CREATE TABLE IF NOT EXISTS consultations (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      symptom_summary TEXT NOT NULL,
      risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'emergency')),
      confidence_score INTEGER DEFAULT 0,
      health_summary TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Prescriptions
    `CREATE TABLE IF NOT EXISTS prescriptions (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      consultation_id TEXT REFERENCES consultations(id) ON DELETE SET NULL,
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      doctor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date_issued DATETIME DEFAULT CURRENT_TIMESTAMP,
      medicine_data TEXT NOT NULL,
      notes TEXT,
      pdf_url TEXT
    )`,

    // Medication Reminders
    `CREATE TABLE IF NOT EXISTS reminders (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      medicine_name TEXT NOT NULL,
      dosage TEXT,
      morning BOOLEAN DEFAULT 0,
      afternoon BOOLEAN DEFAULT 0,
      evening BOOLEAN DEFAULT 0,
      night BOOLEAN DEFAULT 0,
      active BOOLEAN DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Adherence Logs
    `CREATE TABLE IF NOT EXISTS adherence_logs (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      reminder_id TEXT NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      taken BOOLEAN NOT NULL DEFAULT 0,
      taken_at TEXT,
      UNIQUE(reminder_id, date)
    )`,

    // Health Records
    `CREATE TABLE IF NOT EXISTS health_records (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type TEXT NOT NULL CHECK (type IN ('allergy', 'chronic_disease', 'lab_report', 'vaccination', 'note')),
      title TEXT NOT NULL,
      description TEXT,
      attachments TEXT DEFAULT '[]',
      date_recorded DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Messages
    `CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      appointment_id TEXT REFERENCES appointments(id) ON DELETE CASCADE,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      content TEXT,
      audio_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // System Logs
    `CREATE TABLE IF NOT EXISTS system_logs (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      action TEXT NOT NULL,
      details TEXT,
      ip_address TEXT,
      user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    // Indexes
    `CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)`,
    `CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_appointments_doctor ON appointments(doctor_id)`,
    `CREATE INDEX IF NOT EXISTS idx_consultations_patient ON consultations(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_prescriptions_patient ON prescriptions(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_reminders_patient ON reminders(patient_id)`,
    `CREATE INDEX IF NOT EXISTS idx_adherence_logs_date ON adherence_logs(date)`,
    `CREATE INDEX IF NOT EXISTS idx_messages_appointment ON messages(appointment_id)`,
    `CREATE INDEX IF NOT EXISTS idx_system_logs_action ON system_logs(action)`,

    // Default Seed Data
    `INSERT OR IGNORE INTO users (id, email, password_hash, role, name, is_verified) VALUES
      ('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'admin', 'System Admin', 1),
      ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'doctor1@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'doctor', 'Dr. Sarah Connor', 1),
      ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'doctor2@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'doctor', 'Dr. John Watson', 1)`,

    // Daily Wellness Logs
    `CREATE TABLE IF NOT EXISTS daily_wellness (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date TEXT NOT NULL,
      sleep_hours REAL,
      mood TEXT,
      stress_level TEXT,
      water_intake REAL,
      exercise_mins INTEGER,
      weight REAL,
      energy_level INTEGER,
      pain_level INTEGER,
      temperature REAL,
      blood_pressure TEXT,
      sugar_level REAL,
      health_score INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(patient_id, date)
    )`,

    // Diet Plans
    `CREATE TABLE IF NOT EXISTS diet_plans (
      id TEXT PRIMARY KEY DEFAULT (
        lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' || substr(lower(hex(randomblob(2))),2) || '-' || substr(lower(hex(randomblob(2))),1,1) || substr(lower(hex(randomblob(2))),2,3) || '-' || lower(hex(randomblob(6)))
      ),
      patient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      breakfast TEXT,
      lunch TEXT,
      dinner TEXT,
      snacks TEXT,
      calories REAL,
      protein REAL,
      carbs REAL,
      fat REAL,
      water_intake REAL,
      goals TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,

    `INSERT OR IGNORE INTO doctor_profiles (user_id, specialty, license_number, bio, clinic_address, consultation_fee, is_verified) VALUES
      ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Cardiology', 'MD-992384-US', 'Experienced cardiologist specializing in heart diseases and preventative health care.', '102 Heart Health Ave, Boston, MA', 150.00, 1),
      ('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'General Medicine', 'MD-118839-US', 'Family physician providing consultation for acute and chronic conditions.', '221B Baker St, London, UK', 75.00, 1)`
  ];

  sqliteDb!.serialize(() => {
    // Run alters to perform simple SQLite migrations for existing users table
    sqliteDb!.run("ALTER TABLE users ADD COLUMN blood_group TEXT", () => {});
    sqliteDb!.run("ALTER TABLE users ADD COLUMN allergies TEXT", () => {});
    sqliteDb!.run("ALTER TABLE users ADD COLUMN medical_history TEXT", () => {});
    sqliteDb!.run("ALTER TABLE users ADD COLUMN emergency_contacts TEXT", () => {});
    for (const stmt of schema) {
      sqliteDb!.run(stmt, (err) => {
        if (err) {
          console.error(`Error executing schema statement: ${stmt.substring(0, 50)}...`, err);
        }
      });
    }
    console.log('SQLite database schema initialization complete.');
  });
}

const parseSqliteRow = (row: any) => {
  if (!row) return row;
  const parsed = { ...row };
  
  // Parse JSON columns
  if (typeof parsed.medicine_data === 'string') {
    try {
      parsed.medicine_data = JSON.parse(parsed.medicine_data);
    } catch (e) {}
  }
  if (typeof parsed.attachments === 'string') {
    try {
      parsed.attachments = JSON.parse(parsed.attachments);
    } catch (e) {}
  }

  // Parse booleans (SQLite stores them as 0/1)
  const booleanFields = [
    'pregnancy_status', 'is_verified', 'active', 'taken', 
    'morning', 'afternoon', 'evening', 'night'
  ];
  for (const field of booleanFields) {
    if (field in parsed && parsed[field] !== null) {
      parsed[field] = Boolean(parsed[field]);
    }
  }
  return parsed;
};

export const query = async (text: string, params: any[] = []): Promise<{ rows: any[] }> => {
  const start = Date.now();
  
  if (isPostgres) {
    if (!pgPool) throw new Error('Postgres pool not initialized');
    try {
      const res = await pgPool.query(text, params);
      return res;
    } catch (error: any) {
      console.error(`Database Query Error (PG): ${error.message} \nQuery: ${text}`);
      
      // Connection or authentication failures
      const isConnectionError = error.code === 'ENETUNREACH' || 
                                error.code === 'ECONNREFUSED' || 
                                error.code === 'ETIMEDOUT' || 
                                error.message.includes('password authentication failed') ||
                                error.message.includes('getaddrinfo');
      
      if (isConnectionError) {
        console.warn('⚠️ WARNING: PostgreSQL connection failed. Falling back to local SQLite database!');
        isPostgres = false;
        initializeSqlite();
        return query(text, params);
      }
      throw error;
    }
  } else {
    if (!sqliteDb) throw new Error('SQLite database not initialized');
    
    return new Promise((resolve, reject) => {
      // 1. SQLite syntax normalization:
      // Replace $1, $2, etc with ?
      let sqliteSql = text.replace(/\$\d+/g, '?');
      
      // Replace Postgres NOW() function with SQLite datetime('now')
      sqliteSql = sqliteSql.replace(/\bNOW\(\)/gi, "datetime('now')");
      
      // Execute the query using db.all to return rows
      sqliteDb!.all(sqliteSql, params, (err, rows) => {
        if (err) {
          console.error(`Database Query Error (SQLite): ${err.message} \nQuery: ${sqliteSql}`);
          reject(err);
        } else {
          const parsedRows = (rows || []).map(parseSqliteRow);
          resolve({ rows: parsedRows });
        }
      });
    });
  }
};
