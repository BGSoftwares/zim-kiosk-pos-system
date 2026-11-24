import type { Role } from './lib/roles';

export interface Product {
  id: string;
  name: string;
  barcode: string;
  sku: string;
  buyingPrice: number;
  sellingPrice: number;
  wholesalePrice: number;
  stock: number;
  reorderLevel: number;
  category: string;
  supplier: string;
  expiryDate?: string;
}

export interface CartItem extends Product {
  quantity: number;
  discount: number;
}

export interface SaleItem {
  name: string;
  quantity: number;
  price: number;
  total: number;
}

export interface Sale {
  id: string;
  date: string;
  items: SaleItem[];
  total: number; // in the sale's own currency
  totalUsd: number; // always USD, used for reports
  paymentMethod: string;
  currency: string;
  cashier: string;
  branch: string;
  customerPhone?: string;
  cashReceived?: number;
  branchId: string;
  cashierId: string;
}

export interface Debtor {
  id: string;
  name: string;
  phone: string;
  address: string;
  nationalId: string;
  totalOwed: number; // USD
  lastPayment: string;
  notes: string;
  branchId: string;
}

export interface Branch {
  id: string;
  name: string;
  location: string;
}

export interface Profile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  branchId: string | null;
  active: boolean;
}

export type Currency = 'USD' | 'ZiG' | 'ZAR';
export type ExchangeRates = { ZiG: number; ZAR: number };
