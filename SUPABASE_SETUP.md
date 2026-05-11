# Zim Kiosk POS System - Database Setup Guide

## Database Integration with Supabase

This guide walks you through setting up the database for the Zim Kiosk POS System using Supabase.

### Prerequisites

- Supabase Project already created (https://supabase.com)
- Project URL and Anon Key from your Supabase project
- Node.js and npm installed

### Step 1: Get Your Supabase Credentials

1. Go to your Supabase project dashboard
2. Navigate to **Settings > API**
3. Copy:
   - **Project URL** (VITE_SUPABASE_URL)
   - **anon public** key (VITE_SUPABASE_ANON_KEY)

### Step 2: Configure Environment Variables

1. Copy `.env.example` to `.env.local`:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Step 3: Create Database Schema

1. In Supabase, go to **SQL Editor**
2. Create a new query
3. Copy the entire contents of `supabase_schema.sql`
4. Paste it into the SQL editor
5. Click **Run** to execute all queries

This will create:
- **branches** - Store locations
- **users** - Cashiers and staff
- **products** - Inventory items
- **sales** - Transaction records
- **sale_items** - Line items in sales
- **debtors** - Customer credit accounts
- **debtor_transactions** - Credit/payment history
- **notifications** - System notifications
- **stock_transactions** - Inventory audit trail
- **sync_logs** - Sync and audit logging

### Step 4: Install Dependencies

```bash
npm install
```

### Step 5: Start Development Server

```bash
npm run dev
```

The app will now connect to your Supabase database automatically.

---

## Using the Database Hooks

### Products

```typescript
import { useProducts } from './services';

function MyComponent() {
  const { products, loading, getProductByBarcode, createProduct, updateStock } = useProducts();

  // Fetch product by barcode
  const scanBarcode = async (barcode) => {
    const product = await getProductByBarcode(barcode);
    console.log(product);
  };

  // Create new product
  const addProduct = async () => {
    await createProduct({
      name: 'New Product',
      barcode: '1234567890',
      sku: 'SKU-001',
      buying_price: 10,
      selling_price: 15,
      wholesale_price: 12,
      stock: 100,
      reorder_level: 20,
      category: 'Electronics',
      supplier: 'Supplier Name',
    });
  };

  // Update stock
  const adjustStock = async (productId, newStock) => {
    await updateStock(productId, newStock);
  };

  return (
    <div>
      {loading ? 'Loading...' : products.map(p => <div key={p.id}>{p.name}</div>)}
    </div>
  );
}
```

### Sales

```typescript
import { useSales } from './services';

function CheckoutComponent() {
  const { createSale, getDailySalesSummary } = useSales();

  const processSale = async (items, total, paymentMethod) => {
    const sale = await createSale(
      {
        total_amount: total,
        payment_method: paymentMethod,
        currency: 'ZWL',
        cashier_id: 'user-id',
        branch_id: 'branch-id',
        customer_phone: '+263....',
      },
      items.map(item => ({
        product_id: item.id,
        quantity: item.quantity,
        unit_price: item.price,
        discount: item.discount || 0,
        subtotal: item.quantity * item.price - (item.discount || 0),
      }))
    );
    return sale;
  };

  return <button onClick={() => processSale([], 100, 'cash')}>Process Sale</button>;
}
```

### Debtors

```typescript
import { useDebtors } from './services';

function DebtorsComponent() {
  const { debtors, createDebtor, addTransaction, getDebtorsSummary } = useDebtors();

  const addCredit = async (debtorId, amount) => {
    await addTransaction({
      debtor_id: debtorId,
      transaction_type: 'credit',
      amount: amount,
      notes: 'Credit sale',
    });
  };

  const recordPayment = async (debtorId, amount) => {
    await addTransaction({
      debtor_id: debtorId,
      transaction_type: 'payment',
      amount: amount,
      reference: 'PAYMENT-001',
    });
  };

  return (
    <div>
      {debtors.map(debtor => (
        <div key={debtor.id}>
          <p>{debtor.name} - Owes: {debtor.total_owed}</p>
          <button onClick={() => recordPayment(debtor.id, 100)}>Record Payment</button>
        </div>
      ))}
    </div>
  );
}
```

### Branches & Users

```typescript
import { useBranches, useUsers } from './services';

function AdminComponent() {
  const { branches } = useBranches();
  const { users, createUser } = useUsers();

  const addCashier = async () => {
    await createUser({
      name: 'John Doe',
      role: 'cashier',
      branch_id: branches[0]?.id,
      email: 'john@example.com',
    });
  };

  return (
    <div>
      <h3>Branches</h3>
      {branches.map(b => <div key={b.id}>{b.name}</div>)}
      
      <h3>Users</h3>
      {users.map(u => <div key={u.id}>{u.name} - {u.role}</div>)}
      
      <button onClick={addCashier}>Add Cashier</button>
    </div>
  );
}
```

---

## Database Features

### Row Level Security (RLS)
Basic RLS policies are enabled for all tables. You can customize these in Supabase:
- Navigate to **Authentication > Policies**
- Modify policies based on your auth requirements

### Real-time Subscriptions
To enable real-time updates, you can use Supabase subscriptions:

```typescript
const subscription = supabase
  .from('sales')
  .on('*', payload => {
    console.log('Change received!', payload)
  })
  .subscribe()
```

### Backup & Recovery
Supabase automatically backs up your database. To restore:
- Go to **Settings > Backup**
- Select a backup point and restore

---

## Troubleshooting

### Connection Error
- Check `.env.local` has correct Supabase URL and key
- Ensure the project is active in Supabase

### Schema Not Created
- Open **SQL Editor** in Supabase
- Run `SELECT * FROM products;` to verify tables exist
- If not, re-run the `supabase_schema.sql` file

### Permission Denied Errors
- Check RLS policies in **Authentication > Policies**
- Ensure user has appropriate role assigned

---

## Next Steps

1. **Integrate Authentication** - Add Supabase Auth for user login
2. **Enable Real-time** - Set up subscriptions for live data updates
3. **Setup Backups** - Configure automated backups
4. **Add Analytics** - Track sales and inventory trends
5. **Mobile App** - Create mobile version of POS system

---

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [React with Supabase](https://supabase.com/docs/guides/with-react)
- [SQL Reference](https://supabase.com/docs/guides/sql-basics)
