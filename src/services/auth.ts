import { supabase } from './supabase';
import { ROLES, type Role } from '../lib/roles';
import type { Profile } from '../types';

export interface LoginResult {
  profile: Profile | null;
  error: string | null;
}

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string;
  role: string;
  branch_id: string | null;
  active: boolean;
};

export const toProfile = (row: ProfileRow): Profile => ({
  id: row.id,
  email: row.email ?? '',
  fullName: row.full_name || row.email || 'User',
  role: (ROLES as string[]).includes(row.role) ? (row.role as Role) : 'cashier',
  branchId: row.branch_id,
  active: row.active,
});

export const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

async function fetchProfile(userId: string): Promise<{ profile: Profile | null; error: string | null }> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) return { profile: null, error: error.message };
  if (!data) {
    return { profile: null, error: 'Your account has no profile yet. Ask an administrator to set it up.' };
  }
  return { profile: toProfile(data as ProfileRow), error: null };
}

/** Sign in, then make sure the account is active. Inactive accounts are signed straight back out. */
export async function loginWithEmail(email: string, password: string): Promise<LoginResult> {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (error || !data.user) {
      return { profile: null, error: error?.message ?? 'Sign in failed' };
    }
    const { profile, error: profileError } = await fetchProfile(data.user.id);
    if (!profile) {
      await supabase.auth.signOut();
      return { profile: null, error: profileError };
    }
    if (!profile.active) {
      await supabase.auth.signOut();
      return { profile: null, error: 'Your account is waiting for an administrator to activate it.' };
    }
    return { profile, error: null };
  } catch (err) {
    return { profile: null, error: err instanceof Error ? err.message : 'Sign in failed' };
  }
}

/** Restore the logged-in user after a page reload. */
export async function restoreSession(): Promise<Profile | null> {
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return null;
    const { profile } = await fetchProfile(data.session.user.id);
    if (!profile || !profile.active) {
      await supabase.auth.signOut();
      return null;
    }
    return profile;
  } catch {
    return null;
  }
}

export async function logout(): Promise<void> {
  await supabase.auth.signOut();
}
