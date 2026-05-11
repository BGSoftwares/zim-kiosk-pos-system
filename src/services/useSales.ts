import { useState, useCallback } from 'react';
import { supabase } from './supabase';

export interface Sale {
  id: string;
  sale_date: string;
  total_amount: number;
  payment_method: 'cash' | 'card' | 'mobile' | 'credit';
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

export const useSales = () => {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all sales
  const fetchSales = useCallback(async (filters?: { start_date?: string; end_date?: string; branch_id?: string }) => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('sales')
        .select('*')
        .order('sale_date', { ascending: false });

      if (filters?.start_date) {
        query = query.gte('sale_date', filters.start_date);
      }
      if (filters?.end_date) {
        query = query.lte('sale_date', filters.end_date);
      }
      if (filters?.branch_id) {
        query = query.eq('branch_id', filters.branch_id);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setSales(data || []);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a sale with items
  const createSale = useCallback(async (
    sale: Omit<Sale, 'id'>,
    items: Omit<SaleItem, 'id' | 'sale_id'>[]
  ) => {
    setLoading(true);
    setError(null);
    try {
      // Create the sale
      const { data: saleData, error: saleErr } = await supabase
        .from('sales')
        .insert([sale])
        .select()
        .single();

      if (saleErr) throw saleErr;

      // Create sale items
      const itemsWithSaleId = items.map(item => ({
        ...item,
        sale_id: saleData.id,
      }));

      const { error: itemsErr } = await supabase
        .from('sale_items')
        .insert(itemsWithSaleId);

      if (itemsErr) throw itemsErr;

      // Update stock for each item
      for (const item of items) {
        const { data: product } = await supabase
          .from('products')
          .select('stock')
          .eq('id', item.product_id)
          .single();

        if (product) {
          const newStock = product.stock - item.quantity;
          await supabase
            .from('products')
            .update({ stock: newStock })
            .eq('id', item.product_id);

          // Log stock transaction
          await supabase
            .from('stock_transactions')
            .insert([{
              product_id: item.product_id,
              transaction_type: 'sale',
              quantity_change: -item.quantity,
              reference_id: saleData.id,
              notes: `Sale transaction`,
            }]);
        }
      }

      return saleData;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create sale');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  // Get sale with items
  const getSaleWithItems = useCallback(async (saleId: string) => {
    try {
      const { data: sale, error: saleErr } = await supabase
        .from('sales')
        .select('*')
        .eq('id', saleId)
        .single();

      if (saleErr) throw saleErr;

      const { data: items, error: itemsErr } = await supabase
        .from('sale_items')
        .select('*')
        .eq('sale_id', saleId);

      if (itemsErr) throw itemsErr;

      return { sale, items };
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sale details');
      return null;
    }
  }, []);

  // Get daily sales summary
  const getDailySalesSummary = useCallback(async (date: string, branchId?: string) => {
    try {
      let query = supabase
        .from('sales')
        .select('total_amount, payment_method')
        .gte('sale_date', `${date}T00:00:00`)
        .lte('sale_date', `${date}T23:59:59`);

      if (branchId) {
        query = query.eq('branch_id', branchId);
      }

      const { data, error: err } = await query;
      if (err) throw err;

      const summary = {
        totalSales: 0,
        totalItems: 0,
        byPaymentMethod: {} as Record<string, number>,
      };

      data?.forEach(sale => {
        summary.totalSales += sale.total_amount;
        summary.byPaymentMethod[sale.payment_method] = 
          (summary.byPaymentMethod[sale.payment_method] || 0) + sale.total_amount;
      });

      return summary;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sales summary');
      return null;
    }
  }, []);

  return {
    sales,
    loading,
    error,
    fetchSales,
    createSale,
    getSaleWithItems,
    getDailySalesSummary,
  };
};
