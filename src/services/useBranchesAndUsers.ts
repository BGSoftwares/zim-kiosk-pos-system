import { useState, useCallback, useEffect } from 'react';
import { api } from './api/client';

export interface Branch {
  id: string;
  name: string;
  location: string;
  code?: string;
  address?: string;
  phone?: string;
  currency?: string;
}

export interface User {
  id: string;
  name: string;
  role: 'SUPER_ADMIN' | 'BRANCH_MANAGER' | 'CASHIER' | 'STOREKEEPER' | 'ACCOUNTANT';
  branch_id: string;
  email?: string;
}

export const useBranches = () => {
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBranches = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Array<{ id: number; code: string; name: string; address: string; phone: string; currency: string }>>('/branches/');
      const mapped = data.map(branch => ({ ...branch, id: String(branch.id), location: branch.address }));
      setBranches(mapped);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch branches');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBranches(); }, [fetchBranches]);

  return { branches, loading, error, fetchBranches };
};

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<Array<{ id: number; first_name: string; last_name: string; role: User['role']; branch_id: number | null; email: string }>>('/auth/users/');
      const mapped = data.map(user => ({ id: String(user.id), name: `${user.first_name} ${user.last_name}`.trim(), role: user.role, branch_id: user.branch_id ? String(user.branch_id) : '', email: user.email }));
      setUsers(mapped);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createUser = useCallback(async (user: Omit<User, 'id'> & { password?: string }) => {
    try {
      const data = await api.post<{ id: number; first_name: string; last_name: string; role: User['role']; branch_id: number | null; email: string }>('/auth/users/', user);
      const mapped = { id: String(data.id), name: `${data.first_name} ${data.last_name}`.trim(), role: data.role, branch_id: data.branch_id ? String(data.branch_id) : '', email: data.email };
      setUsers(previous => [...previous, mapped]);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      return null;
    }
  }, []);

  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    try {
      const data = await api.patch<{ id: number; first_name: string; last_name: string; role: User['role']; branch_id: number | null; email: string }>(`/auth/users/${id}/`, updates);
      const mapped = { id: String(data.id), name: `${data.first_name} ${data.last_name}`.trim(), role: data.role, branch_id: data.branch_id ? String(data.branch_id) : '', email: data.email };
      setUsers(previous => previous.map(user => user.id === id ? mapped : user));
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return null;
    }
  }, []);

  const deleteUser = useCallback(async (id: string) => {
    try {
      await api.delete(`/auth/users/${id}/`);
      setUsers(previous => previous.filter(user => user.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    }
  }, []);

  return { users, loading, error, fetchUsers, createUser, updateUser, deleteUser };
};
