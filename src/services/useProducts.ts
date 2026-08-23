import { useCallback, useEffect, useState } from 'react';
import { api } from './api/client';

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

type ApiProduct = {
  id: number;
  name: string;
  sku: string;
  barcode: string | null;
  cost_price: string;
  selling_price: string;
  category: number | null;
};

type ProductPayload = {
  sku: string;
  barcode?: string | null;
  name: string;
  cost_price: number;
  selling_price: number;
  category?: number | null;
};

function normalizeProduct(product: ApiProduct): Product {
  return {
    id: String(product.id),
    name: product.name,
    barcode: product.barcode || '',
    sku: product.sku,
    buying_price: Number(product.cost_price),
    selling_price: Number(product.selling_price),
    wholesale_price: Number(product.selling_price),
    stock: 0,
    reorder_level: 0,
    category: product.category ? String(product.category) : '',
    supplier: '',
  };
}

export const useProducts = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get<ApiProduct[] | { results: ApiProduct[] }>('/products/');
      const rows = Array.isArray(data) ? data : data.results;
      setProducts(rows.map(normalizeProduct));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch products');
    } finally {
      setLoading(false);
    }
  }, []);

  const getProductByBarcode = useCallback(async (barcode: string) => {
    try {
      const data = await api.get<ApiProduct[] | { results: ApiProduct[] }>(`/products/?barcode=${encodeURIComponent(barcode)}`);
      const rows = Array.isArray(data) ? data : data.results;
      return rows[0] ? normalizeProduct(rows[0]) : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Product not found');
      return null;
    }
  }, []);

  const createProduct = useCallback(async (product: Omit<Product, 'id'>) => {
    try {
      const payload: ProductPayload = {
        sku: product.sku,
        barcode: product.barcode || null,
        name: product.name,
        cost_price: product.buying_price,
        selling_price: product.selling_price,
        category: product.category ? Number(product.category) : null,
      };
      const data = await api.post<ApiProduct>('/products/', payload);
      const normalized = normalizeProduct(data);
      setProducts(current => [...current, normalized].sort((a, b) => a.name.localeCompare(b.name)));
      return normalized;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create product');
      return null;
    }
  }, []);

  const updateProduct = useCallback(async (id: string, updates: Partial<Product>) => {
    try {
      const payload: Partial<ProductPayload> = {};
      if (updates.name !== undefined) payload.name = updates.name;
      if (updates.sku !== undefined) payload.sku = updates.sku;
      if (updates.barcode !== undefined) payload.barcode = updates.barcode || null;
      if (updates.buying_price !== undefined) payload.cost_price = updates.buying_price;
      if (updates.selling_price !== undefined) payload.selling_price = updates.selling_price;
      if (updates.category !== undefined) payload.category = updates.category ? Number(updates.category) : null;

      const data = await api.patch<ApiProduct>(`/products/${id}/`, payload);
      const normalized = normalizeProduct(data);
      setProducts(current => current.map(product => product.id === id ? { ...product, ...normalized } : product));
      return normalized;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update product');
      return null;
    }
  }, []);

  const deleteProduct = useCallback(async (id: string) => {
    try {
      await api.delete(`/products/${id}/`);
      setProducts(current => current.filter(product => product.id !== id));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete product');
      return false;
    }
  }, []);

  const updateStock = useCallback(async (_id: string, _newStock: number) => {
    setError('Stock is managed by the Django inventory API and cannot be changed through products.');
    return null;
  }, []);

  useEffect(() => {
    void fetchProducts();
  }, [fetchProducts]);

  return { products, loading, error, fetchProducts, getProductByBarcode, createProduct, updateProduct, deleteProduct, updateStock };
};
