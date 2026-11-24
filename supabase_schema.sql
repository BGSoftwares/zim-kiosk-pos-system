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

-- NOTE: run supabase_migration_roles.sql next (profiles, roles, row-level security).
-- No sample products are inserted; add your real stock from the Inventory page.
