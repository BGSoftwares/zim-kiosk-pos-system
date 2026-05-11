# zim-kiosk-pos-system

A modern React + Vite Point of Sale (POS) system for Zimbabwe-based retail businesses, integrated with Supabase for real-time database management.

## Features

- **Product Management** - Barcode scanning, inventory tracking, stock management
- **Sales Processing** - Fast checkout with multiple payment methods (cash, card, mobile, credit)
- **Debtor Management** - Track customer credits and payments
- **Multi-branch Support** - Manage multiple store locations
- **Real-time Inventory** - Live stock updates and sync across branches
- **Analytics Dashboard** - Sales trends, revenue reports, inventory insights
- **Cashier Management** - Role-based access control (admin, manager, cashier)
- **QR Code Scanning** - Quick product lookup via QR/barcode

## Tech Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS, Vite
- **Database**: Supabase (PostgreSQL)
- **Animations**: Framer Motion
- **Charts**: Recharts
- **Notifications**: Sonner Toast
- **QR Scanning**: html5-qrcode
- **Routing**: React Router v7

## Quick Start

### 1. Setup Supabase

See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for detailed instructions:
- Create Supabase project
- Add environment variables
- Run database schema
- Configure credentials

### 2. Install Dependencies

```bash
npm install
```

### 3. Development

```bash
npm run dev
```

### 4. Build

```bash
npm run build
```

### 5. Preview

```bash
npm run preview
```

## Database Schema

The system includes 10 tables with proper relationships:
- **products** - Inventory items with pricing and stock levels
- **sales** - Transaction records
- **sale_items** - Line items in each sale
- **debtors** - Customer credit accounts
- **debtor_transactions** - Payment history
- **branches** - Store locations
- **users** - Staff/cashier accounts
- **notifications** - System alerts
- **stock_transactions** - Inventory audit trail
- **sync_logs** - Change tracking for sync

## Usage Examples

### Add to Shopping Cart

```typescript
const handleScan = async (barcode) => {
  const product = await getProductByBarcode(barcode);
  addToCart(product, quantity);
};
```

### Process Sale

```typescript
const processSale = async (items, paymentMethod) => {
  const sale = await createSale({
    total_amount: calculateTotal(items),
    payment_method: paymentMethod,
    currency: 'ZWL',
    cashier_id: currentUser.id,
    branch_id: currentBranch.id,
  }, items);
};
```

### Record Debtor Payment

```typescript
const recordPayment = async (debtorId, amount) => {
  await addTransaction({
    debtor_id: debtorId,
    transaction_type: 'payment',
    amount: amount,
  });
};
```

## Environment Variables

Create `.env.local`:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key
```

## Project Structure

```
src/
├── components/       # React components
├── services/        # Supabase hooks and API calls
├── utils/           # Utility functions
├── App.tsx          # Main app component
├── main.tsx         # Entry point
└── index.css        # Global styles
```

## Key Hooks

- `useProducts()` - Product CRUD and stock management
- `useSales()` - Sale creation and tracking
- `useDebtors()` - Debtor management and transactions
- `useBranches()` - Branch information
- `useUsers()` - Staff management

## Security

- Row Level Security (RLS) enabled on all tables
- Anon key restricted to read-only on sensitive data
- Staff authentication via branch_id
- Audit logging for all transactions

## Performance Optimizations

- Database indexes on frequently queried fields
- Pagination support for large datasets
- Real-time subscriptions for live updates
- Efficient stock update mechanisms

## Future Enhancements

- Mobile app (React Native)
- Email/SMS notifications
- Advanced analytics and reporting
- Inventory forecasting
- Supplier management
- Multi-language support

## Support & Contribution

For issues or suggestions, please create an issue in the repository.

## License

MIT License - Free to use and modify

