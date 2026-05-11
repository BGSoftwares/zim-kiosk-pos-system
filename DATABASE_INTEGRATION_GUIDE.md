# Complete Zim-Kiosk-POS Database Integration Guide

## 📋 What Has Been Set Up

Your project now includes complete Supabase integration with:

### 1. **Database Schema** (`supabase_schema.sql`)
   - 10 fully normalized tables with proper relationships
   - Row Level Security (RLS) enabled
   - Indexes for performance optimization
   - Sample data preloaded

### 2. **Service Layer** (`src/services/`)
   - `supabase.ts` - Supabase client initialization
   - `useProducts.ts` - Product management hook
   - `useSales.ts` - Sales processing hook
   - `useDebtors.ts` - Debtor management hook
   - `useBranchesAndUsers.ts` - Branch and staff management
   - `index.ts` - Centralized exports

### 3. **Test Component** (`src/components/DatabaseTestComponent.tsx`)
   - Interactive tests for all database operations
   - Console logging for debugging
   - Perfect for verification

### 4. **Documentation**
   - `SUPABASE_SETUP.md` - Detailed setup instructions
   - `SETUP_CHECKLIST.md` - Step-by-step checklist
   - Updated `README.md` - Project overview

---

## 🚀 Quick Start (TL;DR)

```bash
# 1. Create .env.local with your Supabase credentials
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_key_here

# 2. Install dependencies
npm install

# 3. Create database schema
# - Go to Supabase SQL Editor
# - Copy-paste supabase_schema.sql and run

# 4. Start dev server
npm run dev
```

---

## 📚 Architecture Overview

```
┌─────────────────────────────────────────┐
│         React Components                │
│  (App.tsx, Dashboard, Sales, etc)       │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│         React Hooks (Services)          │
│ useProducts, useSales, useDebtors       │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Supabase JS Client                 │
│  (Authentication, API Calls)            │
└────────────┬────────────────────────────┘
             │
┌────────────▼────────────────────────────┐
│      Supabase Cloud                     │
│  (PostgreSQL Database, Storage, Auth)   │
└─────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

### Core Tables

**Products** - Inventory management
```
id (UUID) | name | barcode | sku | buying_price | selling_price | 
wholesale_price | stock | reorder_level | category | supplier | expiry_date
```

**Sales** - Transaction records
```
id | sale_date | total_amount | payment_method | currency | 
cashier_id | branch_id | customer_phone | notes
```

**Sale_Items** - Line items in sales
```
id | sale_id | product_id | quantity | unit_price | discount | subtotal
```

**Debtors** - Customer credit accounts
```
id | name | phone | address | national_id | total_owed | 
last_payment | notes | branch_id
```

**Debtor_Transactions** - Payment history
```
id | debtor_id | sale_id | transaction_type | amount | reference | notes
```

**Branches** - Store locations
```
id | name | location
```

**Users** - Staff/Cashiers
```
id | name | role | branch_id | email
```

---

## 🔧 Usage Examples

### Example 1: Scan Product & Add to Cart

```typescript
import { useProducts } from './services';

function POSPage() {
  const { getProductByBarcode } = useProducts();
  const [cart, setCart] = useState([]);

  const handleBarcodeScan = async (barcode: string) => {
    const product = await getProductByBarcode(barcode);
    if (product) {
      setCart([...cart, { ...product, quantity: 1 }]);
    }
  };

  return (
    <input 
      autoFocus 
      onBlur={(e) => handleBarcodeScan(e.target.value)}
      placeholder="Scan barcode"
    />
  );
}
```

### Example 2: Complete a Sale

```typescript
import { useSales } from './services';

async function completeSale(cartItems, paymentMethod, userID, branchID) {
  const { createSale } = useSales();
  
  const sale = await createSale(
    {
      total_amount: calculateTotal(cartItems),
      payment_method: paymentMethod,
      currency: 'ZWL',
      cashier_id: userID,
      branch_id: branchID,
    },
    cartItems.map(item => ({
      product_id: item.id,
      quantity: item.quantity,
      unit_price: item.selling_price,
      discount: item.discount || 0,
      subtotal: item.quantity * item.selling_price,
    }))
  );
  
  return sale;
}
```

### Example 3: Track Debtor Payments

```typescript
import { useDebtors } from './services';

function DebtorPaymentPage({ debtorId }) {
  const { addTransaction } = useDebtors();

  const handlePayment = async (amount) => {
    await addTransaction({
      debtor_id: debtorId,
      transaction_type: 'payment',
      amount: amount,
      reference: `PAY-${Date.now()}`,
    });
    toast.success('Payment recorded');
  };

  return (
    <button onClick={() => handlePayment(100)}>
      Record Payment
    </button>
  );
}
```

### Example 4: Dashboard Analytics

```typescript
import { useSales } from './services';

