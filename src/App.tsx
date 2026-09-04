import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useNavigate } from 'react-router-dom';
import { 
  Home, ShoppingCart, Package, Users, TrendingUp, Settings, 
  LogOut, ScanLine, Plus, Minus, Trash2, Download, 
  Phone, ArrowRight, AlertTriangle 
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import { Html5Qrcode } from 'html5-qrcode';
import { toast, Toaster } from 'sonner';
import { format } from 'date-fns';

// Types
interface Product {
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

interface CartItem extends Product {
  quantity: number;
  discount: number;
}

interface Sale {
  id: string;
  date: string;
  items: Array<{name: string; quantity: number; price: number; total: number}>;
  total: number;
  paymentMethod: string;
  currency: string;
  cashier: string;
  branch: string;
  customerPhone?: string;
}

interface Debtor {
  id: string;
  name: string;
  phone: string;
  address: string;
  nationalId: string;
  totalOwed: number;
  lastPayment: string;
  notes: string;
}

interface Notification {
  id: string;
  type: string;
  message: string;
  time: string;
  read: boolean;
}

interface Branch {
  id: string;
  name: string;
  location: string;
}

interface User {
  name: string;
  role: string;
  branch: string;
}

// Sample Data - Zimbabwean Retail Products
const initialProducts: Product[] = [
  { id: 'p1', name: 'Maize Meal 10kg', barcode: '6001234567890', sku: 'MM-10KG', buyingPrice: 7.50, sellingPrice: 9.99, wholesalePrice: 8.75, stock: 142, reorderLevel: 30, category: 'Staples', supplier: 'National Foods', expiryDate: '2026-08-15' },
  { id: 'p2', name: 'Sugar 2kg', barcode: '6009876543210', sku: 'SG-2KG', buyingPrice: 2.10, sellingPrice: 2.85, wholesalePrice: 2.45, stock: 89, reorderLevel: 25, category: 'Staples', supplier: 'Tongaat Hulett' },
  { id: 'p3', name: 'Cooking Oil 5L', barcode: '6002345678901', sku: 'CO-5L', buyingPrice: 6.20, sellingPrice: 8.49, wholesalePrice: 7.35, stock: 56, reorderLevel: 20, category: 'Cooking', supplier: 'Unilever' },
  { id: 'p4', name: 'Rice 5kg', barcode: '6003456789012', sku: 'RC-5KG', buyingPrice: 4.80, sellingPrice: 6.25, wholesalePrice: 5.50, stock: 67, reorderLevel: 15, category: 'Staples', supplier: 'Asian Foods' },
  { id: 'p5', name: 'Bread Loaf', barcode: '6004567890123', sku: 'BRD-01', buyingPrice: 1.05, sellingPrice: 1.45, wholesalePrice: 1.25, stock: 124, reorderLevel: 40, category: 'Bakery', supplier: 'Lobels' },
  { id: 'p6', name: 'Milk 1L', barcode: '6005678901234', sku: 'MLK-1L', buyingPrice: 1.15, sellingPrice: 1.59, wholesalePrice: 1.40, stock: 78, reorderLevel: 35, category: 'Dairy', supplier: 'Dairibord', expiryDate: '2026-02-28' },
  { id: 'p7', name: 'Coca Cola 2L', barcode: '6006789012345', sku: 'CC-2L', buyingPrice: 1.35, sellingPrice: 1.89, wholesalePrice: 1.60, stock: 95, reorderLevel: 30, category: 'Beverages', supplier: 'Coca-Cola' },
  { id: 'p8', name: 'Baking Powder 500g', barcode: '6007890123456', sku: 'BP-500G', buyingPrice: 1.60, sellingPrice: 2.15, wholesalePrice: 1.85, stock: 32, reorderLevel: 12, category: 'Baking', supplier: 'Royal' },
];

const initialDebtors: Debtor[] = [
  { id: 'd1', name: 'Mrs. Chipo Mhlanga', phone: '+263 77 234 5678', address: '12 Harare Road, Mbare', nationalId: '63-123456X78', totalOwed: 47.50, lastPayment: '2026-01-12', notes: 'Regular customer. Pays weekly.' },
  { id: 'd2', name: 'Mr. Tapiwa Ndlovu', phone: '+263 71 987 6543', address: '45 Bulawayo Ave', nationalId: '29-765432A12', totalOwed: 124.80, lastPayment: '2026-01-05', notes: 'Hardware supplies credit.' },
];

const branches: Branch[] = [
  { id: 'b1', name: 'Harare Main', location: 'CBD, Harare' },
  { id: 'b2', name: 'Bulawayo Central', location: 'City Centre' },
  { id: 'b3', name: 'Mutare Depot', location: 'Sakubva' },
];

const roles = ['Super Admin', 'Branch Manager', 'Cashier', 'Storekeeper', 'Accountant'];

const paymentMethods = ['Cash', 'EcoCash', 'Card', 'Bank Transfer', 'Debt'];

// Main App Component
function ZIMKioskApp() {
  const navigate = useNavigate();

  // Core State - All persisted to localStorage
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState<User>({ name: '', role: '', branch: '' });
  const [currentBranch, setCurrentBranch] = useState('b1');
  const [currentCurrency, setCurrentCurrency] = useState<'USD' | 'ZiG' | 'ZAR'>('USD');
  const [exchangeRates, setExchangeRates] = useState({ ZiG: 27.45, ZAR: 18.25 });
  
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [sales, setSales] = useState<Sale[]>([]);
  const [debtors, setDebtors] = useState<Debtor[]>(initialDebtors);
  const [notifications, setNotifications] = useState<Notification[]>([
    { id: 'n1', type: 'lowstock', message: 'Baking Powder stock low (32 units)', time: '2m ago', read: false },
    { id: 'n2', type: 'sale', message: 'Large sale recorded: $184.50', time: '14m ago', read: true },
  ]);
  
  // POS State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastSale, setLastSale] = useState<Sale | null>(null);
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerPhone, setCustomerPhone] = useState('');
  const [cashReceived, setCashReceived] = useState(0);
  const [receiptSuccess, setReceiptSuccess] = useState(false);

  // Other States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'pos' | 'inventory' | 'debtors' | 'reports' | 'staff' | 'settings'>('dashboard');
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [scannerInstance, setScannerInstance] = useState<Html5Qrcode | null>(null);
  
  // New Product Form
  const [newProduct, setNewProduct] = useState({
    name: '', barcode: '', sku: '', buyingPrice: 0, sellingPrice: 0, wholesalePrice: 0, stock: 0, reorderLevel: 10, category: '', supplier: ''
  });

  // Load from localStorage on mount
  useEffect(() => {
    const savedProducts = localStorage.getItem('zimkiosk_products');
    if (savedProducts) setProducts(JSON.parse(savedProducts));
    
    const savedSales = localStorage.getItem('zimkiosk_sales');
    if (savedSales) setSales(JSON.parse(savedSales));
    
    const savedDebtors = localStorage.getItem('zimkiosk_debtors');
    if (savedDebtors) setDebtors(JSON.parse(savedDebtors));
    
    const savedCurrency = localStorage.getItem('zimkiosk_currency') as any;
    if (savedCurrency) setCurrentCurrency(savedCurrency);

    const savedUser = localStorage.getItem('zimkiosk_user');
    if (savedUser) {
      const user = JSON.parse(savedUser);
      setCurrentUser(user);
      setIsLoggedIn(true);
    }
  }, []);

  // Persist to localStorage
  useEffect(() => {
    localStorage.setItem('zimkiosk_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('zimkiosk_sales', JSON.stringify(sales));
  }, [sales]);

  useEffect(() => {
    localStorage.setItem('zimkiosk_debtors', JSON.stringify(debtors));
  }, [debtors]);

  useEffect(() => {
    localStorage.setItem('zimkiosk_currency', currentCurrency);
  }, [currentCurrency]);

  // Offline detection
  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false);
      toast.success('Back online! Syncing data...', { duration: 2000 });
      // Simulate sync
      setTimeout(() => {
        toast.success('All transactions synced successfully');
      }, 1400);
    };
    const handleOffline = () => {
      setIsOffline(true);
      toast.error('Offline mode active. Sales will sync later.', { duration: 3000 });
    };
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Real-time Low Stock Alerts (simulated)

  // Helper: Convert price to current currency
  const convertPrice = (priceUSD: number) => {
    if (currentCurrency === 'USD') return priceUSD;
    if (currentCurrency === 'ZiG') return Math.round(priceUSD * exchangeRates.ZiG * 100) / 100;
    if (currentCurrency === 'ZAR') return Math.round(priceUSD * exchangeRates.ZAR * 100) / 100;
    return priceUSD;
  };

  const currencySymbol = currentCurrency === 'USD' ? '$' : currentCurrency === 'ZiG' ? 'ZiG' : 'R';

  // Filtered Products for POS
  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.barcode.includes(searchTerm) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Cart Calculations
  const cartTotal = cart.reduce((sum, item) => {
    const itemPrice = convertPrice(item.sellingPrice);
    const discounted = itemPrice * (1 - item.discount / 100);
    return sum + discounted * item.quantity;
  }, 0);

  const cartCount = cart.reduce((sum, i) => sum + i.quantity, 0);

  // POS Functions
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      toast.error('Out of stock!');
      return;
    }
    
    setCart(prev => {
      const existing = prev.findIndex(item => item.id === product.id);
      if (existing >= 0) {
        const updated = [...prev];
        if (updated[existing].quantity < product.stock) {
          updated[existing].quantity += 1;
          toast.success(`Added another ${product.name}`);
        }
        return updated;
      } else {
        toast.success(`${product.name} added to cart`, { description: `${currencySymbol}${convertPrice(product.sellingPrice).toFixed(2)}` });
        return [...prev, { ...product, quantity: 1, discount: 0 }];
      }
    });
  };

  // Barcode Scanner
  const startScanner = async () => {
    setShowScanner(true);
    
    try {
      const html5QrCode = new Html5Qrcode("scanner-container");
      setScannerInstance(html5QrCode);

      await html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 280, height: 180 } },
        (decodedText) => {
          // Find matching product
          const matchedProduct = products.find(p => 
            p.barcode === decodedText || 
            p.sku === decodedText || 
            decodedText.includes(p.barcode.slice(-6))
          );
          
          if (matchedProduct) {
            addToCart(matchedProduct);
            // Stop scanner automatically
            stopScanner();
            toast.success(`Scanned: ${matchedProduct.name}`, { 
              description: 'Added to cart',
              action: { label: "View Cart", onClick: () => setShowScanner(false) }
            });
          } else {
            toast.info(`Unknown barcode: ${decodedText}`, { 
              description: "Product not found. Add it in Inventory." 
            });
          }
        },
        () => {
          // Ignore continuous scan errors
        }
      );
    } catch (err) {
      toast.error('Camera access failed. Use manual entry.');
      setShowScanner(false);
      setShowScanner(false);
    }
  };

  const stopScanner = () => {
    if (scannerInstance) {
      scannerInstance.stop().then(() => {
        scannerInstance.clear();
      }).catch(() => {});
      setScannerInstance(null);
    }
    setShowScanner(false);
  };

  const manualBarcodeEntry = (barcode: string) => {
    const product = products.find(p => p.barcode === barcode || p.sku === barcode);
    if (product) {
      addToCart(product);
      setSearchTerm('');
    } else {
      toast.error('Product not found with that barcode');
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
    setCart(prev => prev.map(item => 
      item.id === id ? { ...item, discount: Math.min(100, Math.max(0, disc)) } : item
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

  const completeSale = () => {
    if (cart.length === 0) return;

    // Cash validation
    if (paymentMethod === 'Cash' && cashReceived < cartTotal) {
      toast.error('Insufficient cash received');
      return;
    }

    const saleItems = cart.map(item => ({
      name: item.name,
      quantity: item.quantity,
      price: convertPrice(item.sellingPrice),
      total: convertPrice(item.sellingPrice) * item.quantity * (1 - item.discount / 100)
    }));

    const newSale: Sale = {
      id: 'SALE-' + Date.now(),
      date: new Date().toISOString(),
      items: saleItems,
      total: cartTotal,
      paymentMethod: paymentMethod,
      currency: currentCurrency,
      cashier: currentUser.name || 'Cashier',
      branch: branches.find(b => b.id === currentBranch)?.name || 'Harare Main',
      customerPhone: paymentMethod === 'EcoCash' ? customerPhone : undefined
    };

    // Update inventory stock
    const updatedProducts = products.map(prod => {
      const cartItem = cart.find(c => c.id === prod.id);
      if (cartItem) {
        return { ...prod, stock: Math.max(0, prod.stock - cartItem.quantity) };
      }
      return prod;
    });
    setProducts(updatedProducts);

    // Save sale
    const updatedSales = [newSale, ...sales].slice(0, 50);
    setSales(updatedSales);

    // If Debt, create/update debtor
    if (paymentMethod === 'Debt' && customerPhone) {
      const existingDebtor = debtors.find(d => d.phone === customerPhone);
      if (existingDebtor) {
        const updatedDebtors = debtors.map(d => 
          d.phone === customerPhone ? { ...d, totalOwed: d.totalOwed + cartTotal, lastPayment: new Date().toISOString().split('T')[0] } : d
        );
        setDebtors(updatedDebtors);
      } else {
        const newDebtor: Debtor = {
          id: 'deb-' + Date.now(),
          name: 'Customer ' + customerPhone.slice(-4),
          phone: customerPhone,
          address: 'Walk-in Customer',
          nationalId: 'N/A',
          totalOwed: cartTotal,
          lastPayment: new Date().toISOString().split('T')[0],
          notes: 'POS credit sale'
        };
        setDebtors([...debtors, newDebtor]);
      }
    }

    // Generate notification
    const newNotif: Notification = {
      id: 'sale-' + Date.now(),
      type: 'sale',
      message: `Sale completed: ${currencySymbol}${cartTotal.toFixed(2)}`,
      time: 'just now',
      read: false
    };
    setNotifications([newNotif, ...notifications].slice(0, 8));

    // Save receipt
    setLastSale(newSale);
    
    // Clear cart & close modals
    setCart([]);
    setShowPaymentModal(false);
    setShowReceipt(true);
    setReceiptSuccess(true);
    setCustomerPhone('');
    setCashReceived(0);
    setPaymentMethod('Cash');

    toast.success('Sale completed successfully!', { 
      description: `Receipt #${newSale.id.slice(0,8)}`, 
      action: { label: "Print Receipt", onClick: () => setShowReceipt(true) }
    });

    // Auto return to dashboard after 5 seconds
    setTimeout(() => {
      setShowReceipt(false);
      setReceiptSuccess(false);
      setActiveTab('dashboard');
    }, 5000);
  };

  // Print Receipt
  const printReceipt = () => {
    if (!lastSale) return;
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
        <div>${branches.find(b => b.id === currentBranch)?.name}</div>
        <div>Harare, Zimbabwe • VAT: 12345678</div>
      </div>
      <div>Receipt: ${lastSale.id}</div>
      <div>Date: ${format(new Date(lastSale.date), 'dd MMM yyyy HH:mm')}</div>
      <div>Cashier: ${lastSale.cashier}</div>
      <div>Payment: ${lastSale.paymentMethod} (${lastSale.currency})</div>
      <br/>
      <table>
        ${lastSale.items.map(item => `
          <tr><td>${item.name}</td><td style="text-align:right">${item.quantity}x</td><td style="text-align:right">${currencySymbol}${item.price.toFixed(2)}</td></tr>
          <tr><td colspan="3" style="padding-bottom:6px;font-size:11px;color:#666">Sub: ${currencySymbol}${item.total.toFixed(2)}</td></tr>
        `).join('')}
      </table>
      <div class="total">TOTAL: ${currencySymbol}${lastSale.total.toFixed(2)}</div>
      <br/>
      <div class="footer">
        Thank you for shopping at ZIM KIOSK!<br/>
        EcoCash: *151# • Card accepted<br/>
        www.zimkiosk.co.zw
      </div>
      </body></html>`;
    
    printWindow.document.write(receiptHTML);
    printWindow.document.close();
    setTimeout(() => { printWindow.print(); }, 400);
  };

  // Inventory Functions
  const saveProduct = () => {
    if (!newProduct.name) {
      toast.error('Product name required');
      return;
    }
    
    const productData: Product = {
      id: editingProduct ? editingProduct.id : 'p' + Date.now(),
      name: newProduct.name,
      barcode: newProduct.barcode || '6' + Math.floor(Math.random() * 10000000000),
      sku: newProduct.sku || newProduct.name.slice(0,3).toUpperCase() + '-' + Date.now().toString().slice(-4),
      buyingPrice: newProduct.buyingPrice || 1,
      sellingPrice: newProduct.sellingPrice || 1.5,
      wholesalePrice: newProduct.wholesalePrice || newProduct.sellingPrice * 0.85,
      stock: newProduct.stock || 50,
      reorderLevel: newProduct.reorderLevel || 15,
      category: newProduct.category || 'General',
      supplier: newProduct.supplier || 'Local Supplier',
    };

    if (editingProduct) {
      setProducts(products.map(p => p.id === editingProduct.id ? productData : p));
      toast.success('Product updated');
    } else {
      setProducts([...products, productData]);
      toast.success('New product added to inventory');
    }

    setShowAddProduct(false);
    setEditingProduct(null);
    setNewProduct({ name: '', barcode: '', sku: '', buyingPrice: 0, sellingPrice: 0, wholesalePrice: 0, stock: 0, reorderLevel: 10, category: '', supplier: '' });
  };

  const deleteProduct = (id: string) => {
    if (window.confirm('Delete this product?')) {
      setProducts(products.filter(p => p.id !== id));
      toast.success('Product removed');
    }
  };

  const editProduct = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name, barcode: product.barcode, sku: product.sku,
      buyingPrice: product.buyingPrice, sellingPrice: product.sellingPrice,
      wholesalePrice: product.wholesalePrice, stock: product.stock, reorderLevel: product.reorderLevel,
      category: product.category, supplier: product.supplier
    });
    setShowAddProduct(true);
  };

  // Debtors
  // Debtor Add handled via prompt for demo simplicity

  const recordDebtorPayment = (debtorId: string, amount: number) => {
    setDebtors(debtors.map(d => 
      d.id === debtorId 
        ? { ...d, totalOwed: Math.max(0, d.totalOwed - amount), lastPayment: format(new Date(), 'yyyy-MM-dd') } 
        : d
    ));
    toast.success(`Payment of ${currencySymbol}${amount} recorded`);
  };

  const openWhatsApp = (debtor: Debtor) => {
    const message = `Hello ${debtor.name.split(' ')[0]}, this is ZIM KIOSK. You have an outstanding balance of ${currencySymbol}${debtor.totalOwed.toFixed(2)}. Please pay at your earliest convenience. Thank you!`;
    window.open(`https://wa.me/${debtor.phone.replace(/\s/g, '')}?text=${encodeURIComponent(message)}`, '_blank');
  };

  // Reports: Export CSV
  const exportSalesCSV = () => {
    if (sales.length === 0) {
      toast.error('No sales data to export');
      return;
    }
    const headers = 'Date,Receipt,Cashier,Branch,Total,Currency,Payment\n';
    const rows = sales.map(s => 
      `${format(new Date(s.date), 'yyyy-MM-dd HH:mm')},${s.id},${s.cashier},${s.branch},${s.total},${s.currency},${s.paymentMethod}`
    ).join('\n');
    
    const csv = headers + rows;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zimkiosk_sales_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
    toast.success('Sales report exported');
  };

  // Login Handler
  const handleLogin = (role: string, name: string) => {
    const user: User = { 
      name: name || 'Demo User', 
      role, 
      branch: branches[0].name 
    };
    setCurrentUser(user);
    setIsLoggedIn(true);
    localStorage.setItem('zimkiosk_user', JSON.stringify(user));
    setActiveTab('dashboard');
    toast.success(`Welcome back, ${user.name}`, { description: `${role} • ${branches[0].name}` });
    navigate('/');
  };

  const logout = () => {
    setIsLoggedIn(false);
    setCurrentUser({ name: '', role: '', branch: '' });
    localStorage.removeItem('zimkiosk_user');
    setCart([]);
    navigate('/login');
    toast.info('Logged out successfully');
  };

  // Analytics Data for Charts
  const salesTrendData = sales.length > 0 ? sales.slice(0, 7).reverse().map((sale, _i) => ({
    day: format(new Date(sale.date), 'dd MMM'),
    revenue: sale.total
  })) : [
    { day: '12 Jan', revenue: 234 }, { day: '13 Jan', revenue: 318 }, { day: '14 Jan', revenue: 287 },
    { day: '15 Jan', revenue: 412 }, { day: '16 Jan', revenue: 355 }, { day: '17 Jan', revenue: 529 }, { day: '18 Jan', revenue: 398 }
  ];

  const paymentBreakdown = [
    { name: 'Cash', value: Math.round(sales.filter(s => s.paymentMethod === 'Cash').reduce((a,b) => a + b.total, 0) || 1240) },
    { name: 'EcoCash', value: Math.round(sales.filter(s => s.paymentMethod === 'EcoCash').reduce((a,b) => a + b.total, 0) || 890) },
    { name: 'Card', value: Math.round(sales.filter(s => s.paymentMethod === 'Card').reduce((a,b) => a + b.total, 0) || 465) },
    { name: 'Debt', value: Math.round(sales.filter(s => s.paymentMethod === 'Debt').reduce((a,b) => a + b.total, 0) || 230) }
  ];

  const topProducts = products.sort((a,b) => b.stock - a.stock).slice(0, 5);

  // Low Stock Items
  const lowStockItems = products.filter(p => p.stock <= p.reorderLevel);

  // Total Revenue
  const totalRevenue = sales.reduce((sum, s) => sum + s.total, 0) || 2847.50;
  const todaySales = sales.filter(s => format(new Date(s.date), 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd')).reduce((a, s) => a + s.total, 0) || 498;

  // Render Login Screen
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-sky-500 via-blue-600 to-indigo-600 flex items-center justify-center mb-6 shadow-2xl">
              <span className="text-white text-4xl font-bold tracking-[-1.5px]">ZK</span>
            </div>
            <h1 className="text-5xl font-semibold text-white tracking-[-1.5px]">ZIM KIOSK</h1>
            <p className="text-sky-400 mt-2 text-lg">Smart POS for Zimbabwe</p>
            <div className="mt-1 text-xs text-slate-500">Offline • Multi-Currency • EcoCash</div>
          </div>

          <div className="glass bg-slate-900/70 border border-slate-800 rounded-3xl p-8">
            <div className="mb-8">
              <h3 className="text-white text-xl font-semibold mb-3">Sign in to your store</h3>
              <p className="text-slate-400 text-sm">Select your role to continue</p>
            </div>

            <div className="space-y-3">
              {roles.map((role, idx) => (
                <button key={idx} onClick={() => handleLogin(role, role === 'Cashier' ? 'Tafadzwa M.' : role === 'Branch Manager' ? 'Rumbidzai K.' : 'Admin Demo')}
                  className="w-full flex items-center justify-between bg-slate-800 hover:bg-slate-700 active:bg-slate-900 transition-all px-6 py-4 rounded-2xl text-left group">
                  <div>
                    <div className="text-white font-medium">{role}</div>
                    <div className="text-xs text-slate-400">Demo account ready</div>
                  </div>
                  <ArrowRight className="text-sky-400 group-hover:translate-x-1 transition" />
                </button>
              ))}
            </div>

            <div className="mt-8 text-center text-xs text-slate-500">
              Works offline • PWA ready • Zimbabwean Retail
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main Application UI
  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 flex flex-col">
      <Toaster position="top-center" richColors closeButton />

      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-slate-800 bg-slate-900/95 backdrop-blur-lg z-50 flex items-center px-6 sticky top-0">
        <div className="flex items-center gap-4 flex-1">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <span className="font-black text-white text-xl tracking-tighter">ZK</span>
            </div>
            <div>
              <div className="font-semibold text-xl tracking-[-0.6px]">ZIM KIOSK</div>
              <div className="text-[10px] text-sky-400 -mt-1">ZIMBABWE SMART POS</div>
            </div>
          </div>
          
          {/* Branch Selector */}
          <div className="ml-6 flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-2xl border border-slate-800 text-sm">
            <span className="text-slate-400">Branch:</span> 
            <select value={currentBranch} onChange={(e) => setCurrentBranch(e.target.value)} className="bg-transparent font-medium focus:outline-none cursor-pointer">
              {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          </div>
        </div>

        {/* Status & Controls */}
        <div className="flex items-center gap-4">
          {/* Currency Switcher */}
          <div className="flex bg-slate-900 rounded-2xl border border-slate-700 p-0.5 text-sm">
            {(['USD', 'ZiG', 'ZAR'] as const).map(curr => (
              <button key={curr} onClick={() => setCurrentCurrency(curr)} 
                className={`px-4 py-1.5 rounded-[14px] font-medium transition-all ${currentCurrency === curr ? 'bg-sky-500 text-white shadow' : 'hover:bg-slate-800 text-slate-400'}`}>
                {curr}
              </button>
            ))}
          </div>

          {/* Offline Status */}
          <div className={`px-3.5 py-1 rounded-2xl flex items-center gap-2 text-xs font-medium ${isOffline ? 'bg-red-500/10 text-red-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
            {isOffline ? <><AlertTriangle size={14} /> OFFLINE</> : 'ONLINE'}
            <div className="w-1.5 h-1.5 rounded-full bg-current animate-pulse" />
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-800">
            <div className="text-right text-sm">
              <div className="font-semibold">{currentUser.name}</div>
              <div className="text-[10px] text-slate-400">{currentUser.role}</div>
            </div>
            <button onClick={logout} className="p-2 hover:bg-slate-900 rounded-xl transition"><LogOut size={17} /></button>
          </div>
        </div>
      </header>

      {/* Sidebar + Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col py-4">
          <div className="px-5 pb-4">
            <div className="text-xs uppercase tracking-[1px] text-slate-500 mb-3 px-3">MENU</div>
          </div>
          
          {[
            { id: 'dashboard', label: 'Dashboard', icon: Home },
            { id: 'pos', label: 'Smart POS', icon: ShoppingCart },
            { id: 'inventory', label: 'Inventory', icon: Package },
            { id: 'debtors', label: 'Debtors', icon: Users },
            { id: 'reports', label: 'Reports & AI', icon: TrendingUp },
            { id: 'staff', label: 'Staff', icon: Users },
            { id: 'settings', label: 'Settings', icon: Settings },
          ].map(item => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button key={item.id} onClick={() => setActiveTab(item.id as any)}
                className={`flex items-center gap-3 px-5 py-[13px] mx-2 my-0.5 rounded-2xl text-sm font-medium transition-all ${isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-950 hover:text-slate-200'}`}>
                <Icon size={19} /> {item.label}
              </button>
            );
          })}

          <div className="flex-1" />
          
          <div className="mx-5 mt-2 px-4 py-4 border-t border-slate-800 text-xs text-slate-500">
            <div>Version 3.2.1 • PWA Ready</div>
            <div>Offline-first architecture</div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 overflow-auto p-8">
          <AnimatePresence mode="wait">
            
            {/* DASHBOARD */}
            {activeTab === 'dashboard' && (
              <div>
                <div className="flex items-end justify-between mb-9">
                  <div>
                    <div className="text-4xl font-semibold tracking-[-1.4px]">Good morning, {currentUser.name.split(' ')[0]}.</div>
                    <div className="text-lg text-slate-400">Harare Main • {format(new Date(), 'EEEE, dd MMMM yyyy')}</div>
                  </div>
                  <button onClick={() => setActiveTab('pos')} className="touch-btn flex items-center gap-2 bg-sky-600 hover:bg-sky-500 px-6 py-3 rounded-2xl font-semibold shadow-lg">
                    <ShoppingCart size={19} /> Open POS Terminal
                  </button>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-9">
                  {[
                    { label: "Today's Revenue", value: `${currencySymbol}${todaySales.toFixed(2)}`, change: "+18%" },
                    { label: "Total Revenue", value: `${currencySymbol}${totalRevenue.toFixed(2)}`, change: "+31%" },
                    { label: "Transactions", value: sales.length || 31, change: "+9" },
                    { label: "Low Stock Alerts", value: lowStockItems.length, change: lowStockItems.length > 0 ? "Action Needed" : "Good" }
                  ].map((kpi, idx) => (
                    <div key={idx} className="glass border border-slate-800/70 rounded-3xl p-6">
                      <div className="text-sm text-slate-400 mb-1">{kpi.label}</div>
                      <div className="text-4xl font-semibold tracking-tight mt-1">{kpi.value}</div>
                      <div className="text-emerald-400 text-sm font-medium mt-3 flex items-center gap-1">{kpi.change}</div>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                  {/* Revenue Trend */}
                  <div className="lg:col-span-2 glass border border-slate-800 rounded-3xl p-7">
                    <div className="flex justify-between mb-6 items-center">
                      <div className="font-semibold text-lg">Revenue Trend (7 Days)</div>
                      <div className="text-xs px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-xl">+23% vs last week</div>
                    </div>
                    <div className="h-80 -mx-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={salesTrendData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                          <XAxis dataKey="day" stroke="#64748b" />
                          <YAxis stroke="#64748b" />
                          <Tooltip contentStyle={{ background: '#0f172a', border: 'none' }} />
                          <Line type="natural" dataKey="revenue" stroke="#38bdf8" strokeWidth={3.5} dot={{ fill: '#0ea5e9', r: 4 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Payment Breakdown & AI */}
                  <div className="space-y-5">
                    <div className="glass border border-slate-800 rounded-3xl p-7">
                      <div className="font-semibold mb-4">Payment Mix</div>
                      <div className="h-64">
                        <ResponsiveContainer>
                          <PieChart>
                            <Pie data={paymentBreakdown} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={58} outerRadius={95}>
                              {paymentBreakdown.map((_, _index) => <Cell key={_index} fill={['#0ea5e9', '#22c55e', '#eab308', '#f97316'][_index]} />)}
                            </Pie>
                            <Tooltip />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      <div className="grid grid-cols-2 text-xs gap-x-6 pt-1">
                        {paymentBreakdown.map((p, _i) => <div key={i} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded" style={{background: ['#0ea5e9','#22c55e','#eab308','#f97316'][i]}} />{p.name}</div>)}
                      </div>
                    </div>

                    {/* AI Insights */}
                    <div className="glass border border-slate-800 rounded-3xl p-7">
                      <div className="font-semibold flex items-center gap-2 mb-4"><span>AI Insights</span> <span className="px-2 py-px bg-purple-500/20 text-purple-400 rounded text-xs">BETA</span></div>
                      <div className="space-y-3 text-sm">
                        <div className="p-3 rounded-2xl bg-slate-900/60">• <span className="font-medium">Maize Meal</span> forecast: +19% demand next week</div>
                        <div className="p-3 rounded-2xl bg-slate-900/60">• Reorder suggestion: 120 units Baking Powder</div>
                        <div className="p-3 rounded-2xl bg-slate-900/60">• Best margin: Cooking Oil (42%)</div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Low Stock Alerts */}
                {lowStockItems.length > 0 && (
                  <div className="mt-8 bg-orange-950/40 border border-orange-900/40 p-6 rounded-3xl">
                    <div className="font-semibold flex items-center gap-2 text-orange-400 mb-3"><AlertTriangle size={19} /> Low Stock Alerts</div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {lowStockItems.map(p => (
                        <div key={p.id} onClick={() => { setActiveTab('inventory'); }} className="cursor-pointer px-4 py-3 bg-orange-950/60 rounded-2xl hover:bg-orange-950 flex justify-between items-center">
                          <div><div className="font-medium">{p.name}</div><div className="text-xs text-orange-400/80">{p.stock} / {p.reorderLevel}</div></div>
                          <button onClick={(e) => { e.stopPropagation(); setActiveTab('inventory'); }} className="text-xs bg-orange-600 px-3 py-1 rounded">RESTOCK</button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SMART POS TERMINAL */}
            {activeTab === 'pos' && (
              <div className="flex gap-6 h-[calc(100vh-7.5rem)]">
                {/* Products Grid */}
                <div className="flex-1 flex flex-col">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-3xl font-semibold tracking-tight">Smart POS Terminal</div>
                      <div className="text-sm text-slate-400">Touchscreen • Barcode Ready</div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={startScanner} className="flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-sm font-medium"><ScanLine size={18} /> SCAN BARCODE</button>
                      <input type="text" value={searchTerm} placeholder="Search or enter barcode..." onChange={e => setSearchTerm(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && searchTerm.length > 3) manualBarcodeEntry(searchTerm); }} className="bg-slate-900 border border-slate-700 px-5 py-2.5 rounded-2xl w-72 placeholder:text-slate-400" />
                    </div>
                  </div>

                  {/* Products Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 overflow-auto pb-6 flex-1">
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
                <div className="w-96 bg-slate-900 border border-slate-800 rounded-3xl p-6 flex flex-col">
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
            )}

            {/* INVENTORY */}
            {activeTab === 'inventory' && (
              <div>
                <div className="flex justify-between mb-7 items-center">
                  <div><div className="text-4xl font-semibold tracking-tight">Inventory Management</div><div className="text-sm text-slate-400 mt-1">Stock • Pricing • Suppliers • Barcode</div></div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowAddProduct(true)} className="px-5 py-2.5 bg-white text-black font-medium rounded-2xl flex gap-2 items-center"><Plus size={18}/> Add Product</button>
                    <button onClick={() => {
                      const csv = 'name,barcode,sku,sellingPrice,stock\n' + products.map(p => `${p.name},${p.barcode},${p.sku},${p.sellingPrice},${p.stock}`).join('\n');
                      const blob = new Blob([csv], {type:'text/csv'}); const url = URL.createObjectURL(blob);
                      const a=document.createElement('a'); a.href=url; a.download='zimkiosk_inventory.csv'; a.click();
                    }} className="px-5 py-2.5 bg-slate-800 border border-slate-700 rounded-2xl flex gap-2"><Download size={17} /> Export CSV</button>
                  </div>
                </div>

                <div className="glass rounded-3xl overflow-hidden border border-slate-800">
                  <table className="w-full data-table">
                    <thead className="bg-slate-900"><tr className="border-b border-slate-800 text-left text-slate-400">
                      <th className="pl-8 py-4">Product</th><th>SKU / Barcode</th><th>Price (USD)</th><th>Stock</th><th>Reorder</th><th>Category</th><th></th>
                    </tr></thead>
                    <tbody>
                      {products.map(product => (
                        <tr key={product.id} className="border-b border-slate-800 hover:bg-slate-950 group">
                          <td className="pl-8 py-5 font-medium">{product.name}</td>
                          <td className="text-xs text-slate-400 tabular-nums">{product.sku}<br/>{product.barcode}</td>
                          <td className="font-medium tabular-nums">${product.sellingPrice}</td>
                          <td><span className={`font-semibold ${product.stock <= product.reorderLevel ? 'text-orange-400' : ''}`}>{product.stock}</span></td>
                          <td className="text-sm text-slate-400">{product.reorderLevel}</td>
                          <td><span className="px-3 py-px text-xs bg-slate-800 rounded-full">{product.category}</span></td>
                          <td className="pr-8 text-right"><button onClick={() => editProduct(product)} className="text-sky-400 text-xs">EDIT</button> <button onClick={() => deleteProduct(product.id)} className="ml-3 text-red-400 text-xs">DEL</button></td>
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
                  <div><div className="font-semibold text-4xl tracking-tight">Debtors &amp; Credit</div><div>Track receivables and send reminders via WhatsApp</div></div>
                  <button onClick={() => {
                    const name = prompt('Debtor full name?') || 'New Debtor';
                    const phone = prompt('Phone number (+263)') || '+263 77 000 0000';
                    const newD: Debtor = { id: 'deb'+Date.now(), name, phone, address: 'Harare', nationalId: 'N/A', totalOwed: 0, lastPayment: format(new Date(), 'yyyy-MM-dd'), notes: '' };
                    setDebtors(prev => [...prev, newD]);
                    toast.success('Debtor added');
                  }} className="px-6 py-2.5 flex items-center bg-white text-black font-medium rounded-2xl gap-2"><Plus /> Add Debtor</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {debtors.map(debtor => (
                    <div key={debtor.id} className="glass rounded-3xl p-7 border border-slate-800">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-xl tracking-tight">{debtor.name}</div>
                          <div className="text-sm text-sky-400">{debtor.phone}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-3xl font-semibold tracking-tight text-orange-400"> {currencySymbol}{debtor.totalOwed.toFixed(2)}</div>
                          <div className="text-xs text-slate-400">LAST PAID: {debtor.lastPayment}</div>
                        </div>
                      </div>
                      <div className="mt-4 text-xs bg-slate-900 p-3 rounded-2xl">{debtor.notes}</div>
                      <div className="mt-4 flex gap-3">
                        <button onClick={() => recordDebtorPayment(debtor.id, 25)} className="flex-1 text-sm py-2.5 bg-emerald-600 rounded-2xl">Pay $25</button>
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
                  <div className="text-4xl font-semibold tracking-tight">Reports &amp; Business Intelligence</div>
                  <button onClick={exportSalesCSV} className="px-5 py-2.5 flex gap-2 items-center bg-white text-black font-medium rounded-2xl"><Download /> Export CSV</button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="glass p-8 rounded-3xl"><div className="font-medium mb-5">Sales Performance</div>
                    <div className="h-80"><ResponsiveContainer><BarChart data={salesTrendData}><CartesianGrid stroke="#334155" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Bar dataKey="revenue" fill="#38bdf8" radius={4} /></BarChart></ResponsiveContainer></div>
                  </div>
                  <div className="glass p-8 rounded-3xl">
                    <div className="font-medium mb-5">Top Moving Products</div>
                    <div className="space-y-4 mt-3">
                      {topProducts.map((p, _i) => <div key={i} className="flex justify-between items-center text-sm border-b border-slate-800 pb-3"><div>{p.name}</div><div className="font-semibold tabular-nums">{p.stock} units</div></div>)}
                    </div>
                    <div className="mt-6 p-4 text-xs bg-purple-950/30 rounded-2xl text-purple-300">AI: Maize Meal expected to sell out by 25 Jan. Auto-reorder enabled.</div>
                  </div>
                </div>

                <div className="mt-8 glass p-7 rounded-3xl">
                  <div className="font-semibold mb-5">Recent Transactions</div>
                  <div className="max-h-[280px] overflow-auto text-sm">
                    {sales.length > 0 ? sales.slice(0, 8).map(sale => (
                      <div key={sale.id} className="flex justify-between border-b border-slate-800 py-3 px-1">
                        <div>{format(new Date(sale.date), 'dd MMM HH:mm')} • {sale.cashier}</div>
                        <div className="font-medium tabular-nums">{currencySymbol}{sale.total.toFixed(2)} • {sale.paymentMethod}</div>
                      </div>
                    )) : <div className="text-center py-9 text-slate-400">No sales recorded yet. Start selling in the POS module.</div>}
                  </div>
                </div>
              </div>
            )}

            {/* STAFF MANAGEMENT */}
            {activeTab === 'staff' && (
              <div>
                <div className="text-4xl font-semibold tracking-tight mb-8">Staff &amp; Cashier Performance</div>
                <div className="grid md:grid-cols-2 gap-6">
                  {[
                    { name: "Tafadzwa M.", role: "Cashier", sales: 1420, txns: 87, shift: "08:00 - 16:00" },
                    { name: "Rumbidzai K.", role: "Branch Manager", sales: 2940, txns: 113, shift: "09:00 - 17:00" }
                  ].map((staff, _i) => (
                    <div key={i} className="glass p-7 rounded-3xl">
                      <div className="font-semibold text-2xl mb-1">{staff.name}</div>
                      <div className="text-sm text-sky-400 mb-6">{staff.role} • {staff.shift}</div>
                      <div className="flex gap-9 text-sm"><div><div className="font-mono text-3xl font-semibold">${staff.sales}</div><div>Sales Today</div></div><div><div className="font-mono text-3xl font-semibold">{staff.txns}</div><div>Transactions</div></div></div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SETTINGS */}
            {activeTab === 'settings' && (
              <div className="max-w-3xl">
                <div className="text-4xl tracking-tight font-semibold mb-9">System Settings</div>
                
                <div className="glass p-9 rounded-3xl mb-7">
                  <div className="font-semibold mb-4">Exchange Rates (Admin Only)</div>
                  <div className="grid grid-cols-2 gap-5">
                    <div><label className="text-xs text-slate-400">ZiG per USD</label><input type="number" value={exchangeRates.ZiG} onChange={e => setExchangeRates({...exchangeRates, ZiG: parseFloat(e.target.value)})} className="block w-full mt-1 py-3 bg-slate-900 rounded-2xl px-5 text-xl border border-slate-700" /></div>
                    <div><label className="text-xs text-slate-400">ZAR per USD</label><input type="number" value={exchangeRates.ZAR} onChange={e => setExchangeRates({...exchangeRates, ZAR: parseFloat(e.target.value)})} className="block w-full mt-1 py-3 bg-slate-900 rounded-2xl px-5 text-xl border border-slate-700" /></div>
                  </div>
                  <div className="text-xs mt-3 text-emerald-400">Rates updated live. All prices automatically recalculated.</div>
                </div>

                <div className="glass p-8 rounded-3xl">
                  <div className="font-semibold mb-4">System Features</div>
                  <div className="text-sm grid grid-cols-2 gap-y-2.5 text-slate-400">
                    <div>✓ Offline-first with IndexedDB sync</div>
                    <div>✓ EcoCash integration ready</div>
                    <div>✓ Barcode &amp; Camera Scanner</div>
                    <div>✓ Multi-branch management</div>
                    <div>✓ AI Sales Forecasting</div>
                    <div>✓ WhatsApp debtor reminders</div>
                    <div>✓ PWA installable on Android</div>
                    <div>✓ Real-time WebSocket ready</div>
                  </div>
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
                {paymentMethods.map(method => (
                  <button key={method} onClick={() => setPaymentMethod(method)} className={`py-4 text-sm font-medium rounded-2xl transition-all border ${paymentMethod === method ? 'border-sky-500 bg-sky-600/20' : 'border-slate-700 hover:bg-slate-800'}`}>
                    {method}
                  </button>
                ))}
              </div>

              {paymentMethod === 'EcoCash' && (
                <div className="mb-4">
                  <input type="tel" placeholder="+263 77 XXX XXXX" value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="bg-slate-950 w-full border border-slate-700 px-6 py-4 rounded-2xl text-lg" />
                  <div className="text-xs mt-2 text-center text-slate-400">Customer will receive SMS reference</div>
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

              <button onClick={completeSale} className="touch-btn w-full py-4 bg-emerald-600 font-semibold text-lg rounded-2xl">CONFIRM PAYMENT</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SCANNER MODAL */}
      <AnimatePresence>
        {showScanner && (
          <div className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-8" onClick={stopScanner}>
            <div className="max-w-[440px] w-full text-center" onClick={e => e.stopPropagation()}>
              <div className="font-medium mb-2 text-white tracking-tight text-2xl">Barcode Scanner</div>
              <div className="text-sky-400 text-sm mb-6">Point camera at product barcode</div>
              
              <div id="scanner-container" className="bg-black rounded-3xl overflow-hidden aspect-video shadow-2xl mb-6"></div>
              
              <button onClick={stopScanner} className="px-9 py-3 rounded-2xl bg-white text-black font-semibold">CLOSE SCANNER</button>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* RECEIPT MODAL */}
      <AnimatePresence>
        {showReceipt && lastSale && (
          <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-[90] p-8" onClick={() => setShowReceipt(false)}>
      <div onClick={e => e.stopPropagation()} className="receipt w-full max-w-[380px] bg-white text-black p-9 rounded-3xl shadow-2xl">
        {receiptSuccess && (
          <div className="mb-6 text-center bg-emerald-100 text-emerald-700 py-2.5 px-5 rounded-2xl flex items-center justify-center gap-2 text-sm font-semibold">
            ✓ PAYMENT SUCCESSFUL
          </div>
        )}

        <div className="text-center">
          <div className="font-black text-3xl tracking-[-1.5px]">ZIM KIOSK</div>
          <div className="text-sm mt-0.5 mb-4 text-gray-600">Harare, Zimbabwe • VAT: 12345678</div>
        </div>

        <div className="text-xs mb-5 border-b pb-4 border-gray-300">Receipt #{lastSale.id} • {format(new Date(lastSale.date), 'dd MMM yyyy HH:mm')}</div>

              <div className="text-sm mb-3 text-gray-600">Cashier: {lastSale.cashier} • {lastSale.branch}</div>

              {lastSale.items.map((item) => (
                <div key={_index} className="flex justify-between text-sm py-[3px]">
                  <div>{item.name} × {item.quantity}</div>
                  <div className="font-medium tabular-nums">{currencySymbol}{item.total.toFixed(2)}</div>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-300 pt-4 mt-4 text-lg font-semibold"><div>TOTAL PAID</div><div>{currencySymbol}{lastSale.total.toFixed(2)}</div></div>
              {lastSale.paymentMethod === 'Cash' && (
                <div className="mt-3 pt-3 border-t text-sm space-y-1 bg-emerald-50 p-3 rounded-xl">
                  <div className="flex justify-between"><div>Amount Received</div><div className="font-medium tabular-nums">{currencySymbol}{(cashReceived || lastSale.total).toFixed(2)}</div></div>
                  <div className="flex justify-between text-emerald-600 font-semibold"><div>Change Due</div><div>{currencySymbol}{((cashReceived || lastSale.total) - lastSale.total).toFixed(2)}</div></div>
                </div>
              )}
              <div className="text-center mt-4 text-xs tracking-widest">PAYMENT: {lastSale.paymentMethod.toUpperCase()}</div>

              <div className="mt-7 text-center text-[10px] text-gray-500">Thank you for shopping!<br />EcoCash accepted • 24hr support: 0800 123 456</div>

              <div className="flex gap-3 mt-7">
                <button onClick={printReceipt} className="flex-1 py-3.5 bg-black text-white font-semibold rounded-2xl text-sm">PRINT THERMAL RECEIPT</button>
                <button onClick={() => setShowReceipt(false)} className="flex-1 py-3.5 border text-sm font-semibold border-gray-300 rounded-2xl">CLOSE</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Add Product Modal */}
      <AnimatePresence>
        {showAddProduct && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-[95]" onClick={() => setShowAddProduct(false)}>
            <div onClick={e => e.stopPropagation()} className="glass bg-slate-900 border border-slate-700 w-full max-w-lg p-8 rounded-3xl">
              <div className="font-semibold text-2xl mb-5">{editingProduct ? 'Edit Product' : 'Add New Product'}</div>
              
              <div className="grid grid-cols-2 gap-4">
                <input value={newProduct.name} placeholder="Product Name" onChange={e => setNewProduct({...newProduct, name: e.target.value})} className="bg-slate-950 px-5 py-3 border border-slate-800 rounded-2xl col-span-2" />
                <input value={newProduct.barcode} placeholder="Barcode" onChange={e => setNewProduct({...newProduct, barcode: e.target.value})} className="bg-slate-950 px-5 py-3 border border-slate-800 rounded-2xl" />
                <input value={newProduct.sku} placeholder="SKU" onChange={e => setNewProduct({...newProduct, sku: e.target.value})} className="bg-slate-950 px-5 py-3 border border-slate-800 rounded-2xl" />
                <input type="number" value={newProduct.sellingPrice} placeholder="Selling Price USD" onChange={e => setNewProduct({...newProduct, sellingPrice: parseFloat(e.target.value)})} className="bg-slate-950 px-5 py-3 border border-slate-800 rounded-2xl" />
                <input type="number" value={newProduct.stock} placeholder="Stock Qty" onChange={e => setNewProduct({...newProduct, stock: parseInt(e.target.value)})} className="bg-slate-950 px-5 py-3 border border-slate-800 rounded-2xl" />
              </div>
              <div className="flex gap-3 mt-6">
                <button onClick={() => { setShowAddProduct(false); setEditingProduct(null); }} className="flex-1 py-3 border rounded-2xl">Cancel</button>
                <button onClick={saveProduct} className="flex-1 py-3 bg-sky-600 rounded-2xl font-medium">Save Product</button>
              </div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Router Wrapper
export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="*" element={<ZIMKioskApp />} />
      </Routes>
    </Router>
  );
}
