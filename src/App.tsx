import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Home, ShoppingCart, Package, Users, TrendingUp, Settings,
  LogOut, ScanLine, Plus, Minus, Trash2, Download,
  Phone, AlertTriangle, Loader2, RefreshCw, X, PackagePlus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { toast } from 'sonner';
import { format, subDays } from 'date-fns';
import { AuthProvider, useAuth } from './context/AuthContext';
import LoginScreen from './LoginScreen';
import BarcodeScanner from './components/BarcodeScanner';
import ReceiveStock from './components/ReceiveStock';
import { scanFeedback, type ScanKind } from './lib/scanFeedback';
import { useBarcodeWedge } from './lib/useBarcodeWedge';
import { can, canAccessTab, maxDiscount, ROLES, ROLE_LABELS, TAB_ACCESS, type Role, type Tab } from './lib/roles';
import * as api from './services/api';
import type { Branch, CartItem, Currency, Debtor, ExchangeRates, Product, Profile, Sale } from './types';

// Helpers
const loadStored = <T,>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
};

const escapeHtml = (value: unknown) =>
  String(value ?? '').replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));

const csvCell = (value: unknown) => {
  let text = String(value ?? '');
  if (/^[=+\-@]/.test(text)) text = "'" + text; // block spreadsheet formula injection
  return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
};

