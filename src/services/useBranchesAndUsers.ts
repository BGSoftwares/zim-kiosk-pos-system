import { useState, useCallback, useEffect } from 'react';
import { supabase } from './supabase';

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface User {
  id: string;
  name: string;
  role: 'admin' | 'manager' | 'cashier';
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
      const { data, error: err } = await supabase
        .from('branches')
        .select('*')
        .order('name');

      if (err) throw err;
      setBranches(data || []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch branches');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  return { branches, loading, error, fetchBranches };
};

export const useUsers = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch users by branch
  const fetchUsers = useCallback(async (branchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('users')
        .select('*')
        .order('name');

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setUsers(data || []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create user
  const createUser = useCallback(async (user: Omit<User, 'id'>) => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .insert([user])
        .select()
        .single();

      if (err) throw err;
      setUsers([...users, data]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user');
      return null;
    }
  }, [users]);

  // Update user
  const updateUser = useCallback(async (id: string, updates: Partial<User>) => {
    try {
      const { data, error: err } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) throw err;
      setUsers(users.map(u => u.id === id ? data : u));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user');
      return null;
    }
  }, [users]);

  // Delete user
  const deleteUser = useCallback(async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('users')
        .delete()
        .eq('id', id);

      if (err) throw err;
      setUsers(users.filter(u => u.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete user');
      return false;
    }
  }, [users]);

  return {
    users,
    loading,
    error,
    fetchUsers,
    createUser,
    updateUser,
    deleteUser,
  };
};
