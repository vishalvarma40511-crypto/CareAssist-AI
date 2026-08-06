import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage, LanguageCode } from '../context/LanguageContext';
import { useTheme, ThemeType } from '../context/ThemeContext';
import { 
  HeartPulse, LogOut, Sun, Moon, Eye, 
  ZoomIn, ZoomOut, Languages, LayoutDashboard,
  ShieldAlert, Activity, Pill, Salad
} from 'lucide-react';

const Navbar: React.FC = () => {
  const { user, logout } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme, fontScale, setFontScale } = useTheme();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const cycleTheme = () => {
    if (theme === 'light') setTheme('dark');
    else if (theme === 'dark') setTheme('high-contrast');
    else setTheme('light');
  };

  const handleZoom = (direction: 'in' | 'out') => {
    if (direction === 'in' && fontScale < 1.4) {
      setFontScale(fontScale + 0.15);
    } else if (direction === 'out' && fontScale > 0.85) {
      setFontScale(fontScale - 0.15);
    }
  };

  return (
    <nav className="glass-panel sticky top-0 z-40 w-full px-6 py-4 shadow-md transition-colors duration-300">
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-bold text-2xl tracking-wide text-brand-600 dark:text-brand-400">
          <HeartPulse className="h-8 w-8 animate-pulse text-red-500" />
          <span className="text-primary">{t('appName')}</span>
        </Link>

        {/* Action Controls & Navigation */}
        <div className="flex items-center gap-6">
          {user && (
            <div className="hidden items-center gap-4 md:flex">
              {/* Patient Navigation */}
              {user.role === 'patient' && (
                <>
                  <Link to="/" className="flex items-center gap-1 text-sm font-medium hover:text-brand-500">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>{t('dashboard')}</span>
                  </Link>
                  <Link to="/explain-medicine" className="flex items-center gap-1 text-sm font-medium hover:text-brand-500">
                    <Pill className="h-4 w-4" />
                    <span>{t('medGuide')}</span>
                  </Link>
                  <Link to="/nutrition-plan" className="flex items-center gap-1 text-sm font-medium hover:text-brand-500">
                    <Salad className="h-4 w-4" />
                    <span>{t('nutrition')}</span>
                  </Link>
                </>
              )}
              {/* Doctor / Admin Dashboard Navigation */}
              {(user.role === 'doctor' || user.role === 'admin') && (
                <Link to="/" className="flex items-center gap-1 text-sm font-medium hover:text-brand-500">
                  <LayoutDashboard className="h-4 w-4" />
                  <span>{t('dashboard')}</span>
                </Link>
              )}
            </div>
          )}

          {/* Accessibility Settings Toolbar */}
          <div className="flex items-center gap-2 rounded-full bg-slate-100 p-1 dark:bg-slate-800">
            {/* Theme Trigger */}
            <button 
              onClick={cycleTheme} 
              className="rounded-full p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Toggle Theme (Light / Dark / High-Contrast)"
            >
              {theme === 'light' && <Sun className="h-4 w-4" />}
              {theme === 'dark' && <Moon className="h-4 w-4" />}
              {theme === 'high-contrast' && <Eye className="h-4 w-4 text-yellow-500" />}
            </button>

            {/* Language Selector */}
            <div className="relative group">
              <button 
                className="flex items-center gap-1 rounded-full p-2 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-700"
                title="Change Language"
              >
                <Languages className="h-4 w-4" />
              </button>
              <div className="absolute right-0 top-8 mt-2 hidden w-32 rounded-lg bg-white p-1 shadow-lg group-hover:block dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <button onClick={() => setLanguage('en')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">English</button>
                <button onClick={() => setLanguage('hi')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">हिन्दी (Hindi)</button>
                <button onClick={() => setLanguage('te')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">తెలుగు (Telugu)</button>
                <button onClick={() => setLanguage('ta')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">தமிழ் (Tamil)</button>
                <button onClick={() => setLanguage('kn')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">ಕನ್ನಡ (Kannada)</button>
                <button onClick={() => setLanguage('bn')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">বাংলা (Bengali)</button>
                <button onClick={() => setLanguage('mr')} className="block w-full px-3 py-1.5 text-left text-xs hover:bg-brand-50 dark:hover:bg-slate-800">मराठी (Marathi)</button>
              </div>
            </div>

            {/* Font Zoom Controls */}
            <button 
              onClick={() => handleZoom('in')} 
              disabled={fontScale >= 1.4}
              className="rounded-full p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Increase Font Size"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button 
              onClick={() => handleZoom('out')} 
              disabled={fontScale <= 0.85}
              className="rounded-full p-2 text-slate-600 hover:bg-slate-200 disabled:opacity-40 dark:text-slate-300 dark:hover:bg-slate-700"
              title="Decrease Font Size"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
          </div>

          {/* User Profile & Logout */}
          {user ? (
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-xs font-semibold text-primary">{user.name}</p>
                <p className="text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">{user.role}</p>
              </div>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 rounded-full bg-red-50 px-4 py-2 text-xs font-semibold text-red-600 transition hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-900/40"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{t('logout')}</span>
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Link to="/login" className="rounded-full bg-brand-600 px-5 py-2 text-xs font-semibold text-white transition hover:bg-brand-700">
                Log In
              </Link>
            </div>
          )}
        </div>

      </div>
    </nav>
  );
};

export default Navbar;
