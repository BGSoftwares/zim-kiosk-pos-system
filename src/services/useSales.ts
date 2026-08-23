import { useState, useCallback } from 'react';
import { api } from './api/client';

export interface Sale {
  id: string;
  receipt_number?: string;
  sale_date?: string;
  created_at?: string;
  total_amount?: number;
  total?: number;
  payment_method?: 'cash' | 'card' | 'mobile' | 'credit';
  currency: string;
  cashier_id: string;
  branch_id: string;
  customer_phone?: string;
  notes?: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  discount: number;
  subtotal: number;
}

interface SaleApiResponse {
  id: number;
  receipt_number: string;
  branch_id: number;
  cashier_id: number;
  currency: string;
  exchange_rate: string;
  subtotal: string;
  discount: string;
  tax: string;
  total: string;
  status: string;
  created_at: string;
  items: Array<{
    product_id: number;
    product_name: string;
    quantity: string;
    unit_price: string;
    discount: string;
    tax: string;
    line_total: string;
  }>;
}

function mapSale(sale: SaleApiResponse): Sale {
  return {
    id: String(sale.id),
    receipt_number: sale.receipt_number,
    sale_date: sale.created_at,
    created_at: sale.created_at,
    total_amount: Number(sale.total),
    total: Number(sale.total),
    currency: sale.currency,
    cashier_id: String(sale.cashier_id),
    branch_id: String(sale.branch_id),
  };
}

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSales = useCallback(async (filters?: { start_date?: string; end_date?: string; branch_id?: string }) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (filters?.start_date) params.set('created_at__gte', filters.start_date);
      if (filters?.end_date) params.set('created_at__lte', filters.end_date);
      if (filters?.branch_id) params.set('branch_id', filters.branch_id);
      const data = await api.get<SaleApiResponse[]>(`/sales/${params.toString() ? `?${params}` : ''}`);
      const mapped = data.map(mapSale);
      setSales(mapped);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createSale = useCallback(async (
    sale: Omit<Sale, 'id'> & { exchange_rate?: number; receipt_number?: string; discount?: number; idempotency_key?: string },
    items: Omit<SaleItem, 'id' | 'sale_id'>[],
  ) => {
    setLoading(true);
    setError(null);
    try {
      const idempotencyKey = sale.idempotency_key || crypto.randomUUID();
      const response = await api.post<SaleApiResponse>('/sales/create/', {
        currency: sale.currency,
        exchange_rate: sale.exchange_rate ?? 1,
        idempotency_key: idempotencyKey,
        receipt_number: sale.receipt_number || `SALE-${Date.now()}`,
        discount: sale.discount ?? 0,
        items: items.map(item => ({ product_id: Number(item.product_id), quantity: item.quantity })),
        payments: [{
          method: sale.payment_method === 'mobile' ? 'ECOCASH' : sale.payment_method === 'card' ? 'CARD' : sale.payment_method === 'credit' ? 'CREDIT' : 'CASH',
          amount: sale.total_amount ?? sale.total ?? 0,
          currency: sale.currency,
        }],
      });
      const mapped = mapSale(response);
      setSales(previous => [mapped, ...previous]);
      return mapped;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sale');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getSaleWithItems = useCallback(async (saleId: string) => {
    try {
      const sale = await api.get<SaleApiResponse>(`/sales/${saleId}/`);
      return {
        sale: mapSale(sale),
        items: sale.items.map((item, index) => ({
          id: `${sale.id}-${index}`,
          sale_id: String(sale.id),
          product_id: String(item.product_id),
          quantity: Number(item.quantity),
          unit_price: Number(item.unit_price),
          discount: Number(item.discount),
          subtotal: Number(item.line_total),
        })),
      };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sale details');
      return null;
    }
  }, []);

  const getDailySalesSummary = useCallback(async (date: string, branchId?: string) => {
    try {
      const salesForDay = await fetchSales({ start_date: `${date}T00:00:00`, end_date: `${date}T23:59:59`, branch_id: branchId });
      const byPaymentMethod: Record<string, number> = {};
      let totalSales = 0;
      salesForDay.forEach(sale => {
        const amount = sale.total_amount ?? sale.total ?? 0;
        totalSales += amount;
        const method = sale.payment_method || 'unknown';
        byPaymentMethod[method] = (byPaymentMethod[method] || 0) + amount;
      });
      return { totalSales, totalItems: 0, byPaymentMethod };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales summary');
      return null;
    }
  }, [fetchSales]);

  return { sales, loading, error, fetchSales, createSale, getSaleWithItems, getDailySalesSummary };
};
