import { supabase } from './supabase';

// Types
export interface AuthUser {
  id: string;
  email: string;
  role: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  profile: any;
  error: string | null;
}

/**
 * Login with email and password
 * @param email User email
 * @param password User password
 * @returns AuthResponse with user data or error
 */
export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  try {
    // Sign in with Supabase
    const { data: { user }, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return {
        user: null,
        profile: null,
        error: signInError.message,
      };
    }

    if (!user) {
      return {
        user: null,
        profile: null,
        error: 'No user returned from authentication',
      };
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError && profileError.code !== 'PGRST116') {
      return {
        user: null,
        profile: null,
        error: profileError.message,
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role: profile?.role || 'user',
      },
      profile: profile || { id: user.id, email: user.email },
      error: null,
    };
  } catch (err: any) {
    return {
      user: null,
      profile: null,
      error: err.message || 'An error occurred during login',
    };
  }
}

/**
 * Logout current user
 * @returns error message or null
 */
export async function logout(): Promise<string | null> {
  try {
    const { error } = await supabase.auth.signOut();
    return error ? error.message : null;
  } catch (err: any) {
    return err.message || 'An error occurred during logout';
  }
}

/**
 * Get current authenticated user
 * @returns AuthUser or null
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // Fetch profile for role information
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    return {
      id: user.id,
      email: user.email || '',
      role: profile?.role || 'user',
    };
  } catch (err) {
    return null;
  }
}

/**
 * Get current session
 * @returns Supabase session or null
 */
export async function getCurrentSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    return session;
  } catch (err) {
    return null;
  }
}

/**
 * Validate password
 * @param password Password to validate
 * @returns true if valid, false otherwise
 */
export function validatePassword(password: string): boolean {
  // At least 6 characters, 1 uppercase, 1 number
  const minLength = password.length >= 6;
  const hasUppercase = /[A-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);

  return minLength && hasUppercase && hasNumber;
}

/**
 * Validate email
 * @param email Email to validate
 * @returns true if valid, false otherwise
 */
export function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Get password validation requirements
 * @returns Array of requirements
 */
export function getPasswordRequirements(): string[] {
  return [
    'At least 6 characters long',
    'At least one uppercase letter (A-Z)',
    'At least one number (0-9)',
  ];
}

/**
 * Sign up a new user (admin only)
 * @param email New user email
 * @param password New user password
 * @param userData Additional user data (name, role, etc)
 * @returns AuthResponse with new user or error
 */
export async function signUpUser(
  email: string,
  password: string,
  userData?: {
    fullName?: string;
    role?: string;
    branchId?: string;
  }
): Promise<AuthResponse> {
  try {
    // Sign up user
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      return {
        user: null,
        profile: null,
        error: signUpError.message,
      };
    }

    if (!user) {
      return {
        user: null,
        profile: null,
        error: 'No user returned from signup',
      };
    }

    // Create profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert([
        {
          id: user.id,
          email: user.email,
          full_name: userData?.fullName || '',
          role: userData?.role || 'user',
          branch_id: userData?.branchId || null,
          active: true,
        },
      ])
      .select()
      .single();

    if (profileError) {
      return {
        user: null,
        profile: null,
        error: profileError.message,
      };
    }

    return {
      user: {
        id: user.id,
        email: user.email || '',
        role: userData?.role || 'user',
      },
      profile,
      error: null,
    };
  } catch (err: any) {
    return {
      user: null,
      profile: null,
      error: err.message || 'An error occurred during signup',
    };
  }
}

/**
 * Update user profile
 * @param userId User ID
 * @param updates Profile updates
 * @returns Updated profile or error
 */
export async function updateUserProfile(
  userId: string,
  updates: Record<string, any>
): Promise<{ profile: any; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      return { profile: null, error: error.message };
    }

    return { profile: data, error: null };
  } catch (err: any) {
    return { profile: null, error: err.message || 'An error occurred during update' };
  }
}
