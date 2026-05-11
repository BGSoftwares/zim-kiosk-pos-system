import { useState, useCallback } from 'react';
import { supabase } from './supabase';

export interface Debtor {
  id: string;
  name: string;
  phone: string;
  address?: string;
  national_id?: string;
  total_owed: number;
  last_payment?: string;
  notes?: string;
  branch_id: string;
}

export interface DebtorTransaction {
  id: string;
  debtor_id: string;
  sale_id?: string;
  transaction_type: 'credit' | 'payment' | 'writeoff';
  amount: number;
  reference?: string;
  notes?: string;
  created_at: string;
}

export const useDebtors = () => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all debtors
  const fetchDebtors = useCallback(async (branchId?: string) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('debtors')
        .select('*')
        .order('name');

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setDebtors(data || []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debtors');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create debtor
  const createDebtor = useCallback(async (debtor: Omit<Debtor, 'id'>) => {
    try {
      const { data, error: err } = await supabase
        .from('debtors')
        .insert([debtor])
        .select()
        .single();

      if (err) throw err;
      setDebtors([...debtors, data]);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debtor');
      return null;
    }
  }, [debtors]);

  // Update debtor
  const updateDebtor = useCallback(async (id: string, updates: Partial<Debtor>) => {
    try {
      const { data, error: err } = await supabase
        .from('debtors')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (err) throw err;
      setDebtors(debtors.map(d => d.id === id ? data : d));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update debtor');
      return null;
    }
  }, [debtors]);

  // Delete debtor
  const deleteDebtor = useCallback(async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('debtors')
        .delete()
        .eq('id', id);

      if (err) throw err;
      setDebtors(debtors.filter(d => d.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete debtor');
      return false;
    }
  }, [debtors]);

  // Add transaction (credit or payment)
  const addTransaction = useCallback(async (
    transaction: Omit<DebtorTransaction, 'id' | 'created_at'>
  ) => {
    try {
      const { data, error: err } = await supabase
        .from('debtor_transactions')
        .insert([transaction])
        .select()
        .single();

      if (err) throw err;

      // Update debtor's total_owed
      const debtor = debtors.find(d => d.id === transaction.debtor_id);
      if (debtor) {
        let newTotal = debtor.total_owed;
        if (transaction.transaction_type === 'credit') {
          newTotal += transaction.amount;
        } else if (transaction.transaction_type === 'payment') {
          newTotal = Math.max(0, newTotal - transaction.amount);
        } else if (transaction.transaction_type === 'writeoff') {
          newTotal = 0;
        }

        await updateDebtor(transaction.debtor_id, { 
          total_owed: newTotal,
          last_payment: transaction.transaction_type === 'payment' ? new Date().toISOString() : undefined,
        });
      }

      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add transaction');
      return null;
    }
  }, [debtors, updateDebtor]);

  // Get debtor transactions
  const getDebtorTransactions = useCallback(async (debtorId: string) => {
    try {
      const { data, error: err } = await supabase
        .from('debtor_transactions')
        .select('*')
        .eq('debtor_id', debtorId)
        .order('created_at', { ascending: false });

      if (err) throw err;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch transactions');
      return [];
    }
  }, []);

  // Get debtors with total owed (summary)
  const getDebtorsSummary = useCallback(async (branchId?: string) => {
    try {
      let query = supabase
        .from('debtors')
        .select('id, name, phone, total_owed, last_payment')
        .gt('total_owed', 0);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error: err } = await query.order('total_owed', { ascending: false });
      if (err) throw err;

      const totalDebt = data?.reduce((sum, d) => sum + d.total_owed, 0) || 0;
      
      return {
        debtors: data || [],
        totalDebt,
        debtorCount: data?.length || 0,
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debtors summary');
      return { debtors: [], totalDebt: 0, debtorCount: 0 };
    }
  }, []);

  return {
    debtors,
    loading,
    error,
    fetchDebtors,
    createDebtor,
    updateDebtor,
    deleteDebtor,
    addTransaction,
    getDebtorTransactions,
    getDebtorsSummary,
  };
};
