import type { CartItem } from './types';

export function addItem(cart: CartItem[], item: CartItem): CartItem[] {
  const existing = cart.findIndex((entry) => entry.id === item.id);
  if (existing === -1) return [...cart, { ...item, quantity: 1, discount: 0 }];

  return cart.map((entry, index) =>
    index === existing
      ? { ...entry, quantity: Math.min(entry.quantity + 1, entry.stock) }
      : entry,
  );
}

export function setQuantity(cart: CartItem[], productId: string, quantity: number): CartItem[] {
  return cart.map((item) =>
    item.id === productId
      ? { ...item, quantity: Math.max(1, Math.min(quantity, item.stock)) }
      : item,
  );
}

export function removeItem(cart: CartItem[], productId: string): CartItem[] {
  return cart.filter((item) => item.id !== productId);
}

export function calculateClientPreviewTotal(cart: CartItem[], exchangeRate: number): number {
  return cart.reduce((total, item) => {
    const price = item.sellingPrice * exchangeRate;
    return total + price * item.quantity * (1 - item.discount / 100);
  }, 0);
}

export function createIdempotencyKey(): string {
  return crypto.randomUUID();
}
