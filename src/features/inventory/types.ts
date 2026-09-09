export interface Product {
  id: string;
  name: string;
  barcode: string | null;
  sku: string;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  unit: string;
  stock: number;
  reorderLevel: number;
  category?: string;
  supplier?: string;
  expiryDate?: string;
}

export interface ProductPayload {
  sku: string;
  barcode?: string | null;
  name: string;
  categoryId?: number | null;
  costPrice: number;
  sellingPrice: number;
  taxRate: number;
  unit: string;
}
