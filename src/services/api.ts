import { supabase } from './supabase';
import { toProfile } from './auth';
import type { Role } from '../lib/roles';
import type { Branch, Debtor, ExchangeRates, Product, Profile, Sale } from '../types';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Supabase errors are plain objects, not Error instances.
export const errMsg = (e: unknown): string =>
  (e && typeof e === 'object' && 'message' in e ? String((e as any).message) : null) || 'Something went wrong';

// ---- payment method names: UI label <-> database value -------------------
const PAYMENT_TO_DB: Record<string, string> = {
  Cash: 'cash', EcoCash: 'ecocash', Card: 'card', 'Bank Transfer': 'bank_transfer', Debt: 'credit',
};
const PAYMENT_FROM_DB: Record<string, string> = {
  cash: 'Cash', ecocash: 'EcoCash', card: 'Card', bank_transfer: 'Bank Transfer', credit: 'Debt', mobile: 'EcoCash',
};
export const PAYMENT_METHODS = Object.keys(PAYMENT_TO_DB);

// ---- mappers -------------------------------------------------------------
const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

const toProduct = (r: any): Product => ({
  id: r.id, name: r.name, barcode: r.barcode, sku: r.sku,
  buyingPrice: num(r.buying_price), sellingPrice: num(r.selling_price), wholesalePrice: num(r.wholesale_price),
  stock: num(r.stock), reorderLevel: num(r.reorder_level),
  category: r.category, supplier: r.supplier, expiryDate: r.expiry_date ?? undefined,
});

const toDebtor = (r: any): Debtor => ({
  id: r.id, name: r.name, phone: r.phone, address: r.address ?? '', nationalId: r.national_id ?? '',
  totalOwed: num(r.total_owed), lastPayment: r.last_payment ? String(r.last_payment).slice(0, 10) : '—',
  notes: r.notes ?? '', branchId: r.branch_id,
});

const toSale = (r: any): Sale => ({
  id: r.id,
  date: r.sale_date,
  items: (r.sale_items ?? []).map((i: any) => ({
    name: i.products?.name ?? 'Deleted product', quantity: num(i.quantity),
    price: num(i.unit_price), total: num(i.subtotal),
  })),
  total: num(r.total_amount),
  totalUsd: r.total_usd === null || r.total_usd === undefined ? num(r.total_amount) : num(r.total_usd),
  paymentMethod: PAYMENT_FROM_DB[r.payment_method] ?? r.payment_method,
  currency: r.currency,
  cashier: r.profiles?.full_name ?? 'Unknown',
  branch: r.branches?.name ?? '',
  customerPhone: r.customer_phone ?? undefined,
  branchId: r.branch_id ?? '',
  cashierId: r.cashier_id ?? '',
});

// ---- reads ---------------------------------------------------------------
export async function fetchBranches(): Promise<Branch[]> {
  const { data, error } = await supabase.from('branches').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map((b: any) => ({ id: b.id, name: b.name, location: b.location ?? '' }));
}

export async function fetchProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(toProduct);
}

