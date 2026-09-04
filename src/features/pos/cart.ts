import type { CartItem, PosProduct } from './types';

export function addItem(cart: CartItem[], product: PosProduct): CartItem[] {
  if (product.stock <= 0) return cart;
  const existing = cart.findIndex((entry) => entry.id === product.id);
  if (existing === -1) return [...cart, { ...product, quantity: 1, discount: 0 }];
  return cart.map((entry, index) => index === existing
    ? { ...entry, quantity: Math.min(entry.quantity + 1, product.stock) }
    : entry);
}

export function setQuantity(cart: CartItem[], productId: string, quantity: number): CartItem[] {
  return cart.flatMap((item) => {
    if (item.id !== productId) return [item];
    const next = Math.min(Math.max(Math.floor(quantity), 0), item.stock);
    return next === 0 ? [] : [{ ...item, quantity: next }];
  });
}

export function removeItem(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((item) => item.id !== productId);
}

/** UI-only estimate. Django remains authoritative for checkout totals. */
export function calculateClientPreviewTotal(cart: CartItem[], exchangeRate: number): number {
  return cart.reduce((total, item) => {
    const price = item.sellingPrice * exchangeRate;
    return total + price * item.quantity * (1 - item.discount / 100);
  }, 0);
}

export function createIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
