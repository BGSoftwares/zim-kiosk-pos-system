-- ============================================================================
-- ZIM KIOSK: role-based access, real accounts, server-side sale logic
-- ============================================================================
-- Run ONCE in the Supabase SQL editor, AFTER supabase_schema.sql.
-- Safe to re-run (idempotent).
--
-- Roles: admin, manager, cashier, storekeeper, accountant
-- Accounts: create users in Supabase -> Authentication -> Users (or let them
--   sign up). The FIRST account ever created becomes the active admin. Every
--   later account starts INACTIVE as a cashier until an admin activates it and
--   sets its role/branch on the Staff page.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Profiles (one row per auth user) -- replaces the old unused `users` table
-- ---------------------------------------------------------------------------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text not null default '',
  role text not null default 'cashier'
    check (role in ('admin', 'manager', 'cashier', 'storekeeper', 'accountant')),
  branch_id uuid references branches(id) on delete set null,
  active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Auto-create a profile for every new auth user.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_first boolean;
begin
  select not exists (select 1 from profiles) into v_first;
  insert into profiles (id, email, full_name, role, branch_id, active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    case when v_first then 'admin' else 'cashier' end,
    (select id from branches order by created_at limit 1),
    v_first
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profiles for auth users that already exist (first one = admin).
insert into profiles (id, email, full_name, role, branch_id, active)
select u.id,
       u.email,
       split_part(coalesce(u.email, ''), '@', 1),
       case when row_number() over (order by u.created_at) = 1 then 'admin' else 'cashier' end,
       (select id from branches order by created_at limit 1),
       row_number() over (order by u.created_at) = 1
from auth.users u
where not exists (select 1 from profiles p where p.id = u.id)
  and not exists (select 1 from profiles where role = 'admin');

-- ---------------------------------------------------------------------------
-- 2. Point existing foreign keys at profiles; allow more payment methods
-- ---------------------------------------------------------------------------
-- Clear references to the old `users` table so the new foreign keys can be added.
update sales set cashier_id = null where cashier_id is not null and cashier_id not in (select id from profiles);
update stock_transactions set created_by = null where created_by is not null and created_by not in (select id from profiles);
delete from notifications where user_id is not null and user_id not in (select id from profiles);

-- Every sale also records its value in USD so reports can add up mixed currencies.
alter table sales add column if not exists total_usd numeric(12, 2);
update sales set total_usd = total_amount where total_usd is null and currency = 'USD';

alter table sales drop constraint if exists sales_cashier_id_fkey;
alter table sales alter column cashier_id drop not null;
alter table sales add constraint sales_cashier_id_fkey
  foreign key (cashier_id) references profiles(id) on delete set null;

alter table stock_transactions drop constraint if exists stock_transactions_created_by_fkey;
alter table stock_transactions add constraint stock_transactions_created_by_fkey
  foreign key (created_by) references profiles(id) on delete set null;

alter table notifications drop constraint if exists notifications_user_id_fkey;
alter table notifications add constraint notifications_user_id_fkey
  foreign key (user_id) references profiles(id) on delete cascade;

alter table sales drop constraint if exists sales_payment_method_check;
alter table sales add constraint sales_payment_method_check
  check (payment_method in ('cash', 'card', 'mobile', 'credit', 'ecocash', 'bank_transfer'));

-- ---------------------------------------------------------------------------
-- 3. App settings (exchange rates are managed by admins, not hard-coded)
-- ---------------------------------------------------------------------------
create table if not exists app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

insert into app_settings (key, value)
values ('exchange_rates', '{"ZiG": 0, "ZAR": 0}'::jsonb)   -- 0 = not set yet; an admin sets them in Settings
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 4. Helpers used by row-level security
-- ---------------------------------------------------------------------------
create or replace function auth_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid() and active
$$;

create or replace function auth_branch()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select branch_id from profiles where id = auth.uid() and active
$$;

-- ---------------------------------------------------------------------------
-- 5. Row-level security
-- ---------------------------------------------------------------------------
alter table profiles enable row level security;
alter table app_settings enable row level security;

-- Remove the old "everyone can read everything" policies.
drop policy if exists "Enable read access for all users" on products;
drop policy if exists "Enable read access for all users" on branches;
drop policy if exists "Enable read access for all users" on sales;
drop policy if exists "Enable read access for all users" on sale_items;
drop policy if exists "Enable read access for all users" on debtors;
drop policy if exists "Enable read access for all users" on stock_transactions;

-- profiles
drop policy if exists profiles_select on profiles;
create policy profiles_select on profiles for select to authenticated using (
  id = auth.uid()
  or auth_role() = 'admin'
  or (auth_role() in ('manager', 'accountant') and branch_id = auth_branch())
);
drop policy if exists profiles_admin_update on profiles;
create policy profiles_admin_update on profiles for update to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- branches
drop policy if exists branches_select on branches;
create policy branches_select on branches for select to authenticated using (auth_role() is not null);
drop policy if exists branches_admin_write on branches;
create policy branches_admin_write on branches for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- app_settings
drop policy if exists settings_select on app_settings;
create policy settings_select on app_settings for select to authenticated using (auth_role() is not null);
drop policy if exists settings_admin_write on app_settings;
create policy settings_admin_write on app_settings for all to authenticated
  using (auth_role() = 'admin') with check (auth_role() = 'admin');

-- products (stock is changed by cashiers only through create_sale)
drop policy if exists products_select on products;
create policy products_select on products for select to authenticated using (auth_role() is not null);
drop policy if exists products_insert on products;
create policy products_insert on products for insert to authenticated
  with check (auth_role() in ('admin', 'manager', 'storekeeper'));
drop policy if exists products_update on products;
create policy products_update on products for update to authenticated
  using (auth_role() in ('admin', 'manager', 'storekeeper'))
  with check (auth_role() in ('admin', 'manager', 'storekeeper'));
drop policy if exists products_delete on products;
create policy products_delete on products for delete to authenticated
  using (auth_role() in ('admin', 'manager'));

-- sales: admin sees all; cashiers their own; managers/accountants their branch
drop policy if exists sales_select on sales;
create policy sales_select on sales for select to authenticated using (
  auth_role() = 'admin'
  or (auth_role() in ('manager', 'accountant') and branch_id = auth_branch())
  or (auth_role() = 'cashier' and cashier_id = auth.uid())
);

drop policy if exists sale_items_select on sale_items;
create policy sale_items_select on sale_items for select to authenticated using (
  exists (select 1 from sales s where s.id = sale_items.sale_id)  -- sales RLS applies
);

-- debtors / debtor_transactions: admin, manager, accountant (branch-scoped)
drop policy if exists debtors_select on debtors;
create policy debtors_select on debtors for select to authenticated using (
  auth_role() = 'admin'
  or (auth_role() in ('manager', 'accountant') and branch_id = auth_branch())
);
drop policy if exists debtors_insert on debtors;
create policy debtors_insert on debtors for insert to authenticated with check (
  auth_role() = 'admin'
  or (auth_role() in ('manager', 'accountant') and branch_id = auth_branch())
);
drop policy if exists debtors_update on debtors;
create policy debtors_update on debtors for update to authenticated using (
  auth_role() = 'admin'
  or (auth_role() in ('manager', 'accountant') and branch_id = auth_branch())
);

drop policy if exists debtor_tx_select on debtor_transactions;
create policy debtor_tx_select on debtor_transactions for select to authenticated using (
  exists (select 1 from debtors d where d.id = debtor_transactions.debtor_id)  -- debtors RLS applies
);

-- stock_transactions
drop policy if exists stock_tx_select on stock_transactions;
create policy stock_tx_select on stock_transactions for select to authenticated
  using (auth_role() in ('admin', 'manager', 'storekeeper', 'accountant'));
drop policy if exists stock_tx_insert on stock_transactions;
create policy stock_tx_insert on stock_transactions for insert to authenticated
  with check (auth_role() in ('admin', 'manager', 'storekeeper'));

-- notifications / sync_logs: no client access (RLS enabled, no policies)

-- ---------------------------------------------------------------------------
-- 6. create_sale: all sale rules enforced on the server, in one transaction
-- ---------------------------------------------------------------------------
-- The client sends only product ids, quantities and discounts. Prices come from
-- the products table, the cashier is the logged-in user, and the total is
-- computed here, so none of it can be tampered with from the browser.
drop function if exists create_sale(jsonb, jsonb);

create or replace function create_sale(
  p_payment_method text,
  p_currency text,
  p_items jsonb,
  p_customer_phone text default null,
  p_customer_name text default null,
  p_branch_id uuid default null
)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role     text := auth_role();
  v_branch   uuid;
  v_rate     numeric := 1;
  v_sale     sales;
  v_item     jsonb;
  v_prod     products;
  v_qty      integer;
  v_disc     numeric;
  v_price    numeric;
  v_sub      numeric;
  v_total    numeric := 0;   -- in the sale currency
  v_usd      numeric := 0;   -- in USD
  v_usd_line numeric;
  v_debtor   uuid;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'cashier') then
    raise exception 'Your role is not allowed to make sales';
  end if;

  -- Non-admins can only sell for their own branch.
  v_branch := case when v_role = 'admin' then coalesce(p_branch_id, auth_branch()) else auth_branch() end;
  if v_branch is null then
    raise exception 'No branch assigned to this account';
  end if;

  if p_payment_method not in ('cash', 'card', 'mobile', 'credit', 'ecocash', 'bank_transfer') then
    raise exception 'Invalid payment method';
  end if;
  if p_payment_method = 'credit' and coalesce(trim(p_customer_phone), '') = '' then
    raise exception 'A customer phone number is required for credit sales';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one item';
  end if;

  if p_currency <> 'USD' then
    select (value->>p_currency)::numeric into v_rate from app_settings where key = 'exchange_rates';
    if v_rate is null or v_rate <= 0 then
      raise exception 'No exchange rate set for %', p_currency;
    end if;
  end if;

  insert into sales (total_amount, payment_method, currency, cashier_id, branch_id, customer_phone)
  values (0, p_payment_method, p_currency, auth.uid(), v_branch, nullif(trim(p_customer_phone), ''))
  returning * into v_sale;

  -- Lock products in a stable order so concurrent sales cannot deadlock or oversell.
  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    v_qty  := (v_item->>'quantity')::integer;
    v_disc := coalesce((v_item->>'discount')::numeric, 0);

    if v_qty is null or v_qty < 1 then raise exception 'Invalid quantity'; end if;
    if v_disc < 0 or v_disc > 100 then raise exception 'Discount must be between 0 and 100'; end if;
    if v_disc > 0 and v_role = 'cashier' and v_disc > 10 then
      raise exception 'Cashiers can give at most 10%% discount';
    end if;

    select * into v_prod from products where id = (v_item->>'product_id')::uuid for update;
    if not found then raise exception 'Product not found'; end if;
    if v_prod.stock < v_qty then
      raise exception 'Insufficient stock for % (have %, need %)', v_prod.name, v_prod.stock, v_qty;
    end if;

    v_price := round(v_prod.selling_price * v_rate, 2);
    v_sub   := round(v_price * v_qty * (1 - v_disc / 100), 2);
    v_usd_line := round(v_prod.selling_price * v_qty * (1 - v_disc / 100), 2);
    v_total := v_total + v_sub;
    v_usd   := v_usd + v_usd_line;

    insert into sale_items (sale_id, product_id, quantity, unit_price, discount, subtotal)
    values (v_sale.id, v_prod.id, v_qty, v_price, v_disc, v_sub);

    update products set stock = stock - v_qty, updated_at = now() where id = v_prod.id;

    insert into stock_transactions (product_id, transaction_type, quantity_change, reference_id, notes, created_by)
    values (v_prod.id, 'sale', -v_qty, v_sale.id, 'Sale', auth.uid());
  end loop;

  update sales set total_amount = v_total, total_usd = v_usd where id = v_sale.id returning * into v_sale;

  -- Credit sale: add to the customer's debt (create the debtor if new).
  if p_payment_method = 'credit' then
    select id into v_debtor from debtors
      where branch_id = v_branch and phone = trim(p_customer_phone) for update;
    if v_debtor is null then
      insert into debtors (name, phone, total_owed, branch_id, notes)
      values (coalesce(nullif(trim(p_customer_name), ''), 'Customer ' || right(trim(p_customer_phone), 4)),
              trim(p_customer_phone), v_usd, v_branch, 'Created from a credit sale')
      returning id into v_debtor;
    else
      update debtors set total_owed = total_owed + v_usd, updated_at = now() where id = v_debtor;
    end if;
    insert into debtor_transactions (debtor_id, sale_id, transaction_type, amount)
    values (v_debtor, v_sale.id, 'credit', v_usd);
  end if;

  return v_sale;
