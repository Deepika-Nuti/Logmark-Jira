import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { loadWorkspace } from '../utils/storage';

export type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  setThemeDirectly: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    // Priority 1: Direct theme preference in localStorage
    const directTheme = localStorage.getItem('logmark_theme');
    if (directTheme === 'light' || directTheme === 'dark') {
      return directTheme as Theme;
    }

    // Priority 2: Saved theme in workspace
    try {
      const ws = loadWorkspace();
      if (ws && (ws.theme === 'light' || ws.theme === 'dark')) {
        return ws.theme;
      }
    } catch (e) {
      console.error('Failed to load workspace theme on startup', e);
    }

    // Priority 3: System preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }

    // Priority 4: Default to light
    return 'light';
  });

  useEffect(() => {
    // Apply theme attribute to root document and cache in localStorage
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('logmark_theme', theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  const setThemeDirectly = useCallback((newTheme: Theme) => {
    setTheme(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setThemeDirectly }}>
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
