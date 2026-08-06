import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartPulse, Mail, Lock, User, Phone, Clipboard, DollarSign, Compass, AlertCircle } from 'lucide-react';
import TiltCard from '../components/TiltCard';

const Register: React.FC = () => {
  const { apiBase } = useAuth();
  const navigate = useNavigate();

  // Basic Form States
  const [role, setRole] = useState<'patient' | 'doctor'>('patient');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // Patient Profile States
  const [age, setAge] = useState('');
  const [gender, setGender] = useState('Male');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');

  // Doctor Profile States
  const [specialty, setSpecialty] = useState('General Medicine');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [bio, setBio] = useState('');
  const [clinicAddress, setClinicAddress] = useState('');
  const [consultationFee, setConsultationFee] = useState('');

  // General State
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const payload: any = {
      email,
      password,
      role,
      name,
      phone: phone || undefined,
    };

    if (role === 'patient') {
      payload.age = age ? parseInt(age) : undefined;
      payload.gender = gender;
      payload.height = height ? parseFloat(height) : undefined;
      payload.weight = weight ? parseFloat(weight) : undefined;
    } else {
      payload.specialty = specialty;
      payload.licenseNumber = licenseNumber;
      payload.bio = bio;
      payload.clinicAddress = clinicAddress;
      payload.consultationFee = consultationFee ? parseFloat(consultationFee) : 0;
    }

    try {
      const res = await fetch(`${apiBase}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ? (typeof data.error === 'string' ? data.error : JSON.stringify(data.error)) : 'Registration failed');
      }

      alert('Registration successful! You can now log in.');
      navigate('/login');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[90vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <TiltCard className="w-full max-w-lg">
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        
        {/* Decorative background blur */}
        <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-brand-500/10 blur-xl"></div>
        <div className="absolute -bottom-12 -left-12 h-24 w-24 rounded-full bg-blue-500/15 blur-xl"></div>

        <div className="text-center mb-8">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
            <HeartPulse className="h-8 w-8 animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-primary">
            Create an Account
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Join the CareAssist health ecosystem
          </p>

          {/* Role selector buttons */}
          <div className="mt-6 flex rounded-full bg-slate-100 p-1 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setRole('patient')}
              className={`flex-1 rounded-full py-2.5 text-xs font-bold transition ${
                role === 'patient' 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Sign Up as Patient
            </button>
            <button
              type="button"
              onClick={() => setRole('doctor')}
              className={`flex-1 rounded-full py-2.5 text-xs font-bold transition ${
                role === 'doctor' 
                  ? 'bg-brand-600 text-white shadow-md' 
                  : 'text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700'
              }`}
            >
              Sign Up as Doctor
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Full Name
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="John Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Phone Number
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Phone className="h-4 w-4" />
                </span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="+91 9876543210"
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Email Address
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Password
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Lock className="h-4 w-4" />
                </span>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </div>

          {/* Dynamic Patient Fields */}
          {role === 'patient' && (
            <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-4 animate-slide-in">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Demographic Profile</h3>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Age
                  </label>
                  <input
                    type="number"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                    placeholder="25"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Gender
                  </label>
                  <select
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div className="grid gap-4 grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Height (cm)
                  </label>
                  <input
                    type="number"
                    value={height}
                    onChange={(e) => setHeight(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                    placeholder="175"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                    placeholder="70"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Dynamic Doctor Fields */}
          {role === 'doctor' && (
            <div className="border-t border-slate-100 dark:border-slate-850 pt-4 space-y-4 animate-slide-in">
              <h3 className="text-xs font-extrabold uppercase tracking-widest text-slate-400">Clinical Licensure</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Medical Specialty
                  </label>
                  <select
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="block w-full rounded-xl border border-slate-200 bg-white/50 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  >
                    <option value="General Medicine">General Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Dermatology">Dermatology</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    License Number (MD-xxxxxx)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Clipboard className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      required
                      value={licenseNumber}
                      onChange={(e) => setLicenseNumber(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                      placeholder="MD-839281"
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Clinic Address
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <Compass className="h-4 w-4" />
                    </span>
                    <input
                      type="text"
                      value={clinicAddress}
                      onChange={(e) => setClinicAddress(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                      placeholder="101 Wellness St, Delhi"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Consultation Fee ($ / ₹)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                      <DollarSign className="h-4 w-4" />
                    </span>
                    <input
                      type="number"
                      value={consultationFee}
                      onChange={(e) => setConsultationFee(e.target.value)}
                      className="block w-full rounded-xl border border-slate-200 bg-white/50 pl-10 pr-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                      placeholder="50"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                  Professional Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="block w-full rounded-xl border border-slate-200 bg-white/50 px-4 py-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  rows={2}
                  placeholder="Tell patients about your clinical experience..."
                ></textarea>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-55 shadow-lg shadow-brand-500/20"
          >
            {loading ? 'Submitting Registration...' : 'Complete Sign Up'}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-secondary font-medium">
          Already have an account?{' '}
          <Link to="/login" className="text-brand-600 font-bold hover:underline dark:text-brand-400">
            Sign In here
          </Link>
        </div>

        </div>
      </TiltCard>
    </div>
  );
};

export default Register;
