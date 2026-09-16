import { api, getAccessToken, setAccessToken } from './api/client';

export interface AuthUser {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
  phone?: string;
  branch_id?: string | null;
  is_active?: boolean;
}

interface ApiAuthUser extends Omit<AuthUser, 'id' | 'branch_id'> {
  id: number;
  branch_id?: number | null;
}

export interface AuthResponse {
  user: AuthUser | null;
  profile: AuthUser | null;
  error: string | null;
}

interface LoginApiResponse {
  access: string;
  refresh: string;
  user: ApiAuthUser;
}

const REFRESH_TOKEN_KEY = 'zim_kiosk_refresh_token';

function normalizeUser(user: ApiAuthUser): AuthUser {
  return { ...user, id: String(user.id), branch_id: user.branch_id == null ? null : String(user.branch_id) };
}

function saveRefreshToken(token: string) {
  sessionStorage.setItem(REFRESH_TOKEN_KEY, token);
}

function clearTokens() {
  setAccessToken(null);
  sessionStorage.removeItem(REFRESH_TOKEN_KEY);
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  try {
    const response = await api.post<LoginApiResponse>('/auth/login/', { email: email.trim().toLowerCase(), password });
    setAccessToken(response.access);
    saveRefreshToken(response.refresh);
    const user = normalizeUser(response.user);
    return { user, profile: user, error: null };
  } catch (err) {
    clearTokens();
    return { user: null, profile: null, error: err instanceof Error ? err.message : 'Login failed' };
  }
}

export async function logout(): Promise<string | null> {
  clearTokens();
  return null;
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  try {
    if (!getAccessToken()) await refreshAccessToken();
    const user = await api.get<ApiAuthUser>('/auth/me/');
    return normalizeUser(user);
  } catch {
    clearTokens();
    return null;
  }
}

export async function getCurrentSession(): Promise<{ accessToken: string; refreshToken: string } | null> {
  const refreshToken = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refreshToken) return null;
  if (!getAccessToken()) await refreshAccessToken();
  const accessToken = getAccessToken();
  return accessToken ? { accessToken, refreshToken } : null;
}

export async function refreshAccessToken(): Promise<string | null> {
  const refresh = sessionStorage.getItem(REFRESH_TOKEN_KEY);
  if (!refresh) return null;
  try {
    const response = await api.post<{ access: string }>('/auth/refresh/', { refresh });
    setAccessToken(response.access);
    return response.access;
  } catch {
    clearTokens();
    return null;
  }
}

export function validatePassword(password: string): boolean {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);
}

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getPasswordRequirements(): string[] {
  return ['At least 8 characters long', 'At least one uppercase letter', 'At least one lowercase letter', 'At least one number'];
}

export async function signUpUser(
  email: string,
  password: string,
  userData?: { fullName?: string; role?: string; branchId?: string },
): Promise<AuthResponse> {
  try {
    const names = (userData?.fullName || '').trim().split(/\s+/).filter(Boolean);
    const response = await api.post<ApiAuthUser>('/auth/users/', {
      email: email.trim().toLowerCase(), password,
      first_name: names[0] || '', last_name: names.slice(1).join(' '),
      role: userData?.role || 'CASHIER', branch: userData?.branchId ? Number(userData.branchId) : null, is_active: true,
    });
    const user = normalizeUser(response);
    return { user, profile: user, error: null };
  } catch (err) {
    return { user: null, profile: null, error: err instanceof Error ? err.message : 'User creation failed' };
  }
}

export async function updateUserProfile(userId: string, updates: Record<string, unknown>): Promise<{ profile: AuthUser | null; error: string | null }> {
  try {
    const response = await api.patch<ApiAuthUser>(`/auth/users/${userId}/`, updates);
    return { profile: normalizeUser(response), error: null };
  } catch (err) {
    return { profile: null, error: err instanceof Error ? err.message : 'Profile update failed' };
  }
}
