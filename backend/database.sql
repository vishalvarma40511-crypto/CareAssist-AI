-- CareAssist AI PostgreSQL Database Schema

-- Enable UUID extension if available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop tables if they exist
DROP TABLE IF EXISTS system_logs CASCADE;
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS health_records CASCADE;
DROP TABLE IF EXISTS adherence_logs CASCADE;
DROP TABLE IF EXISTS reminders CASCADE;
DROP TABLE IF EXISTS prescriptions CASCADE;
DROP TABLE IF EXISTS consultations CASCADE;
DROP TABLE IF EXISTS appointments CASCADE;
DROP TABLE IF EXISTS doctor_profiles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Users Table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    age INT,
    gender VARCHAR(50),
    height DECIMAL(5,2), -- in cm
    weight DECIMAL(5,2), -- in kg
    pregnancy_status BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    otp_code VARCHAR(6),
    otp_expires_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Doctor Profiles Table
CREATE TABLE doctor_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    specialty VARCHAR(255) NOT NULL,
    license_number VARCHAR(100) UNIQUE NOT NULL,
    bio TEXT,
    clinic_address TEXT,
    consultation_fee DECIMAL(10,2) DEFAULT 0.0,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Appointments Table
CREATE TABLE appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    appointment_date TIMESTAMP NOT NULL,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'completed', 'cancelled')),
    type VARCHAR(50) DEFAULT 'chat' CHECK (type IN ('video', 'voice', 'chat')),
    reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Consultations Table
CREATE TABLE consultations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    symptom_summary TEXT NOT NULL,
    risk_level VARCHAR(50) NOT NULL CHECK (risk_level IN ('low', 'moderate', 'high', 'emergency')),
    confidence_score INT DEFAULT 0,
    health_summary TEXT,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Prescriptions Table
CREATE TABLE prescriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    consultation_id UUID REFERENCES consultations(id) ON DELETE SET NULL,
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    doctor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date_issued TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    medicine_data JSONB NOT NULL, -- Array of {name, dosage, frequency, instruction}
    notes TEXT,
    pdf_url TEXT
);

-- Medication Reminders Table
CREATE TABLE reminders (
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
);

-- Adherence Logs Table
CREATE TABLE adherence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reminder_id UUID NOT NULL REFERENCES reminders(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    taken BOOLEAN NOT NULL DEFAULT FALSE,
    taken_at TIMESTAMP,
    UNIQUE(reminder_id, date)
);

-- Health Records Table
CREATE TABLE health_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    patient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(100) NOT NULL CHECK (type IN ('allergy', 'chronic_disease', 'lab_report', 'vaccination', 'note')),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    attachments JSONB DEFAULT '[]'::jsonb, -- Array of URLs/filenames
    date_recorded TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages Table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    appointment_id UUID REFERENCES appointments(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    audio_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- System Logs Table
CREATE TABLE system_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action VARCHAR(255) NOT NULL,
    details TEXT,
    ip_address VARCHAR(45),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance and quick searches
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_appointments_patient ON appointments(patient_id);
CREATE INDEX idx_appointments_doctor ON appointments(doctor_id);
CREATE INDEX idx_consultations_patient ON consultations(patient_id);
CREATE INDEX idx_prescriptions_patient ON prescriptions(patient_id);
CREATE INDEX idx_reminders_patient ON reminders(patient_id);
CREATE INDEX idx_adherence_logs_date ON adherence_logs(date);
CREATE INDEX idx_messages_appointment ON messages(appointment_id);
CREATE INDEX idx_system_logs_action ON system_logs(action);

-- Insert dummy admin and doctors for easy local testing
-- Passwords are hashed for "password123" ($2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e)
INSERT INTO users (id, email, password_hash, role, name, is_verified) VALUES
('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11', 'admin@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'admin', 'System Admin', true),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'doctor1@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'doctor', 'Dr. Sarah Connor', true),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'doctor2@careassist.ai', '$2a$10$95XvNClKjK.Y7e6x2fB6z.kFf8Nq7tQZ4dlyX31/Z3Kk9g.p3722e', 'doctor', 'Dr. John Watson', true);

INSERT INTO doctor_profiles (user_id, specialty, license_number, bio, clinic_address, consultation_fee, is_verified) VALUES
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12', 'Cardiology', 'MD-992384-US', 'Experienced cardiologist specializing in heart diseases and preventative health care.', '102 Heart Health Ave, Boston, MA', 150.00, true),
('d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13', 'General Medicine', 'MD-118839-US', 'Family physician providing consultation for acute and chronic conditions.', '221B Baker St, London, UK', 75.00, true);
