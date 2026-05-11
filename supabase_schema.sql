-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Branches table
create table if not exists branches (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  location text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Users/Cashiers table
create table if not exists users (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  role text not null check (role in ('admin', 'manager', 'cashier')),
  branch_id uuid not null references branches(id) on delete cascade,
  email text unique,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Products table
create table if not exists products (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  barcode text unique not null,
  sku text unique not null,
  buying_price numeric(10, 2) not null,
  selling_price numeric(10, 2) not null,
  wholesale_price numeric(10, 2) not null,
  stock integer not null default 0,
  reorder_level integer not null default 10,
  category text not null,
  supplier text not null,
  expiry_date date,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sales table
create table if not exists sales (
  id uuid primary key default uuid_generate_v4(),
  sale_date timestamp with time zone default timezone('utc'::text, now()) not null,
  total_amount numeric(12, 2) not null,
  payment_method text not null check (payment_method in ('cash', 'card', 'mobile', 'credit')),
  currency text default 'ZWL',
  cashier_id uuid not null references users(id) on delete set null,
  branch_id uuid not null references branches(id) on delete cascade,
  customer_phone text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sales Items table (Line items in a sale)
create table if not exists sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid not null references sales(id) on delete cascade,
  product_id uuid not null references products(id) on delete restrict,
  quantity integer not null,
  unit_price numeric(10, 2) not null,
  discount numeric(10, 2) default 0,
  subtotal numeric(12, 2) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Debtors table
create table if not exists debtors (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text not null,
  address text,
  national_id text unique,
  total_owed numeric(12, 2) default 0,
  last_payment timestamp with time zone,
  notes text,
  branch_id uuid not null references branches(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Debtor Transactions table
create table if not exists debtor_transactions (
  id uuid primary key default uuid_generate_v4(),
  debtor_id uuid not null references debtors(id) on delete cascade,
  sale_id uuid references sales(id) on delete set null,
  transaction_type text not null check (transaction_type in ('credit', 'payment', 'writeoff')),
  amount numeric(12, 2) not null,
  reference text,
  notes text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Notifications table
create table if not exists notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  type text not null,
  message text not null,
  read boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Stock Transactions table (for inventory tracking)
create table if not exists stock_transactions (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid not null references products(id) on delete restrict,
  transaction_type text not null check (transaction_type in ('purchase', 'sale', 'adjustment', 'return')),
  quantity_change integer not null,
  reference_id uuid,
  notes text,
  created_by uuid references users(id) on delete set null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Sync Logs table (for audit and sync tracking)
create table if not exists sync_logs (
  id uuid primary key default uuid_generate_v4(),
  table_name text not null,
  operation text not null check (operation in ('insert', 'update', 'delete')),
  record_id uuid,
  changed_data jsonb,
  synced boolean default false,
  synced_at timestamp with time zone,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create indexes for better query performance
create index if not exists idx_products_barcode on products(barcode);
create index if not exists idx_products_sku on products(sku);
create index if not exists idx_sales_cashier_id on sales(cashier_id);
create index if not exists idx_sales_branch_id on sales(branch_id);
create index if not exists idx_sales_date on sales(sale_date);
create index if not exists idx_sale_items_sale_id on sale_items(sale_id);
create index if not exists idx_sale_items_product_id on sale_items(product_id);
create index if not exists idx_debtors_branch_id on debtors(branch_id);
create index if not exists idx_debtor_transactions_debtor_id on debtor_transactions(debtor_id);
create index if not exists idx_stock_transactions_product_id on stock_transactions(product_id);
create index if not exists idx_notifications_user_id on notifications(user_id);
create index if not exists idx_sync_logs_table_name on sync_logs(table_name);

-- Enable Row Level Security (RLS)
alter table branches enable row level security;
alter table users enable row level security;
alter table products enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table debtors enable row level security;
alter table debtor_transactions enable row level security;
alter table notifications enable row level security;
alter table stock_transactions enable row level security;
alter table sync_logs enable row level security;

-- Create basic RLS policies (you may need to customize these based on your auth setup)
-- For now, allowing all authenticated users read access
create policy "Enable read access for all users" on products for select using (true);
create policy "Enable read access for all users" on branches for select using (true);
create policy "Enable read access for all users" on sales for select using (true);
create policy "Enable read access for all users" on sale_items for select using (true);
create policy "Enable read access for all users" on debtors for select using (true);
create policy "Enable read access for all users" on stock_transactions for select using (true);

-- Insert sample branches
insert into branches (name, location) values
  ('Harare Main', 'CBD, Harare'),
  ('Bulawayo Central', 'City Centre'),
  ('Mutare Depot', 'Sakubva')
on conflict do nothing;

-- Insert sample products
insert into products (name, barcode, sku, buying_price, selling_price, wholesale_price, stock, reorder_level, category, supplier, expiry_date) values
  ('Maize Meal 10kg', '6001234567890', 'MM-10KG', 7.50, 9.99, 8.75, 142, 30, 'Staples', 'National Foods', '2026-08-15'),
  ('Sugar 2kg', '6009876543210', 'SG-2KG', 2.10, 2.85, 2.45, 89, 25, 'Staples', 'Tongaat Hulett', null),
  ('Cooking Oil 5L', '6002345678901', 'CO-5L', 6.20, 8.49, 7.35, 56, 20, 'Cooking', 'Unilever', null),
  ('Rice 5kg', '6003456789012', 'RC-5KG', 4.80, 6.25, 5.50, 67, 15, 'Staples', 'Asian Foods', null),
  ('Bread Loaf', '6004567890123', 'BRD-01', 1.05, 1.45, 1.25, 124, 40, 'Bakery', 'Lobels', null),
  ('Milk 1L', '6005678901234', 'MLK-1L', 1.15, 1.59, 1.40, 78, 35, 'Dairy', 'Dairibord', '2026-02-28'),
  ('Coca Cola 2L', '6006789012345', 'CC-2L', 1.35, 1.89, 1.60, 95, 30, 'Beverages', 'Coca-Cola', null),
  ('Baking Powder 500g', '6007890123456', 'BP-500G', 1.60, 2.15, 1.85, 32, 12, 'Baking', 'Royal', null)
on conflict (barcode) do nothing;
