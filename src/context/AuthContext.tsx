import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../utils/supabaseClient';
import { DEFAULT_MEMBERS } from '../config/members';

export interface AuthSession {
  username: string;
  isAuthenticated: boolean;
  loginTime: number;
}

interface AuthContextType {
  isAuthenticated: boolean;
  currentUser: string | null;
  currentUserId: string | null;
  login: (emailOrUser: string, password: string, rememberSession: boolean) => Promise<boolean>;
  signUp: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  isCloud: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_KEY = 'jira_clone_auth';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Set up Supabase Auth state listener if configured (Phase 4 / 15)
  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      // Local Mock Auth boot check
      const local = localStorage.getItem(AUTH_KEY) || sessionStorage.getItem(AUTH_KEY);
      if (local) {
        try {
          const parsed = JSON.parse(local) as AuthSession;
          setIsAuthenticated(true);
          setCurrentUser(parsed.username);
          setCurrentUserId(`MOCK-${parsed.username.toUpperCase()}-ID`);
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && session.user) {
        setIsAuthenticated(true);
        setCurrentUser(session.user.email || 'User');
        setCurrentUserId(session.user.id);
      }
      setLoading(false);
    });

    // Listen to changes in auth state (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session && session.user) {
        setIsAuthenticated(true);
        setCurrentUser(session.user.email || 'User');
        setCurrentUserId(session.user.id);
      } else {
        setIsAuthenticated(false);
        setCurrentUser(null);
        setCurrentUserId(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const login = async (emailOrUser: string, password: string, rememberSession: boolean): Promise<boolean> => {
    if (!isSupabaseConfigured || !supabase) {
      // Local mock login logic derived from DEFAULT_MEMBERS
      await new Promise((resolve) => setTimeout(resolve, 600));
      const mockUsers: Record<string, string> = {};
      DEFAULT_MEMBERS.forEach(m => {
        mockUsers[m.name.toLowerCase()] = `${m.name.toLowerCase()}123`;
        mockUsers[m.email.toLowerCase()] = `${m.name.toLowerCase()}123`;
      });
      
      const cleanUser = emailOrUser.toLowerCase().trim();
      if (mockUsers[cleanUser] && password === mockUsers[cleanUser]) {
        const matchedMember = DEFAULT_MEMBERS.find(m => m.name.toLowerCase() === cleanUser || m.email.toLowerCase() === cleanUser);
        const displayName = matchedMember ? matchedMember.email : cleanUser;
        const newSession: AuthSession = {
          username: displayName,
          isAuthenticated: true,
          loginTime: Date.now(),
        };
        setIsAuthenticated(true);
        setCurrentUser(displayName);
        setCurrentUserId(matchedMember ? matchedMember.id : `MOCK-${cleanUser.toUpperCase()}-ID`);

        const string = JSON.stringify(newSession);
        if (rememberSession) {
          localStorage.setItem(AUTH_KEY, string);
        } else {
          sessionStorage.setItem(AUTH_KEY, string);
        }
        return true;
      }
      return false;
    }

    // Supabase Auth SignIn logic
    const { data, error } = await supabase.auth.signInWithPassword({
      email: emailOrUser,
      password: password,
    });

    if (error) {
      console.error('Supabase login error:', error.message);
      return false;
    }

    return !!data.user;
  };

  const signUp = async (email: string, password: string): Promise<{ success: boolean; error?: string }> => {
    if (!isSupabaseConfigured || !supabase) {
      return { success: false, error: 'Supabase is not configured yet. Sign up is unavailable.' };
    }

    const cleanEmail = email.trim();

    // 1. Empty email check
    if (!cleanEmail) {
      return { success: false, error: 'Email address cannot be empty.' };
    }

    // 2. Valid email format check
    const emailRegex = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
    if (!emailRegex.test(cleanEmail)) {
      return { success: false, error: 'Please enter a valid email address format.' };
    }

    // 3. Allowed email domains for Logmark AI internal use
    const companyEmailRegex = /^[A-Za-z0-9._%+-]+@(logmark-ai\.com|gmail\.com|orglens\.com)$/i;
    if (!companyEmailRegex.test(cleanEmail)) {
      return { success: false, error: 'Only authorized email domains are allowed: @logmark-ai.com, @gmail.com, or @orglens.com.' };
    }

    // 4. Password validation check
    if (!password || password.length < 6) {
      return { success: false, error: 'Password must be at least 6 characters long.' };
    }

    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail.toLowerCase(),
      password,
    });

    if (error) {
      console.error('Supabase registration error:', error.message);
      return { success: false, error: error.message };
    }

    if (data.session) {
      return { success: true };
    } else {
      return { success: true, error: 'Registration successful! Please check your email inbox for a validation link.' };
    }
  };

  const logout = async () => {
    if (!isSupabaseConfigured || !supabase) {
      setIsAuthenticated(false);
      setCurrentUser(null);
      setCurrentUserId(null);
      localStorage.removeItem(AUTH_KEY);
      sessionStorage.removeItem(AUTH_KEY);
      return;
    }

    await supabase.auth.signOut();
  };

  if (loading) {
    // Show a blank or mini loading layout while session resolves
    return null;
  }

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        currentUser,
        currentUserId,
        login,
        signUp,
        logout,
        isCloud: isSupabaseConfigured,
      }}
    >
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
