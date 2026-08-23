export type Currency = 'USD' | 'ZiG' | 'ZAR';

export interface CartItem {
  id: string;
  name: string;
  barcode?: string | null;
  sku: string;
  sellingPrice: number;
  stock: number;
  quantity: number;
  discount: number;
}

export interface CheckoutPayment {
  method: 'Cash' | 'EcoCash' | 'Card' | 'Bank Transfer' | 'Debt';
  amount: number;
  currency: Currency;
  reference?: string;
}

export interface CheckoutRequest {
  branchId: string;
  currency: Currency;
  exchangeRate: number;
  items: Array<{ productId: string; quantity: number; discount: number }>;
  payments: CheckoutPayment[];
  idempotencyKey: string;
  customerPhone?: string;
}
