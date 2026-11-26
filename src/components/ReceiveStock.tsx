import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Minus, PackagePlus, Plus, Trash2, X } from 'lucide-react';
import BarcodeScanner from './BarcodeScanner';
import { scanFeedback, type ScanKind } from '../lib/scanFeedback';
import { useBarcodeWedge } from '../lib/useBarcodeWedge';
import * as api from '../services/api';
import type { Product } from '../types';

interface Props {
  products: Product[];
  userId: string;
  onClose: () => void;
  /** Reload products in the parent after anything is saved. */
  onChanged: () => Promise<void>;
}

const emptyNew = { name: '', sellingPrice: '', buyingPrice: '', quantity: '1', category: '' };

/**
 * Scan-to-receive: every scan of a known barcode adds one unit to the pending delivery;
 * an unknown barcode opens a short "new product" form. Nothing touches stock until Save.
 */
export default function ReceiveStock({ products, userId, onClose, onChanged }: Props) {
  const [lines, setLines] = useState<Record<string, number>>({});
  const [order, setOrder] = useState<string[]>([]);
  const [last, setLast] = useState<{ kind: ScanKind; text: string } | null>(null);
  const [unknownCode, setUnknownCode] = useState<string | null>(null);
  const [form, setForm] = useState(emptyNew);
  const [saving, setSaving] = useState(false);

  // Scans arrive from long-lived callbacks, so always read the latest products.
  const productsRef = useRef(products);
  productsRef.current = products;
  const linesRef = useRef(lines);
  linesRef.current = lines;

  const handleScan = useCallback((raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const product = productsRef.current.find(p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());

    if (!product) {
      scanFeedback('warn');
      setLast({ kind: 'warn', text: `New barcode ${code} — add it as a product` });
      setForm(emptyNew);
      setUnknownCode(code);
      return;
    }

    const next = (linesRef.current[product.id] ?? 0) + 1;
    linesRef.current = { ...linesRef.current, [product.id]: next };
    setLines(linesRef.current);
    setOrder(o => (o.includes(product.id) ? o : [...o, product.id]));
    scanFeedback('ok');
    setLast({ kind: 'ok', text: `${product.name} — adding ${next} (stock ${product.stock} → ${product.stock + next})` });
  }, []);

  useBarcodeWedge(handleScan, unknownCode === null);

  const setQty = (id: string, qty: number) => {
    const safe = Math.max(1, Math.min(100000, Math.floor(qty) || 1));
    linesRef.current = { ...linesRef.current, [id]: safe };
    setLines(linesRef.current);
  };
  const removeLine = (id: string) => {
    const { [id]: _removed, ...rest } = linesRef.current;
    void _removed;
    linesRef.current = rest;
    setLines(rest);
    setOrder(o => o.filter(x => x !== id));
  };

  const totalUnits = order.reduce((a, id) => a + (lines[id] ?? 0), 0);

  const createProduct = async () => {
    if (!unknownCode || saving) return;
    const price = parseFloat(form.sellingPrice);
    const qty = parseInt(form.quantity, 10);
    if (!form.name.trim()) return void toast.error('Enter the product name');
    if (!(price > 0)) return void toast.error('Selling price must be greater than 0');
    if (!Number.isInteger(qty) || qty < 1) return void toast.error('Quantity received must be 1 or more');

    setSaving(true);
    try {
      await api.saveProduct(
        {
          id: '',
          name: form.name.trim(),
          barcode: unknownCode,
          sku: form.name.trim().slice(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-5),
          buyingPrice: parseFloat(form.buyingPrice) || 0,
          sellingPrice: price,
          wholesalePrice: Math.round(price * 0.85 * 100) / 100,
          stock: qty,
          reorderLevel: 10,
          category: form.category.trim() || 'General',
          supplier: 'Unspecified',
        },
        { isNew: true, userId }
      );
      await onChanged();
      scanFeedback('ok');
      setLast({ kind: 'ok', text: `${form.name.trim()} created with ${qty} in stock` });
      toast.success(`${form.name.trim()} added to inventory`);
      setUnknownCode(null);
    } catch (e) {
      toast.error(api.errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const saveStock = async () => {
    if (saving || order.length === 0) return;
    setSaving(true);
    try {
      const units = await api.receiveStock(order.map(id => ({ product_id: id, quantity: lines[id] })));
      await onChanged();
      toast.success(`Stock updated: ${units} unit${units === 1 ? '' : 's'} added to ${order.length} product${order.length === 1 ? '' : 's'}`);
      onClose();
    } catch (e) {
      toast.error(api.errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const tone = (k: ScanKind) =>
    k === 'ok' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
      : k === 'warn' ? 'bg-orange-950/70 border-orange-800 text-orange-300'
        : 'bg-red-950/70 border-red-800 text-red-300';

  return (
    <div role="dialog" aria-label="Receive stock" className="fixed inset-0 z-[90] bg-slate-950 overflow-auto">
      <div className="max-w-2xl mx-auto p-4 sm:p-6 pb-32">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-2xl font-semibold tracking-tight flex items-center gap-2"><PackagePlus size={24} /> Receive Stock</div>
            <div className="text-sm text-slate-400">Scan each item that arrived. Scan the same barcode again for more.</div>
          </div>
          <button onClick={onClose} aria-label="Close receive stock" className="p-2 rounded-xl hover:bg-slate-900"><X /></button>
        </div>

        {unknownCode === null ? (
          <BarcodeScanner onScan={handleScan} />
        ) : (
          <div className="rounded-3xl border border-orange-800 bg-slate-900 p-5" data-testid="new-product-form">
            <div className="font-semibold text-lg mb-1">New product</div>
            <div className="text-sm text-slate-400 mb-4">Barcode <span className="font-mono text-slate-200">{unknownCode}</span> is not in your inventory yet.</div>
            <div className="grid grid-cols-2 gap-3 text-xs text-slate-400">
              <label className="col-span-2">Product name
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} autoFocus className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
              </label>
              <label>Selling price (USD)
                <input type="number" inputMode="decimal" min="0" step="any" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
              </label>
              <label>Buying price (USD)
                <input type="number" inputMode="decimal" min="0" step="any" value={form.buyingPrice} onChange={e => setForm({ ...form, buyingPrice: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
              </label>
              <label>Quantity received
                <input type="number" inputMode="numeric" min="1" step="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
              </label>
              <label>Category
                <input value={form.category} placeholder="General" onChange={e => setForm({ ...form, category: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
              </label>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setUnknownCode(null)} className="flex-1 py-3 rounded-2xl border border-slate-700">Skip</button>
              <button disabled={saving} onClick={createProduct} className="flex-1 py-3 rounded-2xl bg-sky-600 disabled:bg-slate-700 font-medium">{saving ? 'Saving…' : 'Create product'}</button>
            </div>
          </div>
        )}

        {last && (
          <div role="status" data-testid="last-scan" className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${tone(last.kind)}`}>{last.text}</div>
        )}

        <div className="mt-5">
          <div className="text-sm text-slate-400 mb-2">Delivery ({order.length} product{order.length === 1 ? '' : 's'}, {totalUnits} unit{totalUnits === 1 ? '' : 's'})</div>
          {order.length === 0 && <div className="text-center text-slate-500 py-8 border border-dashed border-slate-800 rounded-2xl">Nothing scanned yet.</div>}
          <div className="space-y-2">
            {order.map(id => {
              const p = products.find(x => x.id === id);
              if (!p) return null;
              return (
                <div key={id} data-testid={`receive-line-${p.barcode}`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-xs text-slate-400">In stock {p.stock} → <span className="text-emerald-300">{p.stock + (lines[id] ?? 0)}</span></div>
                  </div>
                  <button aria-label={`Less ${p.name}`} onClick={() => setQty(id, (lines[id] ?? 1) - 1)} className="p-2 rounded-xl bg-slate-800"><Minus size={16} /></button>
                  <input aria-label={`Quantity ${p.name}`} type="number" inputMode="numeric" min="1" value={lines[id] ?? 1} onChange={e => setQty(id, parseInt(e.target.value, 10))} className="w-16 text-center bg-slate-950 border border-slate-700 rounded-xl py-2" />
                  <button aria-label={`More ${p.name}`} onClick={() => setQty(id, (lines[id] ?? 1) + 1)} className="p-2 rounded-xl bg-slate-800"><Plus size={16} /></button>
                  <button aria-label={`Remove ${p.name}`} onClick={() => removeLine(id)} className="p-2 text-red-400"><Trash2 size={16} /></button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4">
        <div className="max-w-2xl mx-auto flex gap-3">
          <button onClick={onClose} className="px-5 py-3.5 rounded-2xl border border-slate-700">Cancel</button>
          <button disabled={saving || order.length === 0} onClick={saveStock} className="flex-1 py-3.5 rounded-2xl bg-emerald-600 disabled:bg-slate-700 font-semibold">
            {saving ? 'Saving…' : `Save stock (${totalUnits} unit${totalUnits === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>
    </div>
  );
}