end;
$$;

revoke all on function create_sale(text, text, jsonb, text, text, uuid) from public, anon;
grant execute on function create_sale(text, text, jsonb, text, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Record a debtor payment atomically (admin, manager, accountant).
--    Debts are tracked in USD.
-- ---------------------------------------------------------------------------
create or replace function record_debtor_payment(p_debtor_id uuid, p_amount numeric, p_reference text default null)
returns debtors
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := auth_role();
  v_d    debtors;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'accountant') then
    raise exception 'Your role cannot record debtor payments';
  end if;
  if p_amount is null or p_amount <= 0 then
    raise exception 'Payment must be greater than 0';
  end if;

  select * into v_d from debtors where id = p_debtor_id for update;
  if not found then raise exception 'Debtor not found'; end if;
  if v_role <> 'admin' and v_d.branch_id is distinct from auth_branch() then
    raise exception 'Debtor belongs to another branch';
  end if;
  if p_amount > v_d.total_owed then
    raise exception 'Payment is more than the amount owed (%)', v_d.total_owed;
  end if;

  update debtors
     set total_owed = total_owed - p_amount, last_payment = now(), updated_at = now()
   where id = p_debtor_id
   returning * into v_d;

  insert into debtor_transactions (debtor_id, transaction_type, amount, reference)
  values (p_debtor_id, 'payment', p_amount, p_reference);

  return v_d;