function Dashboard() {
  const { getDailySalesSummary, fetchSales } = useSales();
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    getDailySalesSummary(today).then(setSummary);
  }, []);

  return (
    <div>
      <p>Today's Sales: {summary?.totalSales || 0} ZWL</p>
      <p>Cash: {summary?.byPaymentMethod?.cash || 0} ZWL</p>
      <p>Card: {summary?.byPaymentMethod?.card || 0} ZWL</p>
    </div>
  );
}
```

---

## 🔐 Security Features

### Row Level Security (RLS)
- Tables have RLS enabled by default
- Customize policies in Supabase > Authentication > Policies
- Example policy for products (read-only):
```sql
CREATE POLICY "Users can read products" ON products
  FOR SELECT USING (true);
```

### Anon Key Restrictions
- Only allows reading non-sensitive data
- Service role key for admin operations
- Never expose service role key in frontend

### Audit Trail
- `sync_logs` table tracks all changes
- `stock_transactions` logs inventory movements
- `debtor_transactions` records all payments

---

## ⚡ Performance Tips

### 1. Optimize Queries
```typescript
// Good - Select only needed fields
const { data } = await supabase
  .from('products')
  .select('id, name, stock')  // Only needed fields

// Avoid - Selecting all
const { data } = await supabase
  .from('products')
  .select('*')  // Gets all columns
```

### 2. Use Indexes
All frequently searched columns have indexes:
- `products(barcode)`
- `products(sku)`
- `sales(cashier_id, branch_id, sale_date)`
- `debtors(branch_id)`

### 3. Pagination for Large Datasets
```typescript
const pageSize = 50;
const { data } = await supabase
  .from('sales')
  .select('*')
  .range(0, pageSize - 1)  // First page
  .order('sale_date', { ascending: false })
```

### 4. Real-time Subscriptions
```typescript
// Listen for new sales
supabase
  .from('sales')
  .on('INSERT', payload => {
    console.log('New sale:', payload.new)
  })
  .subscribe()
```

---

## 🐛 Debugging

### Check Connection
```typescript
import { supabase } from './services';

// Test if Supabase is connected
const { data, error } = await supabase.from('branches').select('*');
if (error) {
  console.error('Connection error:', error);
} else {
  console.log('Connected! Branches:', data);
}
```

### View Database Logs
1. Go to Supabase Dashboard
2. Click on SQL Editor
3. Run: `SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT 20;`

### Check RLS Policies
1. Go to Authentication > Policies
2. Look for "Enable read access for all users" policies
3. Ensure they're enabled for your tables

---

## 🔄 Real-time Sync

Enable real-time subscriptions for live updates:

```typescript
import { useEffect } from 'react';
import { supabase } from './services';

function useLiveProducts() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    // Initial fetch
    supabase.from('products').select('*').then(({ data }) => setProducts(data));

    // Subscribe to changes
    const subscription = supabase
      .from('products')
      .on('*', payload => {
        // Update local state when database changes
        setProducts(prev => [...prev, payload.new]);
      })
      .subscribe();

    return () => subscription.unsubscribe();
  }, []);

  return products;
}
```

---

## 📱 Mobile Offline Support

For mobile apps, consider Supabase Sync:

```typescript
// Enable offline support
import { RealtimeSubscription } from '@supabase/supabase-js';

const subscription = supabase
  .from('sales')
  .on('INSERT', payload => {
    // Handle new sales
    // Automatically syncs when online
  })
  .subscribe()
```

---

## ✅ Testing Checklist

- [ ] Database schema created in Supabase
- [ ] `.env.local` configured with credentials
- [ ] `npm install` completed
- [ ] `npm run dev` starts without errors
- [ ] Test component shows all data
- [ ] Can scan product by barcode
- [ ] Can create a sale
- [ ] Can add debtor and payment
- [ ] Sales appear in daily summary
- [ ] No console errors

---

## 🎯 Next Steps

1. **Replace Hardcoded Data**
   - Update App.tsx to use hooks instead of initialProducts
   - Remove sample data arrays

2. **Add Authentication**
   - Implement Supabase Auth for user login
   - Set up role-based access control

3. **Deploy**
   - `npm run build` to create production build
   - Deploy to Vercel, Netlify, or your server
   - Ensure environment variables are set in production

4. **Monitor & Scale**
   - Set up database backups
   - Monitor query performance
   - Add caching for frequently accessed data

---

## 📞 Troubleshooting

| Issue | Solution |
|-------|----------|
| "Missing Supabase URL" | Check `.env.local` exists and has correct variables |
| "Cannot find module '@supabase/supabase-js'" | Run `npm install` |
| "No data in app" | Check database tables exist, verify RLS policies |
| "Auth method denied" | Check Supabase project is active and accessible |
| "Connection timeout" | Check internet connection and Supabase server status |

---

**🎉 You're all set!** Start building your POS system.
