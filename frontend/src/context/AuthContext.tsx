import React, { createContext, useContext, useState, useEffect } from 'react';

export interface User {
  id: string;
  email: string;
  role: 'patient' | 'doctor' | 'admin';
  name: string;
  phone?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  pregnancyStatus?: boolean;
  isVerified: boolean;
  doctorProfile?: {
    specialty: string;
    license_number: string;
    bio?: string;
    clinic_address?: string;
    consultation_fee: number;
    is_verified: boolean;
  };
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  updateUser: (user: Partial<User>) => void;
  isLoading: boolean;
  apiBase: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const apiBase = import.meta.env.VITE_API_BASE_URL || (
    window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000/api'
      : `${window.location.origin.replace('careassist-frontend', 'careassist-backend').replace('-frontend', '-backend')}/api`
  );

  useEffect(() => {
    // Load from storage
    const storedToken = localStorage.getItem('careassist_token');
    const storedUser = localStorage.getItem('careassist_user');
    
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = (newToken: string, newUser: User) => {
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem('careassist_token', newToken);
    localStorage.setItem('careassist_user', JSON.stringify(newUser));
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('careassist_token');
    localStorage.removeItem('careassist_user');
  };

  const updateUser = (updatedFields: Partial<User>) => {
    if (!user) return;
    const mergedUser = { ...user, ...updatedFields };
    setUser(mergedUser);
    localStorage.setItem('careassist_user', JSON.stringify(mergedUser));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, updateUser, isLoading, apiBase }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
