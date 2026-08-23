import { useState, useCallback } from 'react';
import { api } from './api/client';

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

interface DebtorApi {
  id: number;
  name: string;
  phone: string;
  credit_limit: string;
  is_active: boolean;
  balance: string | number;
  created_at: string;
}

function mapDebtor(d: DebtorApi): Debtor {
  return { id: String(d.id), name: d.name, phone: d.phone, total_owed: Number(d.balance), branch_id: '' };
}

export const useDebtors = () => {
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDebtors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<DebtorApi[]>('/debtors/');
      const mapped = data.map(mapDebtor);
      setDebtors(mapped);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debtors');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createDebtor = useCallback(async (debtor: Omit<Debtor, 'id'>) => {
    try {
      const data = await api.post<DebtorApi>('/debtors/', { name: debtor.name, phone: debtor.phone, is_active: true });
      const mapped = mapDebtor(data);
      setDebtors(previous => [...previous, mapped]);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create debtor');
      return null;
    }
  }, []);

  const updateDebtor = useCallback(async (id: string, updates: Partial<Debtor>) => {
    try {
      const data = await api.patch<DebtorApi>(`/debtors/${id}/`, updates);
      const mapped = mapDebtor(data);
      setDebtors(previous => previous.map(d => d.id === id ? mapped : d));
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update debtor');
      return null;
    }
  }, []);

  const deleteDebtor = useCallback(async (id: string) => {
    try {
      await api.delete(`/debtors/${id}/`);
      setDebtors(previous => previous.filter(d => d.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete debtor');
      return false;
    }
  }, []);

  const addTransaction = useCallback(async (_transaction: Omit<DebtorTransaction, 'id' | 'created_at'>) => {
    setError('Debtor ledger mutations must use the protected Django payment workflow.');
    return null;
  }, []);

  const getDebtorTransactions = useCallback(async (_debtorId: string) => {
    setError('Debtor ledger endpoint is not enabled yet.');
    return [] as DebtorTransaction[];
  }, []);

  const getDebtorsSummary = useCallback(async () => {
    try {
      const data = await api.get<DebtorApi[]>('/debtors/');
      const mapped = data.map(mapDebtor).filter(d => d.total_owed > 0).sort((a, b) => b.total_owed - a.total_owed);
      return { debtors: mapped, totalDebt: mapped.reduce((sum, d) => sum + d.total_owed, 0), debtorCount: mapped.length };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch debtors summary');
      return { debtors: [], totalDebt: 0, debtorCount: 0 };
    }
  }, []);

  return { debtors, loading, error, fetchDebtors, createDebtor, updateDebtor, deleteDebtor, addTransaction, getDebtorTransactions, getDebtorsSummary };
};
