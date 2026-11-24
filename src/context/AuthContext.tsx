import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { loginWithEmail, logout as doLogout, restoreSession } from '../services/auth';
import { supabase } from '../services/supabase';
import type { Profile } from '../types';

interface AuthState {
  profile: Profile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    restoreSession().then(p => {
      if (!cancelled) {
        setProfile(p);
        setLoading(false);
      }
    });

    // Signed out elsewhere (another tab, expired refresh token) -> back to the login form.
    const { data } = supabase.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT') setProfile(null);
    });
    return () => {
      cancelled = true;
      data.subscription.unsubscribe();
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await loginWithEmail(email, password);
    if (result.profile) setProfile(result.profile);
    return result.error;
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    setProfile(null);
  }, []);

  const value = useMemo(() => ({ profile, loading, login, logout }), [profile, loading, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
