import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Navbar from './components/Navbar';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientDashboard from './pages/PatientDashboard';
import DoctorDashboard from './pages/DoctorDashboard';
import AdminDashboard from './pages/AdminDashboard';
import MedicineAssistant from './pages/MedicineAssistant';
import NutritionPlanner from './pages/NutritionPlanner';
import Interactive3DBackground from './components/Interactive3DBackground';

// Protected Route Wrapper
const ProtectedRoute: React.FC<{ children: React.ReactNode; allowedRoles?: string[] }> = ({ children, allowedRoles }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-xs animate-pulse">
        CareAssist is booting secure modules...
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-transparent text-slate-800 dark:text-slate-100 transition-colors duration-300">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
    </div>
  );
};

// Home component routing depending on user role
const HomeRouter: React.FC = () => {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;

  if (user.role === 'patient') {
    return <PatientDashboard />;
  } else if (user.role === 'doctor') {
    return <DoctorDashboard />;
  } else if (user.role === 'admin') {
    return <AdminDashboard />;
  }

  return <Navigate to="/login" replace />;
};

const App: React.FC = () => {
  return (
    <>
      <Interactive3DBackground />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />

        {/* Protected Routes */}
        <Route 
          path="/" 
          element={
            <ProtectedRoute>
              <HomeRouter />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/explain-medicine" 
          element={
            <ProtectedRoute allowedRoles={['patient', 'admin']}>
              <MedicineAssistant />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/nutrition-plan" 
          element={
            <ProtectedRoute allowedRoles={['patient', 'admin']}>
              <NutritionPlanner />
            </ProtectedRoute>
          } 
        />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};

export default App;