const downloadCsv = (filename: string, rows: unknown[][]) => {
  const csv = rows.map(r => r.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

const NAV_ITEMS: { id: Tab; label: string; icon: typeof Home }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: Home },
  { id: 'pos', label: 'Smart POS', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'debtors', label: 'Debtors', icon: Users },
  { id: 'reports', label: 'Reports', icon: TrendingUp },
  { id: 'staff', label: 'Staff', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const symbolFor = (currency: string) => (currency === 'USD' ? '$' : currency === 'ZiG' ? 'ZiG' : 'R');
const round2 = (n: number) => Math.round(n * 100) / 100;
const PAYMENT_COLORS: Record<string, string> = {
  Cash: '#0ea5e9', EcoCash: '#22c55e', Card: '#eab308', 'Bank Transfer': '#a855f7', Debt: '#f97316',
};

const emptyProductForm = {
  name: '', barcode: '', sku: '', buyingPrice: 0, sellingPrice: 0, wholesalePrice: 0,
  stock: 0, reorderLevel: 10, category: '', supplier: '', expiryDate: '',
};
const emptyDebtorForm = { name: '', phone: '', address: '', nationalId: '', notes: '' };

// Main App Component (only rendered for a signed-in, active user)
function ZIMKioskApp({ profile }: { profile: Profile }) {
  const { logout: signOut } = useAuth();
  const role: Role = profile.role;

  // Live data from the database
  const [branches, setBranches] = useState<Branch[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>([]);
  const [staff, setStaff] = useState<Profile[]>([]);
  const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({ ZiG: 0, ZAR: 0 });
  const [rateDraft, setRateDraft] = useState({ ZiG: '', ZAR: '' });
  const [dataLoading, setDataLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [currentBranch, setCurrentBranch] = useState(profile.branchId ?? '');
  const [currentCurrency, setCurrentCurrency] = useState<Currency>(() => loadStored<Currency>('zimkiosk_currency', 'USD'));

  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [cashReceived, setCashReceived] = useState(0);
  const [receiptSuccess, setReceiptSuccess] = useState(false);

  // Other States
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [lastScan, setLastScan] = useState<{ kind: ScanKind; text: string } | null>(null);
  const [showReceive, setShowReceive] = useState(false);
  const cartRef = useRef<CartItem[]>([]);
  const [newProduct, setNewProduct] = useState(emptyProductForm);
  const [showAddDebtor, setShowAddDebtor] = useState(false);
  const [debtorForm, setDebtorForm] = useState(emptyDebtorForm);
  const [payingDebtor, setPayingDebtor] = useState<Debtor | null>(null);
  const [payAmount, setPayAmount] = useState('');

  // What this role may see and do (the database enforces the same rules)
  const canSeeSales = role !== 'storekeeper';
  const canSeeDebtors = canAccessTab(role, 'debtors');
  const canEditInventory = can(role, 'editInventory');
  const canDeleteProducts = can(role, 'deleteProduct');
  const canManageDebtors = can(role, 'manageDebtors');
  const canEditRates = can(role, 'editExchangeRates');
  const canManageStaff = can(role, 'manageStaff');
  const canSwitchBranch = can(role, 'switchBranch');
  const visibleTabs = (Object.keys(TAB_ACCESS) as Tab[]).filter(t => canAccessTab(role, t));

  const goTo = (tab: Tab) => {
    if (canAccessTab(role, tab)) setActiveTab(tab);
  };

  // ---- data loading ----
  const refreshProducts = useCallback(async () => setProducts(await api.fetchProducts()), []);
  const refreshSales = useCallback(async () => {
    if (role !== 'storekeeper') setSales(await api.fetchSales());
  }, [role]);
  const refreshDebtors = useCallback(async () => {
    if (canAccessTab(role, 'debtors')) setDebtors(await api.fetchDebtors());
  }, [role]);
  const refreshStaff = useCallback(async () => {
    if (canAccessTab(role, 'staff')) setStaff(await api.fetchStaff());
  }, [role]);

  const loadAll = useCallback(async () => {
    setLoadError(null);
    try {
      const [b, r] = await Promise.all([api.fetchBranches(), api.fetchExchangeRates()]);
      setBranches(b);
      setExchangeRates(r);
      setRateDraft({ ZiG: r.ZiG ? String(r.ZiG) : '', ZAR: r.ZAR ? String(r.ZAR) : '' });
      await Promise.all([refreshProducts(), refreshSales(), refreshDebtors(), refreshStaff()]);
    } catch (e) {
      setLoadError(api.errMsg(e));
    } finally {
      setDataLoading(false);
    }
  }, [refreshProducts, refreshSales, refreshDebtors, refreshStaff]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Admins without a home branch start on the first branch.
  useEffect(() => {
    if (!currentBranch && branches.length > 0) setCurrentBranch(branches[0].id);
  }, [currentBranch, branches]);

  useEffect(() => {
    localStorage.setItem('zimkiosk_currency', JSON.stringify(currentCurrency));
  }, [currentCurrency]);

  // A currency with no exchange rate yet cannot be used.
  useEffect(() => {
    if (currentCurrency !== 'USD' && !(exchangeRates[currentCurrency] > 0)) setCurrentCurrency('USD');
  }, [currentCurrency, exchangeRates]);

  // Offline detection: sales need the database, so reload when the connection returns.
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online', { duration: 2000 });
      loadAll();
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('You are offline. Sales cannot be saved until the connection returns.', { duration: 4000 });
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [loadAll]);

  const branchName = branches.find(b => b.id === currentBranch)?.name ?? '';

  // Helper: Convert price to current currency
  const convertPrice = (priceUSD: number) => {
    if (currentCurrency === 'USD') return priceUSD;
    return round2(priceUSD * exchangeRates[currentCurrency]);
  };

  const currencySymbol = symbolFor(currentCurrency);

  // Filtered Products for POS
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode.includes(searchTerm) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cart Calculations (same rounding as the database function)
  const cartTotal = cart.reduce((sum, item) => {
    const unit = convertPrice(item.sellingPrice);
    return sum + round2(unit * item.quantity * (1 - item.discount / 100));
  }, 0);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // POS Functions
  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  // Reads and writes the cart through a ref so several scans in quick succession never act on stale state.
  const addToCart = (product: Product, opts: { quiet?: boolean } = {}): { kind: ScanKind; text: string } => {
    const say = (kind: ScanKind, text: string, description?: string) => {
      if (!opts.quiet) {
        if (kind === 'ok') toast.success(text, description ? { description } : undefined);
        else if (kind === 'warn') toast.warning(text);
        else toast.error(text);
      }
      return { kind, text };
    };

    if (product.stock <= 0) return say('error', `${product.name} is out of stock`);

    const current = cartRef.current;
    const existing = current.find(item => item.id === product.id);
    if (existing) {
      if (existing.quantity >= product.stock) return say('warn', `Only ${product.stock} of ${product.name} in stock`);
      const next = current.map(item => (item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item));
      cartRef.current = next;
      setCart(next);
      return say('ok', `${product.name} × ${existing.quantity + 1}`);
    }
    const next = [...current, { ...product, quantity: 1, discount: 0 }];
    cartRef.current = next;
    setCart(next);
    return say('ok', `${product.name} added to cart`, `${currencySymbol}${convertPrice(product.sellingPrice).toFixed(2)}`);
  };

  // One entry point for every kind of scan: camera, Bluetooth/USB scanner, or typed barcode.
  const handleBarcode = (raw: string) => {
    const code = raw.trim();
    if (!code) return;
    const product = products.find(p => p.barcode === code || p.sku.toLowerCase() === code.toLowerCase());

    if (!product) {
      scanFeedback('error');
      setLastScan({ kind: 'error', text: `Unknown barcode ${code}` });
      if (canEditInventory) {
        toast.error(`Unknown barcode ${code}`, {
          action: { label: 'Add product', onClick: () => { setShowScanner(false); goTo('inventory'); openAddProduct(code); } },
        });
      } else {
        toast.error(`Barcode ${code} is not in the inventory. Ask a manager to add it.`);
      }
      return;
    }

    const result = addToCart(product, { quiet: showScanner });
    scanFeedback(result.kind);
    setLastScan(result);
  };

  // Hardware scanners (USB / Bluetooth) work on the POS page without opening the camera.
  useBarcodeWedge(handleBarcode, activeTab === 'pos' && !showScanner && !showPaymentModal && !showReceipt);

  const submitSearch = () => {
    const term = searchTerm.trim();
    if (!term) return;
    const exact = products.some(p => p.barcode === term || p.sku.toLowerCase() === term.toLowerCase());
    if (exact || /^\d{6,}$/.test(term)) {
      handleBarcode(term);
      setSearchTerm('');
    }
  };

  // Update Cart Item
  const updateCartQuantity = (id: string, newQty: number) => {
    const prod = products.find(p => p.id === id);
    if (!prod) return;
    
    if (newQty > prod.stock) {
      toast.warning(`Only ${prod.stock} available`);
      return;
    }
    if (newQty < 1) return;
    
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, quantity: newQty } : item
    ));
  };

  const updateCartDiscount = (id: string, disc: number) => {
    const safe = Number.isFinite(disc) ? disc : 0;
    const limit = maxDiscount(role);
    if (safe > limit) toast.warning(`Your role can give at most ${limit}% discount`);
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, discount: Math.min(limit, Math.max(0, safe)) } : item
    ));
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.filter(item => item.id !== id));
  };

  const clearCart = () => {
    setCart([]);
  };

  // Checkout & Payment
  const initiateCheckout = () => {
    if (cart.length === 0) return;
    setShowPaymentModal(true);
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setReceiptSuccess(false);
  };

  const completeSale = async () => {
    if (cart.length === 0 || submitting) return;

    if (isOffline) {
      toast.error('You are offline. Reconnect to complete the sale.');
      return;
    }
    if (paymentMethod === 'Cash' && cashReceived < cartTotal) {
      toast.error('Insufficient cash received');
      return;
    }
    if (paymentMethod === 'Debt' && !customerPhone.trim()) {
      toast.error('Enter the customer phone number for a credit sale');
      return;
    }

    setSubmitting(true);
    try {
      // The database re-prices the items, applies the rules for this role and updates stock atomically.
      const saved = await api.createSale({
        paymentMethod,
        currency: currentCurrency,
        items: cart.map(i => ({ product_id: i.id, quantity: i.quantity, discount: i.discount })),
        customerPhone: customerPhone.trim() || undefined,
        customerName: customerName.trim() || undefined,
        branchId: currentBranch,
      });

      const newSale: Sale = {
        id: saved.id,
        date: saved.date,
        items: cart.map(item => {
          const unit = convertPrice(item.sellingPrice);
          return { name: item.name, quantity: item.quantity, price: unit, total: round2(unit * item.quantity * (1 - item.discount / 100)) };
        }),
        total: saved.total,
        totalUsd: saved.totalUsd,
        paymentMethod,
        currency: currentCurrency,
        cashier: profile.fullName,
        branch: branchName,
        customerPhone: customerPhone.trim() || undefined,
        cashReceived: paymentMethod === 'Cash' ? cashReceived : undefined,
        branchId: currentBranch,
        cashierId: profile.id,
      };

      setLastSale(newSale);
      setCart([]);
      setShowPaymentModal(false);
      setShowReceipt(true);
      setReceiptSuccess(true);
      setCustomerPhone('');
      setCustomerName('');
      setCashReceived(0);
      setPaymentMethod('Cash');
      toast.success('Sale completed successfully!', { description: `Receipt #${saved.id.slice(0, 8)}` });

      await Promise.all([refreshProducts(), refreshSales(), refreshDebtors()]);
    } catch (e) {
      toast.error(api.errMsg(e));
      refreshProducts().catch(() => {}); // stock may have changed under us
    } finally {
      setSubmitting(false);
    }
  };

  // Print Receipt
  const printReceipt = () => {
    if (!lastSale) return;
    const branchLocation = branches.find(b => b.id === lastSale.branchId)?.location ?? '';
    const printWindow = window.open('', '', 'width=380,height=650');
    if (!printWindow) return;

    const receiptHTML = `
      <html><head><title>ZIM KIOSK Receipt</title>
      <style>
        body { font-family: monospace; padding: 16px; font-size: 13px; line-height: 1.45; max-width: 320px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px dashed #111; padding-bottom: 12px; margin-bottom: 12px; }
        .shop { font-weight: 700; font-size: 20px; letter-spacing: -.5px; }
        table { width: 100%; border-collapse: collapse; margin: 12px 0; }
        td { padding: 3px 0; }
        .total { border-top: 1px solid #111; font-weight: 700; padding-top: 8px; }
        .footer { text-align: center; font-size: 10px; margin-top: 20px; border-top: 1px dashed #111; padding-top: 12px; }
      </style></head><body>
      <div class="header">
        <div class="shop">ZIM KIOSK</div>
        <div>${escapeHtml(lastSale.branch)}</div>
        <div>${escapeHtml(branchLocation)}</div>
      </div>
      <div>Receipt: ${escapeHtml(lastSale.id)}</div>
      <div>Date: ${format(new Date(lastSale.date), 'dd MMM yyyy HH:mm')}</div>
      <div>Cashier: ${escapeHtml(lastSale.cashier)}</div>
      <div>Payment: ${escapeHtml(lastSale.paymentMethod)} (${escapeHtml(lastSale.currency)})</div>
      <br/>
      <table>
        ${lastSale.items.map(item => `
          <tr><td>${escapeHtml(item.name)}</td><td style="text-align:right">${item.quantity}x</td><td style="text-align:right">${symbolFor(lastSale.currency)}${item.price.toFixed(2)}</td></tr>
          <tr><td colspan="3" style="padding-bottom:6px;font-size:11px;color:#666">Sub: ${symbolFor(lastSale.currency)}${item.total.toFixed(2)}</td></tr>
        `).join('')}
      </table>
      <div class="total">TOTAL: ${symbolFor(lastSale.currency)}${lastSale.total.toFixed(2)}</div>
      <br/>
      <div class="footer">
        Thank you for shopping at ZIM KIOSK!
      </div>
      </body></html>`;
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  // Inventory Functions
  const saveProduct = async () => {
    if (!canEditInventory || submitting) return;
    if (!newProduct.name.trim()) {
      toast.error('Product name required');
      return;
    }
    if (!(newProduct.sellingPrice > 0)) {
      toast.error('Selling price must be greater than 0');
      return;
    }
    if (!Number.isInteger(newProduct.stock) || newProduct.stock < 0) {
      toast.error('Stock must be a whole number, 0 or more');
      return;
    }

    const barcode = newProduct.barcode.trim() || '6' + Math.floor(Math.random() * 10000000000);
    const sku = newProduct.sku.trim() || newProduct.name.trim().slice(0, 3).toUpperCase() + '-' + Date.now().toString().slice(-4);
    const clash = products.find(p => p.id !== editingProduct?.id && (p.barcode === barcode || p.sku === sku));
    if (clash) {
      toast.error(`Barcode or SKU already used by "${clash.name}"`);
      return;
    }

    const productData: Product = {
      id: editingProduct ? editingProduct.id : '',
      name: newProduct.name.trim(),
      barcode,
      sku,
      buyingPrice: newProduct.buyingPrice || 0,
      sellingPrice: newProduct.sellingPrice,
      wholesalePrice: newProduct.wholesalePrice || round2(newProduct.sellingPrice * 0.85),
      stock: newProduct.stock,
      reorderLevel: newProduct.reorderLevel,
      category: newProduct.category.trim() || 'General',
      supplier: newProduct.supplier.trim() || 'Unspecified',
      expiryDate: newProduct.expiryDate || undefined,
    };

    setSubmitting(true);
    try {
      await api.saveProduct(productData, { isNew: !editingProduct, previousStock: editingProduct?.stock, userId: profile.id });
      await refreshProducts();
      toast.success(editingProduct ? 'Product updated' : 'Product added');
      setShowAddProduct(false);
      setEditingProduct(null);
      setNewProduct(emptyProductForm);
    } catch (e) {
      toast.error(api.errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const editProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name, barcode: product.barcode, sku: product.sku,
      buyingPrice: product.buyingPrice, sellingPrice: product.sellingPrice, wholesalePrice: product.wholesalePrice,
      stock: product.stock, reorderLevel: product.reorderLevel,
      category: product.category, supplier: product.supplier, expiryDate: product.expiryDate ?? '',
    });
    setShowAddProduct(true);
  };

  const openAddProduct = (barcode?: string) => {
    setEditingProduct(null);
    setNewProduct({ ...emptyProductForm, barcode: barcode ?? '' });
    setShowAddProduct(true);
  };

  const deleteProduct = async (id: string) => {
    if (!canDeleteProducts) return;
    const product = products.find(p => p.id === id);
    if (!confirm(`Delete "${product?.name ?? 'this product'}"? This cannot be undone.`)) return;
    try {
      await api.deleteProduct(id);
      await refreshProducts();
      toast.success('Product deleted');
    } catch (e) {
      toast.error(api.errMsg(e));
    }
  };

  const exportInventoryCSV = () => {
    downloadCsv('zimkiosk_inventory.csv', [
      ['name', 'barcode', 'sku', 'category', 'supplier', 'buying_price_usd', 'selling_price_usd', 'stock', 'reorder_level'],
      ...products.map(p => [p.name, p.barcode, p.sku, p.category, p.supplier, p.buyingPrice, p.sellingPrice, p.stock, p.reorderLevel]),
    ]);
  };

  // Debtors (all amounts in USD)
  const saveDebtor = async () => {
    if (!canManageDebtors || submitting) return;
    if (!debtorForm.name.trim() || !debtorForm.phone.trim()) {
      toast.error('Name and phone number are required');
      return;
    }
    setSubmitting(true);
    try {
      await api.createDebtor({
        name: debtorForm.name.trim(), phone: debtorForm.phone.trim(), address: debtorForm.address.trim(),
        nationalId: debtorForm.nationalId.trim(), notes: debtorForm.notes.trim(), branchId: currentBranch,
      });
      await refreshDebtors();
      toast.success('Debtor added');
      setShowAddDebtor(false);
      setDebtorForm(emptyDebtorForm);
    } catch (e) {
      toast.error(api.errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const submitDebtorPayment = async () => {
    if (!payingDebtor || submitting) return;
    const amount = parseFloat(payAmount);
    if (!(amount > 0)) {
      toast.error('Enter an amount greater than 0');
      return;
    }
    if (amount > payingDebtor.totalOwed) {
      toast.error(`That is more than the $${payingDebtor.totalOwed.toFixed(2)} owed`);
      return;
    }
    setSubmitting(true);
    try {
      await api.recordDebtorPayment(payingDebtor.id, amount);
      await refreshDebtors();
      toast.success(`Payment of $${amount.toFixed(2)} recorded`);
      setPayingDebtor(null);
      setPayAmount('');
    } catch (e) {
      toast.error(api.errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const openWhatsApp = (debtor: Debtor) => {
    const message = `Hello ${debtor.name.split(' ')[0]}, this is ZIM KIOSK. You have an outstanding balance of $${debtor.totalOwed.toFixed(2)}. Please pay at your earliest convenience.`;
    window.open(`https://wa.me/${debtor.phone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Settings & staff
  const saveRates = async () => {
    const zig = parseFloat(rateDraft.ZiG);
    const zar = parseFloat(rateDraft.ZAR);
    if (!(zig > 0) || !(zar > 0)) {
      toast.error('Enter an exchange rate above 0 for both currencies');
      return;
    }
    setSubmitting(true);
    try {
      const rates = { ZiG: zig, ZAR: zar };
      await api.saveExchangeRates(rates);
      setExchangeRates(rates);
      toast.success('Exchange rates saved');
    } catch (e) {
      toast.error(api.errMsg(e));
    } finally {
      setSubmitting(false);
    }
  };

  const changeStaff = async (id: string, updates: Parameters<typeof api.updateStaff>[1]) => {
    try {
      await api.updateStaff(id, updates);
      await refreshStaff();
      toast.success('Staff account updated');
    } catch (e) {
      toast.error(api.errMsg(e));
    }
  };

  // Reports: Export CSV
  const exportSalesCSV = () => {
    if (branchSales.length === 0) {
      toast.error('No sales data to export');
      return;
    }
    downloadCsv(`zimkiosk_sales_${format(new Date(), 'yyyy-MM-dd')}.csv`, [
      ['Date', 'Receipt', 'Cashier', 'Branch', 'Total', 'Currency', 'Total (USD)', 'Payment'],
      ...branchSales.map(s => [format(new Date(s.date), 'yyyy-MM-dd HH:mm'), s.id, s.cashier, s.branch, s.total, s.currency, s.totalUsd, s.paymentMethod]),
    ]);
    toast.success('Sales report exported');
  };

  const logout = async () => {
    setCart([]);
    await signOut();
    toast.info('Logged out');
  };

  // Analytics (all figures in USD so mixed-currency sales add up correctly)
  const branchSales = useMemo(
    () => sales.filter(s => !canSwitchBranch || !currentBranch || s.branchId === currentBranch),
    [sales, canSwitchBranch, currentBranch]
  );
  const branchDebtors = useMemo(
    () => debtors.filter(d => !canSwitchBranch || !currentBranch || d.branchId === currentBranch),
    [debtors, canSwitchBranch, currentBranch]
  );

  const todayKey = format(new Date(), 'yyyy-MM-dd');
  const todaySalesList = branchSales.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === todayKey);
  const todayRevenue = todaySalesList.reduce((a, s) => a + s.totalUsd, 0);
  const totalRevenue = branchSales.reduce((a, s) => a + s.totalUsd, 0);

  const salesTrendData = Array.from({ length: 7 }, (_, i) => {
    const day = subDays(new Date(), 6 - i);
    const key = format(day, 'yyyy-MM-dd');
    return {
      day: format(day, 'dd MMM'),
      revenue: round2(branchSales.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === key).reduce((a, s) => a + s.totalUsd, 0)),
    };
  });

  const paymentBreakdown = api.PAYMENT_METHODS
    .map(name => ({ name, value: round2(branchSales.filter(s => s.paymentMethod === name).reduce((a, s) => a + s.totalUsd, 0)) }))
    .filter(p => p.value > 0);

  const topSelling = useMemo(() => {
    const units = new Map<string, number>();
    branchSales.forEach(s => s.items.forEach(i => units.set(i.name, (units.get(i.name) ?? 0) + i.quantity)));
    return [...units.entries()].map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
  }, [branchSales]);

  const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);
  const outOfStock = products.filter(p => p.stock <= 0).length;
  const totalUnits = products.reduce((a, p) => a + p.stock, 0);
  const totalOwed = branchDebtors.reduce((a, d) => a + d.totalOwed, 0);

  const kpis = canSeeSales
    ? [
        { label: role === 'cashier' ? 'Your Sales Today' : "Today's Revenue", value: `$${todayRevenue.toFixed(2)}`, note: `${todaySalesList.length} sale${todaySalesList.length === 1 ? '' : 's'} today` },
        { label: role === 'cashier' ? 'Your Total Sales' : 'Total Revenue', value: `$${totalRevenue.toFixed(2)}`, note: 'All time, in USD' },
        { label: 'Transactions', value: String(branchSales.length), note: 'All time' },
        { label: 'Low Stock Alerts', value: String(lowStockItems.length), note: lowStockItems.length > 0 ? 'Action needed' : 'All stocked' },
      ]
    : [
        { label: 'Products', value: String(products.length), note: 'In the catalogue' },
        { label: 'Low Stock Alerts', value: String(lowStockItems.length), note: lowStockItems.length > 0 ? 'Action needed' : 'All stocked' },
        { label: 'Out of Stock', value: String(outOfStock), note: outOfStock > 0 ? 'Restock now' : 'None' },
        { label: 'Units in Stock', value: String(totalUnits), note: 'Across all products' },
      ];

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  if (dataLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-300 gap-3" role="status">
        <Loader2 className="animate-spin text-sky-400" size={36} />
        <div>Loading your store…</div>
      </div>
    );
  }

  if (loadError && products.length === 0 && branches.length === 0) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-center p-6 gap-4">
        <AlertTriangle className="text-orange-400" size={40} />
        <div className="text-white text-xl font-semibold">Could not load your store</div>
        <div className="text-slate-400 max-w-md text-sm">{loadError}</div>
        <div className="flex gap-3">
          <button onClick={() => { setDataLoading(true); loadAll(); }} className="px-6 py-3 rounded-2xl bg-sky-600 text-white font-medium flex items-center gap-2"><RefreshCw size={16} /> Try again</button>
          <button onClick={logout} className="px-6 py-3 rounded-2xl bg-slate-800 text-slate-200">Sign out</button>
        </div>
      </div>
    );
  }

  // Main Application UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/95 backdrop-blur-lg z-50 flex items-center px-3 sm:px-6 sticky top-0">
        <div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <span className="font-black text-white text-xl tracking-tighter">ZK</span>
            </div>
            <div className="hidden sm:block">
              <div className="font-semibold text-xl tracking-[-0.6px]">ZIM KIOSK</div>
              <div className="text-[10px] text-sky-400 -mt-1">ZIMBABWE SMART POS</div>
            </div>
          </div>

          {/* Branch: admins can switch, everyone else is fixed to their own branch */}
          <div className="sm:ml-6 min-w-0 flex items-center gap-1.5 bg-slate-900 px-2.5 sm:px-3 py-1.5 rounded-2xl border border-slate-800 text-sm">
            <span className="hidden sm:inline text-slate-400">Branch:</span>
            {canSwitchBranch ? (
              <select aria-label="Branch" value={currentBranch} onChange={(e) => setCurrentBranch(e.target.value)} className="bg-transparent font-medium focus:outline-none cursor-pointer max-w-[5.5rem] sm:max-w-none">
                {branches.map(b => <option key={b.id} value={b.id} className="bg-slate-900">{b.name}</option>)}
              </select>
            ) : (
              <span className="font-medium truncate max-w-[5.5rem] sm:max-w-none">{branchName || 'Not assigned'}</span>
            )}
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center gap-1.5 sm:gap-4 shrink-0">
          {/* Currency Switcher (a currency is enabled once an admin sets its rate) */}
          <div className="flex bg-slate-900 rounded-2xl border border-slate-700 p-0.5 text-xs sm:text-sm">
            {(['USD', 'ZiG', 'ZAR'] as const).map(curr => {
              const usable = curr === 'USD' || exchangeRates[curr] > 0;
              return (
                <button key={curr} disabled={!usable} onClick={() => setCurrentCurrency(curr)}
                  title={usable ? undefined : 'An administrator has not set this exchange rate yet'}
                  className={`px-2 sm:px-4 py-1.5 rounded-[14px] font-medium transition-all ${currentCurrency === curr ? 'bg-sky-500 text-white shadow' : usable ? 'hover:bg-slate-800 text-slate-400' : 'text-slate-600 cursor-not-allowed'}`}>
                  {curr}
                </button>
              );
            })}
          </div>

          {/* Connection Status */}
          <div className={`px-2 sm:px-3.5 py-1 rounded-2xl flex items-center gap-2 text-xs font-medium ${isOffline ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {isOffline ? <><AlertTriangle size={14} /><span className="hidden sm:inline"> OFFLINE</span></> : <span className="hidden sm:inline">ONLINE</span>}
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-1 sm:pl-4 sm:border-l border-slate-800">
            <div className="hidden sm:block text-right text-sm">
              <div className="font-semibold" data-testid="user-name">{profile.fullName}</div>
              <div className="text-[10px] text-slate-400" data-testid="user-role">{ROLE_LABELS[role]}</div>
            </div>
            <button onClick={logout} aria-label="Log out" className="p-2 hover:bg-slate-900 rounded-xl transition"><LogOut size={17} /></button>
          </div>
        </div>
      </header>

      {loadError && (
        <div role="alert" className="bg-orange-950/60 border-b border-orange-900/60 text-orange-300 text-sm px-6 py-2 flex items-center justify-between">
          <span>Some data could not be refreshed: {loadError}</span>
          <button onClick={loadAll} className="underline">Retry</button>
        </div>
      )}

      {/* Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation (only the pages this role may open) */}
        <div className="hidden md:flex w-64 bg-slate-900 border-r border-slate-800 flex-col py-4">
          <div className="px-5 pb-4">
            <div className="text-xs uppercase tracking-[1px] text-slate-500 mb-3 px-3">MENU</div>
          </div>

          {NAV_ITEMS.filter(item => visibleTabs.includes(item.id)).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => goTo(item.id as Tab)} data-testid={`nav-${item.id}`}
                className={`flex items-center gap-3 px-5 py-[13px] mx-2 my-0.5 rounded-2xl text-sm font-medium transition-all ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'}`}>
                <Icon size={19} /> {item.label}
              </button>
            );
          })}

          <div className="flex-1" />

          <div className="mx-5 mt-2 px-4 py-4 border-t border-slate-800 text-xs text-slate-500">
            <div>{ROLE_LABELS[role]}</div>
            <div>{branchName || 'No branch assigned'}</div>
          </div>
        </div>

        {/* Bottom navigation on phones */}
        <nav aria-label="Main" className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-slate-900/95 backdrop-blur border-t border-slate-800 flex overflow-x-auto pb-[env(safe-area-inset-bottom)]">
          {NAV_ITEMS.filter(item => visibleTabs.includes(item.id)).map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => goTo(item.id)} data-testid={`mnav-${item.id}`}
                className={`flex-1 min-w-[4.25rem] flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium ${isActive ? 'text-sky-400' : 'text-slate-400'}`}>
                <Icon size={21} /> {item.label.replace('Smart ', '')}
              </button>
            );
          })}
        </nav>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 overflow-auto p-4 pb-24 sm:p-6 sm:pb-24 md:p-8">
          <AnimatePresence mode="wait">

            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-6 sm:mb-9">
                  <div>
                    <div className="text-3xl sm:text-4xl font-semibold tracking-[-1.4px]">{greeting}, {profile.fullName.split(' ')[0]}.</div>
                    <div className="text-lg text-slate-400">{branchName} • {format(new Date(), 'EEEE, dd MMMM yyyy')}</div>
                  </div>
                  {canAccessTab(role, 'pos') && (
                    <button onClick={() => goTo('pos')} className="touch-btn flex items-center gap-2 bg-sky-600 hover:bg-sky-500 px-6 py-3 rounded-2xl font-semibold shadow-lg">
                      <ShoppingCart size={19} /> Open POS Terminal
                    </button>
                  )}
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-9">
                  {kpis.map((kpi, idx) => (
                    <div key={idx} className="glass border border-slate-800/70 rounded-3xl p-6">
                      <div className="text-sm text-slate-400 mb-1">{kpi.label}</div>
                      <div className="text-4xl font-semibold tracking-tight mt-1">{kpi.value}</div>
                      <div className="text-slate-400 text-sm mt-3">{kpi.note}</div>
                    </div>
                  ))}
                </div>

                {canSeeSales && (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Revenue Trend */}
                    <div className="lg:col-span-2 glass border border-slate-800 rounded-3xl p-7">
                      <div className="flex justify-between mb-6 items-center">
                        <div className="font-semibold text-lg">Revenue Trend (7 Days, USD)</div>
                      </div>
                      <div className="h-80 -mx-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={salesTrendData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                            <XAxis dataKey="day" stroke="#64748b" />
                            <YAxis stroke="#64748b" />
                            <Tooltip contentStyle={{ background: '#0f172a', border: 'none' }} formatter={(v) => `$${Number(v).toFixed(2)}`} />
                            <Line type="natural" dataKey="revenue" stroke="#38bdf8" strokeWidth={3.5} dot={{ fill: '#0ea5e9', r: 4 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="space-y-5">
                      {/* Payment Breakdown */}
                      <div className="glass border border-slate-800 rounded-3xl p-7">
                        <div className="font-semibold mb-4">Payment Mix</div>
                        {paymentBreakdown.length === 0 ? (
                          <div className="text-sm text-slate-400 py-10 text-center">No sales yet.</div>
                        ) : (
                          <>
                            <div className="h-64">
                              <ResponsiveContainer>
                                <PieChart>
                                  <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={95}>
                                    {paymentBreakdown.map(p => <Cell key={p.name} fill={PAYMENT_COLORS[p.name]} />)}
                                  </Pie>
                                  <Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} />
                                </PieChart>
                              </ResponsiveContainer>
                            </div>
                            <div className="grid grid-cols-2 text-xs gap-x-6 gap-y-1 pt-1">
                              {paymentBreakdown.map(p => <div key={p.name} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded" style={{ background: PAYMENT_COLORS[p.name] }} />{p.name}</div>)}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Insights computed from real data */}
                      <div className="glass border border-slate-800 rounded-3xl p-7">
                        <div className="font-semibold mb-4">Insights</div>
                        <div className="space-y-3 text-sm">
                          {topSelling.length > 0
                            ? <div className="p-3 rounded-2xl bg-slate-900/60">• Best seller: <span className="font-medium">{topSelling[0].name}</span> ({topSelling[0].qty} sold)</div>
                            : <div className="p-3 rounded-2xl bg-slate-900/60 text-slate-400">• Insights appear once you have made sales.</div>}
                          {lowStockItems.length > 0 && <div className="p-3 rounded-2xl bg-slate-900/60">• {lowStockItems.length} product{lowStockItems.length === 1 ? ' is' : 's are'} at or below the reorder level</div>}
                          {canSeeDebtors && totalOwed > 0 && <div className="p-3 rounded-2xl bg-slate-900/60">• Customers owe <span className="font-medium">${totalOwed.toFixed(2)}</span> in total</div>}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Low Stock Alerts */}
                {lowStockItems.length > 0 && (
                  <div className="mt-8 bg-orange-950/40 border border-orange-900/40 p-6 rounded-3xl">
                    <div className="font-semibold flex items-center gap-2 text-orange-400 mb-3"><AlertTriangle size={19} /> Low Stock Alerts</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {lowStockItems.map(p => (
                        <div key={p.id} onClick={() => goTo('inventory')} className={`${canAccessTab(role, 'inventory') ? 'cursor-pointer hover:bg-orange-950' : ''} px-4 py-3 bg-orange-950/60 rounded-2xl flex justify-between items-center`}>
                          <div><div className="font-medium">{p.name}</div><div className="text-xs text-orange-400/80">{p.stock} / {p.reorderLevel}</div></div>
                          {canEditInventory && <button onClick={(e) => { e.stopPropagation(); goTo('inventory'); }} className="text-xs bg-orange-600 px-3 py-1 rounded">RESTOCK</button>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SMART POS TERMINAL */}
            {activeTab === 'pos' && (
              <div className="flex flex-col lg:h-[calc(100vh-7.5rem)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-4">
                  <div>
                    <div className="text-2xl sm:text-3xl font-semibold tracking-tight">Smart POS Terminal</div>
                    <div className="text-sm text-slate-400">Scan a barcode to sell</div>
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => { setLastScan(null); setShowScanner(true); }} className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-sm font-semibold"><ScanLine size={18} /> SCAN BARCODE</button>
                    <input type="text" value={searchTerm} placeholder="Search or enter barcode..." onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitSearch(); }} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 px-5 py-2.5 rounded-2xl sm:w-72 placeholder:text-slate-400" />
                  </div>
                </div>

                <div className="flex flex-col lg:flex-row gap-4 lg:gap-6 flex-1 min-h-0">
                <div className="order-2 lg:order-1 flex-1 min-h-0 flex flex-col">
                  {/* Products Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 sm:gap-4 lg:overflow-auto pb-6 flex-1">
                    {filteredProducts.map(product => {
                      const price = convertPrice(product.sellingPrice);
                      const inStock = product.stock > 0;
                      return (
                        <motion.div key={product.id} whileHover={{ scale: 1.01 }} onClick={() => addToCart(product)}
                          className={`pos-card cursor-pointer rounded-3xl p-5 border ${inStock ? 'border-slate-700 bg-slate-900' : 'border-red-900/60 bg-red-950/30 opacity-75'} flex flex-col justify-between`}>
                          <div>
                            <div className="font-semibold text-lg tracking-tight leading-tight mb-0.5">{product.name}</div>
                            <div className="text-xs text-slate-400 mb-3">{product.sku} • {product.category}</div>
                          </div>
                          <div className="flex justify-between items-end">
                            <div>
                              <div className="text-2xl font-semibold tracking-[-1px]">{currencySymbol}{price.toFixed(2)}</div>
                              <div className="text-[11px] text-emerald-400">{product.stock} in stock</div>
                            </div>
                            <div className="px-3 py-px text-[10px] rounded-full bg-white/10 text-white/60">{product.barcode.slice(-6)}</div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Cart Sidebar */}
                <div className="order-1 lg:order-2 w-full lg:w-96 bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 flex flex-col max-h-[75vh] lg:max-h-none">
                  <div className="flex justify-between mb-5 items-center">
                    <div><span className="font-semibold text-2xl">Cart</span> <span className="text-sky-400 text-sm">({cartCount})</span></div>
                    <button onClick={clearCart} className="text-xs px-4 py-1 text-red-400">Clear</button>
                  </div>

                  {cart.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center text-slate-400 py-12">
                      <ShoppingCart size={54} className="opacity-40 mb-3" />
                      <p>Cart is empty.<br />Add products from the left</p>
                    </div>
                  ) : (
                    <div className="flex-1 overflow-auto pr-1 space-y-3 mb-3">
                      {cart.map(item => {
                        const itemTotal = convertPrice(item.sellingPrice) * item.quantity * (1 - item.discount / 100);
                        return (
                          <div key={item.id} className="cart-item bg-slate-950 border border-slate-800 rounded-2xl p-4">
                            <div className="flex justify-between items-start mb-3">
                              <div className="text-sm font-medium pr-2">{item.name}</div>
                              <button onClick={() => removeFromCart(item.id)}><Trash2 size={15} className="text-red-400" /></button>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 mb-2">
                              <div>{currencySymbol}{convertPrice(item.sellingPrice).toFixed(2)} × {item.quantity}</div>
                              <div className="font-semibold text-emerald-300 tracking-tight">{currencySymbol}{itemTotal.toFixed(2)}</div>
                            </div>
                            
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-px bg-slate-800 rounded-xl">
                                <button onClick={() => updateCartQuantity(item.id, item.quantity - 1)} className="px-3 py-1 active:bg-slate-700"><Minus size={15} /></button>
                                <div className="px-4 text-sm tabular-nums font-medium">{item.quantity}</div>
                                <button onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="px-3 py-1 active:bg-slate-700"><Plus size={15} /></button>
                              </div>
                              <input type="number" value={item.discount} onChange={e => updateCartDiscount(item.id, parseInt(e.target.value))} className="bg-slate-800 text-xs w-14 text-center px-2 py-px rounded-lg border border-slate-700" />%
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="mt-auto pt-4 border-t border-slate-800">
                    <div className="flex justify-between items-baseline mb-5 px-1">
                      <div className="text-sm text-slate-400">TOTAL DUE</div>
                      <div className="font-semibold text-5xl tracking-[-2.5px] tabular-nums">{currencySymbol}{cartTotal.toFixed(2)}</div>
                    </div>
                    <button disabled={cart.length === 0} onClick={initiateCheckout} className="touch-btn w-full bg-emerald-600 disabled:bg-slate-700 text-white py-4 font-semibold rounded-2xl text-lg">CHECKOUT &amp; PAY</button>
                  </div>
                </div>
                </div>
              </div>
            )}

            {/* INVENTORY */}
            {activeTab === 'inventory' && (
              <div>
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between mb-7 sm:items-center">
                  <div><div className="text-3xl sm:text-4xl font-semibold tracking-tight">Inventory Management</div><div className="text-sm text-slate-400 mt-1">Stock • Pricing • Suppliers • Barcode{!canEditInventory && ' • View only'}</div></div>
                  <div className="flex flex-wrap gap-3">
                    {canEditInventory && <button onClick={() => setShowReceive(true)} className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-2xl flex gap-2 items-center"><PackagePlus size={18}/> Scan to Add Stock</button>}
                    {canEditInventory && <button onClick={() => openAddProduct()} className="px-5 py-2.5 bg-white text-black font-medium rounded-2xl flex gap-2 items-center"><Plus size={18}/> Add Product</button>}
                    <button onClick={exportInventoryCSV} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl flex gap-2"><Download size={17} /> Export CSV</button>
                  </div>
                </div>

                <div className="glass rounded-3xl overflow-x-auto border border-slate-800">
                  <table className="w-full min-w-[40rem] data-table">
                    <thead className="bg-slate-900"><tr className="border-b border-slate-800 text-left text-slate-400">
                      <th className="pl-8 py-4">Product</th><th>SKU / Barcode</th><th>Price (USD)</th><th>Stock</th><th>Reorder</th><th>Category</th><th></th>
                    </tr></thead>
                    <tbody>
                      {products.length === 0 && (
                        <tr><td colSpan={7} className="text-center py-12 text-slate-400">No products yet.{canEditInventory ? ' Click "Add Product" to add your first one.' : ''}</td></tr>
                      )}
                      {products.map(product => (
                        <tr key={product.id} className="border-b border-slate-800 hover:bg-slate-950 group">
                          <td className="pl-8 py-5 font-medium">{product.name}</td>
                          <td className="text-xs text-slate-400 tabular-nums">{product.sku}<br/>{product.barcode}</td>
                          <td className="font-medium tabular-nums">${product.sellingPrice.toFixed(2)}</td>
                          <td><span className={`font-semibold ${product.stock <= product.reorderLevel ? 'text-orange-400' : ''}`}>{product.stock}</span></td>
                          <td className="text-sm text-slate-400">{product.reorderLevel}</td>
                          <td><span className="px-3 py-px text-xs bg-slate-800 rounded-full">{product.category}</span></td>
                          <td className="pr-8 text-right">
                            {canEditInventory && <button onClick={() => editProduct(product)} className="text-sky-400 text-xs">EDIT</button>}
                            {canDeleteProducts && <button onClick={() => deleteProduct(product.id)} className="ml-3 text-red-400 text-xs">DEL</button>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* DEBTORS MANAGEMENT */}
            {activeTab === 'debtors' && (
              <div>
                <div className="flex justify-between mb-6">
                  <div><div className="font-semibold text-4xl tracking-tight">Debtors &amp; Credit</div><div className="text-slate-400 mt-1">Track receivables (USD) and send reminders via WhatsApp</div></div>
                  {canManageDebtors && <button onClick={() => setShowAddDebtor(true)} className="px-6 py-2.5 flex items-center bg-white text-black font-medium rounded-2xl gap-2"><Plus /> Add Debtor</button>}
                </div>

                {branchDebtors.length === 0 && <div className="glass rounded-3xl p-12 text-center text-slate-400 border border-slate-800">No debtors yet. Credit sales from the POS add customers here automatically.</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {branchDebtors.map(debtor => (
                    <div key={debtor.id} className="glass rounded-3xl p-7 border border-slate-800">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-xl tracking-tight">{debtor.name}</div>
                          <div className="text-sm text-sky-400">{debtor.phone}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-3xl font-semibold tracking-tight text-orange-400">${debtor.totalOwed.toFixed(2)}</div>
                          <div className="text-xs text-slate-400">LAST PAID: {debtor.lastPayment}</div>
                        </div>
                      </div>
                      {debtor.notes && <div className="mt-4 text-xs bg-slate-900 p-3 rounded-2xl">{debtor.notes}</div>}
                      <div className="mt-4 flex gap-3">
                        {canManageDebtors && (
                          <button disabled={debtor.totalOwed <= 0} onClick={() => { setPayingDebtor(debtor); setPayAmount(debtor.totalOwed.toFixed(2)); }} className="flex-1 text-sm py-2.5 bg-emerald-600 disabled:bg-slate-700 rounded-2xl">Record Payment</button>
                        )}
                        <button onClick={() => openWhatsApp(debtor)} className="flex-1 flex justify-center items-center gap-2 border border-sky-700 hover:bg-sky-900/60 text-sky-400 text-sm py-2.5 rounded-2xl"><Phone size={16} /> WhatsApp Reminder</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* REPORTS & ANALYTICS */}
            {activeTab === 'reports' && (
              <div>
                <div className="flex justify-between mb-8">
                  <div className="text-4xl font-semibold tracking-tight">Reports</div>
                  <button onClick={exportSalesCSV} className="px-5 py-2.5 flex gap-2 items-center bg-white text-black font-medium rounded-2xl"><Download /> Export CSV</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass p-8 rounded-3xl"><div className="font-medium mb-5">Sales, last 7 days (USD)</div>
                    <div className="h-80"><ResponsiveContainer><BarChart data={salesTrendData}><CartesianGrid stroke="#334155" /><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => `$${Number(v).toFixed(2)}`} /><Bar dataKey="revenue" fill="#38bdf8" radius={4} /></BarChart></ResponsiveContainer></div>
                  </div>
                  <div className="glass p-8 rounded-3xl">
                    <div className="font-medium mb-5">Top Selling Products</div>
                    <div className="space-y-4 mt-3">
                      {topSelling.length === 0 && <div className="text-sm text-slate-400">No sales yet.</div>}
                      {topSelling.map(p => <div key={p.name} className="flex justify-between items-center text-sm border-b border-slate-800 pb-3"><div>{p.name}</div><div className="font-semibold tabular-nums">{p.qty} sold</div></div>)}
                    </div>
                  </div>
                </div>

                <div className="mt-8 glass p-7 rounded-3xl">
                  <div className="font-semibold mb-5">Recent Transactions</div>
                  <div className="max-h-[280px] overflow-auto text-sm">
                    {branchSales.length > 0 ? branchSales.slice(0, 20).map(sale => (
                      <div key={sale.id} className="flex justify-between border-b border-slate-800 py-3 px-1">
                        <div>{format(new Date(sale.date), 'dd MMM HH:mm')} • {sale.cashier}</div>
                        <div className="font-medium tabular-nums">{symbolFor(sale.currency)}{sale.total.toFixed(2)} • {sale.paymentMethod}</div>
                      </div>
                    )) : <div className="text-center py-9 text-slate-400">No sales recorded yet. Start selling in the POS module.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* STAFF MANAGEMENT */}
            {activeTab === 'staff' && (
              <div>
                <div className="text-4xl font-semibold tracking-tight mb-2">Staff</div>
                <div className="text-slate-400 mb-8">{canManageStaff ? 'Activate new accounts and set each person\'s role and branch.' : 'Staff in your branch (view only).'}</div>
                {staff.filter(m => !m.active).length > 0 && (
                  <div className="mb-6 text-sm text-orange-300 bg-orange-950/40 border border-orange-900/50 rounded-2xl px-5 py-3">
                    {staff.filter(m => !m.active).length} account(s) are waiting to be activated.
                  </div>
                )}
                <div className="grid md:grid-cols-2 gap-6">
                  {staff.map(member => {
                    const mine = branchSales.filter(s => s.cashierId === member.id);
                    const todayMine = mine.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === todayKey);
                    const isSelf = member.id === profile.id;
                    return (
                      <div key={member.id} className="glass p-7 rounded-3xl" data-testid={`staff-${member.email}`}>
                        <div className="flex justify-between items-start mb-1">
                          <div>
                            <div className="font-semibold text-2xl">{member.fullName}{isSelf && <span className="ml-2 text-xs text-slate-400">(you)</span>}</div>
                            <div className="text-xs text-slate-400">{member.email}</div>
                          </div>
                          <span className={`text-[10px] px-2.5 py-1 rounded-full ${member.active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-orange-500/10 text-orange-400'}`}>{member.active ? 'ACTIVE' : 'PENDING'}</span>
                        </div>
                        <div className="text-sm text-sky-400 mt-2 mb-5">{ROLE_LABELS[member.role]} • {branches.find(b => b.id === member.branchId)?.name ?? 'No branch'}</div>
                        <div className="flex gap-9 text-sm mb-1">
                          <div><div className="font-mono text-3xl font-semibold">${todayMine.reduce((a, s) => a + s.totalUsd, 0).toFixed(2)}</div><div>Sales Today</div></div>
                          <div><div className="font-mono text-3xl font-semibold">{mine.length}</div><div>Transactions</div></div>
                        </div>
                        {canManageStaff && (
                          <div className="mt-5 pt-5 border-t border-slate-800 grid grid-cols-2 gap-3 text-sm">
                            <label className="text-xs text-slate-400">Role
                              <select disabled={isSelf} value={member.role} onChange={e => changeStaff(member.id, { role: e.target.value as Role })} className="block w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 disabled:opacity-50">
                                {ROLES.map(r => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
                              </select>
                            </label>
                            <label className="text-xs text-slate-400">Branch
                              <select value={member.branchId ?? ''} onChange={e => changeStaff(member.id, { branchId: e.target.value || null })} className="block w-full mt-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-slate-200">
                                <option value="">No branch</option>
                                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                              </select>
                            </label>
                            <button disabled={isSelf} onClick={() => changeStaff(member.id, { active: !member.active })} className={`col-span-2 py-2.5 rounded-xl font-medium disabled:opacity-40 ${member.active ? 'bg-slate-800 text-slate-200' : 'bg-emerald-600 text-white'}`}>
                              {member.active ? 'Deactivate account' : 'Activate account'}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {activeTab === 'settings' && (
              <div className="max-w-3xl">
                <div className="text-4xl tracking-tight font-semibold mb-9">Settings</div>

                <div className="glass p-9 rounded-3xl mb-7">
                  <div className="font-semibold mb-4">Your Account</div>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div className="text-slate-400">Name</div><div>{profile.fullName}</div>
                    <div className="text-slate-400">Email</div><div>{profile.email}</div>
                    <div className="text-slate-400">Role</div><div>{ROLE_LABELS[role]}</div>
                    <div className="text-slate-400">Branch</div><div>{branches.find(b => b.id === profile.branchId)?.name ?? 'Not assigned'}</div>
                  </div>
                </div>

                <div className="glass p-9 rounded-3xl">
                  <div className="font-semibold mb-1">Exchange Rates</div>
                  <div className="text-xs text-slate-400 mb-4">{canEditRates ? 'Units of each currency per 1 USD. A currency is available at the till once its rate is set.' : 'Set by an administrator.'}</div>
                  <div className="grid grid-cols-2 gap-5">
                    {(['ZiG', 'ZAR'] as const).map(code => (
                      <div key={code}>
                        <label className="text-xs text-slate-400" htmlFor={`rate-${code}`}>{code} per USD</label>
                        {canEditRates ? (
                          <input id={`rate-${code}`} type="number" min="0" step="any" value={rateDraft[code]} onChange={e => setRateDraft({ ...rateDraft, [code]: e.target.value })} placeholder="Not set" className="block w-full mt-1 py-3 bg-slate-900 rounded-2xl px-5 text-xl border border-slate-700" />
                        ) : (
                          <div className="mt-1 py-3 px-5 text-xl bg-slate-900 rounded-2xl border border-slate-800">{exchangeRates[code] > 0 ? exchangeRates[code] : 'Not set'}</div>
                        )}
                      </div>
                    ))}
                  </div>
                  {canEditRates && <button disabled={submitting} onClick={saveRates} className="mt-6 px-6 py-3 bg-sky-600 hover:bg-sky-500 disabled:bg-slate-700 rounded-2xl font-medium">Save exchange rates</button>}
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* PAYMENT MODAL */}
      <AnimatePresence>
        {showPaymentModal && (
          <div className="fixed inset-0 bg-black/80 z-[70] flex items-center justify-center p-6" onClick={() => setShowPaymentModal(false)}>
            <motion.div onClick={e => e.stopPropagation()} initial={{scale:0.96, opacity:0}} animate={{scale:1, opacity:1}} exit={{scale:0.96, opacity:0}} className="glass bg-slate-900 border-slate-700 rounded-3xl w-full max-w-md p-9">
              <div className="text-center mb-8">
                <div className="text-4xl font-semibold tracking-tight">{currencySymbol}{cartTotal.toFixed(2)}</div>
                <div className="text-slate-400">Total to Pay</div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-7">
                {api.PAYMENT_METHODS.map(method => (
                  <button key={method} onClick={() => setPaymentMethod(method)} className={`py-4 text-sm font-medium rounded-2xl transition-all border ${paymentMethod === method ? 'border-sky-500 bg-sky-600/20' : 'border-slate-700 hover:bg-slate-800'}`}>
                    {method}
                  </button>
                ))}
              </div>

              {(paymentMethod === 'EcoCash' || paymentMethod === 'Debt') && (
                <div className="mb-4 space-y-3">
                  <input type="tel" aria-label="Customer phone" placeholder="Customer phone +263 77 XXX XXXX" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="bg-slate-950 w-full border border-slate-700 px-6 py-4 rounded-2xl text-lg" />
                  {paymentMethod === 'Debt' && (
                    <>
                      <input type="text" aria-label="Customer name" placeholder="Customer name (for new debtors)" value={customerName} onChange={e => setCustomerName(e.target.value)} className="bg-slate-950 w-full border border-slate-700 px-6 py-4 rounded-2xl text-lg" />
                      <div className="text-xs text-center text-slate-400">The amount is added to this customer's debt (tracked in USD).</div>
                    </>
                  )}
                </div>
              )}

              {paymentMethod === 'Cash' && (
                <div className="mb-4">
                  <div className="text-xs text-slate-400 mb-1">CASH RECEIVED</div>
                  <input type="number" placeholder="Amount received" value={cashReceived || ''} onChange={e => setCashReceived(parseFloat(e.target.value) || 0)} className="bg-slate-950 w-full border border-slate-700 px-6 py-4 rounded-2xl text-2xl font-medium" />
                  {cashReceived > 0 && (
                    <div className="text-emerald-400 mt-2 text-sm font-medium">CHANGE DUE: {currencySymbol}{(cashReceived - cartTotal).toFixed(2)}</div>
                  )}
                </div>
              )}

              <button disabled={submitting} onClick={completeSale} className="touch-btn w-full py-4 bg-emerald-600 disabled:bg-slate-700 font-semibold text-lg rounded-2xl">{submitting ? 'PROCESSING…' : 'CONFIRM PAYMENT'}</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCAN-TO-SELL */}
      {showScanner && (
        <div role="dialog" aria-label="Scan to sell" className="fixed inset-0 z-[80] bg-slate-950 overflow-auto">
          <div className="max-w-xl mx-auto p-4 pb-40">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-2xl font-semibold tracking-tight">Scan to sell</div>
                <div className="text-sm text-slate-400">Point at a barcode. Each scan adds one to the cart.</div>
              </div>
              <button aria-label="Close scanner" onClick={() => setShowScanner(false)} className="p-2 rounded-xl hover:bg-slate-900"><X /></button>
            </div>

            <BarcodeScanner onScan={handleBarcode} />

            {lastScan && (
              <div role="status" data-testid="last-scan" className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                lastScan.kind === 'ok' ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                  : lastScan.kind === 'warn' ? 'bg-orange-950/70 border-orange-800 text-orange-300'
                    : 'bg-red-950/70 border-red-800 text-red-300'}`}>{lastScan.text}</div>
            )}

            <div className="mt-4 space-y-2">
              {cart.length === 0 && <div className="text-center text-slate-500 py-6 border border-dashed border-slate-800 rounded-2xl">Cart is empty. Scan a product.</div>}
              {cart.map(item => (
                <div key={item.id} data-testid={`scan-cart-${item.barcode}`} className="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl p-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{item.name}</div>
                    <div className="text-xs text-slate-400">{currencySymbol}{convertPrice(item.sellingPrice).toFixed(2)} each</div>
                  </div>
                  <button aria-label={`Less ${item.name}`} onClick={() => item.quantity > 1 ? updateCartQuantity(item.id, item.quantity - 1) : removeFromCart(item.id)} className="p-2 rounded-xl bg-slate-800"><Minus size={16} /></button>
                  <div className="w-8 text-center tabular-nums font-semibold">{item.quantity}</div>
                  <button aria-label={`More ${item.name}`} onClick={() => updateCartQuantity(item.id, item.quantity + 1)} className="p-2 rounded-xl bg-slate-800"><Plus size={16} /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="fixed bottom-0 inset-x-0 bg-slate-900/95 backdrop-blur border-t border-slate-800 p-4">
            <div className="max-w-xl mx-auto flex gap-3">
              <button onClick={() => setShowScanner(false)} className="px-5 py-3.5 rounded-2xl border border-slate-700">Keep browsing</button>
              <button disabled={cart.length === 0} onClick={() => { setShowScanner(false); initiateCheckout(); }} className="flex-1 py-3.5 rounded-2xl bg-emerald-600 disabled:bg-slate-700 font-semibold">
                Charge {currencySymbol}{cartTotal.toFixed(2)} ({cartCount} item{cartCount === 1 ? '' : 's'})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SCAN-TO-RECEIVE STOCK */}
      {showReceive && canEditInventory && (
        <ReceiveStock products={products} userId={profile.id} onClose={() => setShowReceive(false)} onChanged={refreshProducts} />
      )}

      {/* RECEIPT MODAL */}
      <AnimatePresence>
        {showReceipt && lastSale && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[90] p-8" onClick={closeReceipt}>
      <div onClick={e => e.stopPropagation()} className="receipt w-full max-w-[380px] bg-white text-black p-9 rounded-3xl shadow-2xl">
        {receiptSuccess && (
          <div className="mb-6 text-center bg-emerald-100 text-emerald-700 py-2.5 px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold">
            ✓ PAYMENT SUCCESSFUL
          </div>
        )}

        <div className="text-center">
          <div className="font-black text-3xl tracking-[-1.5px]">ZIM KIOSK</div>
          <div className="text-sm mt-0.5 mb-4 text-gray-600">{branches.find(b => b.id === lastSale.branchId)?.location}</div>
        </div>

        <div className="text-xs mb-5 border-b pb-4 border-gray-300">Receipt #{lastSale.id} • {format(new Date(lastSale.date), 'dd MMM yyyy HH:mm')}</div>

              <div className="text-sm mb-3 text-gray-600">Cashier: {lastSale.cashier} • {lastSale.branch}</div>

              {lastSale.items.map((item, index) => (
                <div key={index} className="flex justify-between text-sm py-[3px]">
                  <div>{item.name} × {item.quantity}</div>
                  <div className="font-medium tabular-nums">{symbolFor(lastSale.currency)}{item.total.toFixed(2)}</div>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-300 pt-4 mt-4 text-lg font-semibold"><div>TOTAL PAID</div><div>{symbolFor(lastSale.currency)}{lastSale.total.toFixed(2)}</div></div>
              {lastSale.paymentMethod === 'Cash' && (
                <div className="mt-3 pt-3 border-t text-sm space-y-1 bg-emerald-50 p-3 rounded-xl">
                  <div className="flex justify-between"><div>Amount Received</div><div className="font-medium tabular-nums">{symbolFor(lastSale.currency)}{(lastSale.cashReceived ?? lastSale.total).toFixed(2)}</div></div>
                  <div className="flex justify-between text-emerald-600 font-semibold"><div>Change Due</div><div>{symbolFor(lastSale.currency)}{(Math.max(0, (lastSale.cashReceived ?? lastSale.total) - lastSale.total)).toFixed(2)}</div></div>
                </div>
              )}
              <div className="text-center mt-4 text-xs tracking-widest">PAYMENT: {lastSale.paymentMethod.toUpperCase()}</div>

              <div className="mt-7 text-center text-[10px] text-gray-500">Thank you for shopping at ZIM KIOSK!</div>

              <div className="flex gap-3 mt-7">
                <button onClick={printReceipt} className="flex-1 py-3.5 bg-black text-white font-semibold rounded-2xl text-sm">PRINT THERMAL RECEIPT</button>
                <button onClick={closeReceipt} className="flex-1 py-3.5 border text-sm font-semibold border-gray-300 rounded-2xl">CLOSE</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[95]" onClick={() => { setShowAddProduct(false); setEditingProduct(null); }}>
            <div onClick={e => e.stopPropagation()} className="glass bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl p-8 max-h-[92vh] overflow-auto">
              <div className="font-semibold text-2xl mb-5">{editingProduct ? 'Edit Product' : 'Add New Product'}</div>

              <div className="grid grid-cols-2 gap-4 text-xs text-slate-400">
                <label className="col-span-2">Product name
                  <input value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Barcode
                  <input value={newProduct.barcode} placeholder="Auto" onChange={e => setNewProduct({ ...newProduct, barcode: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>SKU
                  <input value={newProduct.sku} placeholder="Auto" onChange={e => setNewProduct({ ...newProduct, sku: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Buying price (USD)
                  <input type="number" min="0" step="any" value={newProduct.buyingPrice || ''} onChange={e => setNewProduct({ ...newProduct, buyingPrice: parseFloat(e.target.value) || 0 })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Selling price (USD)
                  <input type="number" min="0" step="any" value={newProduct.sellingPrice || ''} onChange={e => setNewProduct({ ...newProduct, sellingPrice: parseFloat(e.target.value) || 0 })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Stock quantity
                  <input type="number" min="0" step="1" value={newProduct.stock} onChange={e => setNewProduct({ ...newProduct, stock: parseInt(e.target.value) || 0 })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Reorder level
                  <input type="number" min="0" step="1" value={newProduct.reorderLevel} onChange={e => setNewProduct({ ...newProduct, reorderLevel: parseInt(e.target.value) || 0 })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Category
                  <input value={newProduct.category} placeholder="General" onChange={e => setNewProduct({ ...newProduct, category: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label>Supplier
                  <input value={newProduct.supplier} onChange={e => setNewProduct({ ...newProduct, supplier: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label className="col-span-2">Expiry date (optional)
                  <input type="date" value={newProduct.expiryDate} onChange={e => setNewProduct({ ...newProduct, expiryDate: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); }} className="flex-1 py-3 border border-slate-700 rounded-2xl">Cancel</button>
                <button disabled={submitting} onClick={saveProduct} className="flex-1 py-3 bg-sky-600 disabled:bg-slate-700 rounded-2xl font-medium">{submitting ? 'Saving…' : 'Save Product'}</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Debtor Modal */}
      <AnimatePresence>
        {showAddDebtor && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[95]" onClick={() => setShowAddDebtor(false)}>
            <div onClick={e => e.stopPropagation()} className="glass bg-slate-900 border border-slate-700 w-full max-w-md rounded-3xl p-8">
              <div className="font-semibold text-2xl mb-5">Add Debtor</div>
              <div className="space-y-4 text-xs text-slate-400">
                <label className="block">Full name
                  <input value={debtorForm.name} onChange={e => setDebtorForm({ ...debtorForm, name: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label className="block">Phone number
                  <input type="tel" value={debtorForm.phone} placeholder="+263 77 000 0000" onChange={e => setDebtorForm({ ...debtorForm, phone: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label className="block">Address (optional)
                  <input value={debtorForm.address} onChange={e => setDebtorForm({ ...debtorForm, address: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label className="block">National ID (optional)
                  <input value={debtorForm.nationalId} onChange={e => setDebtorForm({ ...debtorForm, nationalId: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
                <label className="block">Notes (optional)
                  <input value={debtorForm.notes} onChange={e => setDebtorForm({ ...debtorForm, notes: e.target.value })} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-base text-slate-100" />
                </label>
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => setShowAddDebtor(false)} className="flex-1 py-3 border border-slate-700 rounded-2xl">Cancel</button>
                <button disabled={submitting} onClick={saveDebtor} className="flex-1 py-3 bg-sky-600 disabled:bg-slate-700 rounded-2xl font-medium">{submitting ? 'Saving…' : 'Add Debtor'}</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Record Debtor Payment Modal */}
      <AnimatePresence>
        {payingDebtor && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[95]" onClick={() => setPayingDebtor(null)}>
            <div onClick={e => e.stopPropagation()} className="glass bg-slate-900 border border-slate-700 w-full max-w-sm rounded-3xl p-8">
              <div className="font-semibold text-2xl mb-1">Record Payment</div>
              <div className="text-sm text-slate-400 mb-5">{payingDebtor.name} owes ${payingDebtor.totalOwed.toFixed(2)}</div>
              <label className="text-xs text-slate-400" htmlFor="pay-amount">Amount received (USD)</label>
              <input id="pay-amount" type="number" min="0" step="any" value={payAmount} onChange={e => setPayAmount(e.target.value)} className="block w-full mt-1 bg-slate-950 border border-slate-700 rounded-2xl px-4 py-3 text-2xl text-slate-100" />
              <div className="flex gap-3 mt-6">
                <button onClick={() => setPayingDebtor(null)} className="flex-1 py-3 border border-slate-700 rounded-2xl">Cancel</button>
                <button disabled={submitting} onClick={submitDebtorPayment} className="flex-1 py-3 bg-emerald-600 disabled:bg-slate-700 rounded-2xl font-medium">{submitting ? 'Saving…' : 'Record'}</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AppGate() {
  const { profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-400" role="status">
        <Loader2 className="animate-spin text-sky-400" size={36} />
      </div>
    );
  }
  if (!profile) return <LoginScreen />;
  // key = user id, so switching accounts always starts from a clean state
  return <ZIMKioskApp key={profile.id} profile={profile} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppGate />
    </AuthProvider>
  );
}
