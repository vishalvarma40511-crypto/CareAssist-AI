import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { HeartPulse, Mail, Lock, ShieldAlert, Key } from 'lucide-react';
import TiltCard from '../components/TiltCard';

const Login: React.FC = () => {
  const { login, apiBase } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // OTP Verification flow state
  const [showOtpVerify, setShowOtpVerify] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpEmail, setOtpEmail] = useState('');
  const [otpSuccess, setOtpSuccess] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid credentials');
      }

      // If user is registered but not verified, show OTP modal
      if (!data.user.isVerified) {
        setOtpEmail(email);
        setShowOtpVerify(true);
        setError("Account not verified yet. Please enter the OTP code sent to your console/email.");
        setLoading(false);
        return;
      }

      login(data.token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${apiBase}/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: otpEmail, otp: otpCode })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Invalid OTP code');
      }

      setOtpSuccess("Account verified successfully! You can now log in.");
      setShowOtpVerify(false);
      setError(null);
      setLoading(false);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[80vh] items-center justify-center px-4 py-12 sm:px-6 lg:px-8">
      <TiltCard className="w-full max-w-md">
        <div className="glass-panel p-8 rounded-3xl shadow-2xl relative overflow-hidden">
        
        {/* Decorative backdrop glow */}
        <div className="absolute -top-12 -left-12 h-24 w-24 rounded-full bg-brand-400/20 blur-xl"></div>
        <div className="absolute -bottom-12 -right-12 h-24 w-24 rounded-full bg-blue-500/10 blur-xl"></div>

        <div className="text-center mb-8">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-500 text-white shadow-lg">
            <HeartPulse className="h-10 w-10 animate-pulse" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold tracking-tight text-primary">
            Welcome back
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Access your secure CareAssist account
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-2 rounded-xl bg-red-50 p-4 text-xs font-semibold text-red-600 dark:bg-red-950/30 dark:text-red-400 border border-red-200 dark:border-red-900">
            <ShieldAlert className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {otpSuccess && (
          <div className="mb-6 rounded-xl bg-green-50 p-4 text-xs font-semibold text-green-600 dark:bg-green-950/30 dark:text-green-400 border border-green-200 dark:border-green-900">
            {otpSuccess}
          </div>
        )}

        {/* Regular Login Form */}
        {!showOtpVerify ? (
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
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
                  className="block w-full rounded-2xl border border-slate-200 bg-white/50 pl-10 pr-4 py-3 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
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
                  className="block w-full rounded-2xl border border-slate-200 bg-white/50 pl-10 pr-4 py-3 text-sm focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-4 w-full rounded-2xl bg-brand-600 py-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 active:scale-[0.98] disabled:opacity-55 shadow-lg shadow-brand-500/20"
            >
              {loading ? 'Processing...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* OTP Verification Form */
          <form onSubmit={handleVerifyOtp} className="space-y-5 animate-slide-in">
            <div className="rounded-xl bg-blue-50/50 p-4 text-xs text-blue-700 dark:bg-blue-950/30 dark:text-blue-400">
              Please enter the 6-digit OTP code sent for account <strong>{otpEmail}</strong>. (Check console logs if running locally).
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                Verification Code (OTP)
              </label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <Key className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="block w-full rounded-2xl border border-slate-200 bg-white/50 pl-10 pr-4 py-3 text-sm tracking-widest focus:border-brand-500 focus:outline-none dark:border-slate-800 dark:bg-slate-950/40"
                  placeholder="123456"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 rounded-2xl bg-green-600 py-3 text-xs font-bold text-white transition hover:bg-green-700"
              >
                Verify Code
              </button>
              <button
                type="button"
                onClick={() => setShowOtpVerify(false)}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Back
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-secondary font-medium">
          Don't have an account?{' '}
          <Link to="/register" className="text-brand-600 font-bold hover:underline dark:text-brand-400">
            Create an account
          </Link>
        </div>

        </div>
      </TiltCard>
    </div>
  );
};

export default Login;