export async function fetchSales(limit = 1000): Promise<Sale[]> {
  const { data, error } = await supabase
    .from('sales')
    .select(
      'id, sale_date, total_amount, total_usd, payment_method, currency, customer_phone, cashier_id, branch_id,' +
      ' profiles:cashier_id(full_name), branches:branch_id(name),' +
      ' sale_items(quantity, unit_price, subtotal, products(name))'
    )
    .order('sale_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map(toSale);
}

export async function fetchDebtors(): Promise<Debtor[]> {
  const { data, error } = await supabase.from('debtors').select('*').order('name');
  if (error) throw error;
  return (data ?? []).map(toDebtor);
}

export async function fetchStaff(): Promise<Profile[]> {
  const { data, error } = await supabase.from('profiles').select('*').order('full_name');
  if (error) throw error;
  return (data ?? []).map((r: any) => toProfile(r));
}

export async function fetchExchangeRates(): Promise<ExchangeRates> {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', 'exchange_rates').maybeSingle();
  if (error) throw error;
  const v = (data?.value ?? {}) as Partial<ExchangeRates>;
  return { ZiG: num(v.ZiG), ZAR: num(v.ZAR) };
}

// ---- writes --------------------------------------------------------------
export async function saveExchangeRates(rates: ExchangeRates): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key: 'exchange_rates', value: rates, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function saveProduct(
  product: Product,
  opts: { isNew: boolean; previousStock?: number; userId: string }
): Promise<void> {
  const row = {
    name: product.name, barcode: product.barcode, sku: product.sku,
    buying_price: product.buyingPrice, selling_price: product.sellingPrice, wholesale_price: product.wholesalePrice,
    stock: product.stock, reorder_level: product.reorderLevel,
    category: product.category, supplier: product.supplier, expiry_date: product.expiryDate ?? null,
    updated_at: new Date().toISOString(),
  };

  let productId = product.id;
  if (opts.isNew) {
    const { data, error } = await supabase.from('products').insert([row]).select('id').single();
    if (error) throw error;
    productId = data.id;
  } else {
    const { error } = await supabase.from('products').update(row).eq('id', product.id);
    if (error) throw error;
  }

  // Keep an audit trail of manual stock changes.
  const delta = product.stock - (opts.isNew ? 0 : opts.previousStock ?? product.stock);
  if (delta !== 0) {
    await supabase.from('stock_transactions').insert([{
      product_id: productId,
      transaction_type: opts.isNew ? 'purchase' : 'adjustment',
      quantity_change: delta,
      notes: opts.isNew ? 'Opening stock' : 'Manual stock edit',
      created_by: opts.userId,
    }]);
  }
}

export async function deleteProduct(id: string): Promise<void> {
  const { error } = await supabase.from('products').delete().eq('id', id);
  if (error) {
    // products used in past sales cannot be deleted (history must stay intact)
    if ((error as any).code === '23503') throw new Error('This product has sales history and cannot be deleted.');
    throw error;
  }
}

export async function createSale(args: {
  paymentMethod: string;
  currency: string;
  items: { product_id: string; quantity: number; discount: number }[];
  customerPhone?: string;
  customerName?: string;
  branchId?: string;
}): Promise<{ id: string; date: string; total: number; totalUsd: number }> {
  const { data, error } = await supabase.rpc('create_sale', {
    p_payment_method: PAYMENT_TO_DB[args.paymentMethod] ?? args.paymentMethod,
    p_currency: args.currency,
    p_items: args.items,
    p_customer_phone: args.customerPhone || null,
    p_customer_name: args.customerName || null,
    p_branch_id: args.branchId || null,
  });
  if (error) throw error;
  return { id: data.id, date: data.sale_date, total: num(data.total_amount), totalUsd: num(data.total_usd) };
}

export async function createDebtor(d: {
  name: string; phone: string; address: string; nationalId: string; notes: string; branchId: string;
}): Promise<void> {
  const { error } = await supabase.from('debtors').insert([{
    name: d.name, phone: d.phone, address: d.address || null,
    national_id: d.nationalId || null, notes: d.notes || null, branch_id: d.branchId, total_owed: 0,
  }]);
  if (error) {
    if ((error as any).code === '23505') throw new Error('A debtor with that national ID already exists.');
    throw error;
  }
}

export async function recordDebtorPayment(debtorId: string, amountUsd: number, reference?: string): Promise<void> {
  const { error } = await supabase.rpc('record_debtor_payment', {
    p_debtor_id: debtorId, p_amount: amountUsd, p_reference: reference || null,
  });
  if (error) throw error;
}

export async function updateStaff(
  id: string,
  updates: { role?: Role; branchId?: string | null; active?: boolean; fullName?: string }
): Promise<void> {
  const row: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.role !== undefined) row.role = updates.role;
  if (updates.branchId !== undefined) row.branch_id = updates.branchId;
  if (updates.active !== undefined) row.active = updates.active;
  if (updates.fullName !== undefined) row.full_name = updates.fullName;
  const { error } = await supabase.from('profiles').update(row).eq('id', id);
  if (error) throw error;
}