end;
$$;

revoke all on function record_debtor_payment(uuid, numeric, text) from public, anon;
grant execute on function record_debtor_payment(uuid, numeric, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Receive stock (scan-in): add delivered quantities in ONE transaction and log them.
--    Roles: admin, manager, storekeeper.
--    p_items = [{"product_id": "<uuid>", "quantity": 12}, ...]
-- ---------------------------------------------------------------------------
create or replace function receive_stock(p_items jsonb, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role  text := auth_role();
  v_item  jsonb;
  v_qty   integer;
  v_pid   uuid;
  v_units integer := 0;
begin
  if v_role is null or v_role not in ('admin', 'manager', 'storekeeper') then
    raise exception 'Your role cannot receive stock';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'Nothing to receive';
  end if;

  -- stable lock order avoids deadlocks between two people receiving at once
  for v_item in
    select value from jsonb_array_elements(p_items) order by value->>'product_id'
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    if v_qty is null or v_qty < 1 or v_qty > 100000 then
      raise exception 'Quantity must be between 1 and 100000';
    end if;

    perform 1 from products where id = v_pid for update;
    if not found then
      raise exception 'Product not found';
    end if;

    update products set stock = stock + v_qty, updated_at = now() where id = v_pid;

    insert into stock_transactions (product_id, transaction_type, quantity_change, notes, created_by)
    values (v_pid, 'purchase', v_qty, coalesce(nullif(trim(p_note), ''), 'Stock received (scan)'), auth.uid());

    v_units := v_units + v_qty;
  end loop;

  return v_units;
end;
$$;

revoke all on function receive_stock(jsonb, text) from public, anon;
grant execute on function receive_stock(jsonb, text) to authenticated;
