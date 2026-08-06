import React, { createContext, useContext, useState, useEffect } from 'react';

export type ThemeType = 'light' | 'dark' | 'high-contrast';

interface ThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  fontScale: number; // 1 = normal, 1.2 = large, 1.4 = extra large
  setFontScale: (scale: number) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setThemeState] = useState<ThemeType>(() => {
    return (localStorage.getItem('careassist_theme') as ThemeType) || 'light';
  });
  
  const [fontScale, setFontScaleState] = useState<number>(() => {
    const saved = localStorage.getItem('careassist_fontscale');
    return saved ? parseFloat(saved) : 1.0;
  });

  useEffect(() => {
    const root = window.document.documentElement;
    
    // Remove existing theme classes
    root.classList.remove('dark', 'high-contrast');
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'high-contrast') {
      root.classList.add('high-contrast');
    }
    
    localStorage.setItem('careassist_theme', theme);
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.style.setProperty('--font-scale', fontScale.toString());
    localStorage.setItem('careassist_fontscale', fontScale.toString());
  }, [fontScale]);

  const setTheme = (newTheme: ThemeType) => setThemeState(newTheme);
  const setFontScale = (scale: number) => setFontScaleState(scale);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, fontScale, setFontScale }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
