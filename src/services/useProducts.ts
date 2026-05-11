import { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabase';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  buying_price: number;
  selling_price: number;
  wholesale_price: number;
  stock: number;
  reorder_level: number;
  category: string;
  supplier: string;
  expiry_date?: string;
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch all products
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from('products')
        .select('*')
        .order('name');
      if (err) throw err;
      setProducts(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch product by barcode
  const getProductByBarcode = useCallback(async (barcode: string) => {
    try {
      const { data, error: err } = await supabase
        .from('products')
        .select('*')
        .eq('barcode', barcode)
        .single();
      if (err) throw err;
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product not found');
      return null;
    }
  }, []);

  // Create product
  const createProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    try {
      const { data, error: err } = await supabase
        .from('products')
        .insert([product])
        .select()
        .single();
      if (err) throw err;
      await fetchProducts();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      return null;
    }
  }, [fetchProducts]);

  // Update product
  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      const { data, error: err } = await supabase
        .from('products')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      await fetchProducts();
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      return null;
    }
  }, [fetchProducts]);

  // Delete product
  const deleteProduct = useCallback(async (id: string) => {
    try {
      const { error: err } = await supabase
        .from('products')
        .delete()
        .eq('id', id);
      if (err) throw err;
      await fetchProducts();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      return false;
    }
  }, [fetchProducts]);

  // Update product stock
  const updateStock = useCallback(async (id: string, newStock: number) => {
    try {
      const { data, error: err } = await supabase
        .from('products')
        .update({ stock: newStock })
        .eq('id', id)
        .select()
        .single();
      if (err) throw err;
      
      // Update local state
      setProducts(products.map(p => p.id === id ? data : p));
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update stock');
      return null;
    }
  }, [products]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    fetchProducts,
    getProductByBarcode,
    createProduct,
    updateProduct,
    deleteProduct,
    updateStock,
  };
};
