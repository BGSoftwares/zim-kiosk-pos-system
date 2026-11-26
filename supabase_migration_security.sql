-- ============================================================================
-- ZIM KIOSK: database security hardening
-- ============================================================================
-- Run in the Supabase SQL editor AFTER supabase_schema.sql and
-- supabase_migration_roles.sql. Safe to re-run (idempotent).
--
-- What it does
--   1. Least-privilege grants: the public (anon) key can no longer touch any table,
--      and logged-in users get only the exact operations/columns the app uses.
--   2. Money fields can only change through the audited functions (create_sale,
--      record_debtor_payment, receive_stock), never by editing rows directly.
--   3. Stock ledger entries must be signed by the user who writes them.
--   4. The system can never be left without an active admin.
--   5. CHECK constraints reject negative prices/stock/amounts at the database level.
--   6. A tamper-evident audit log (admin-readable only) of sensitive changes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Least-privilege grants (RLS stays on as the second layer)
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- Tables created in the future must not be open by default either.
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from anon, public;

grant select on branches, products, sales, sale_items, debtors, debtor_transactions,
                stock_transactions, profiles, app_settings to authenticated;

grant insert, update, delete on branches to authenticated;                 -- admin-only by policy
grant insert, update, delete on products to authenticated;                 -- role rules by policy
grant insert, update on app_settings to authenticated;                     -- admin-only by policy
grant insert on stock_transactions to authenticated;                       -- append-only ledger

-- Staff: only these columns may be edited, and only by an admin (policy).
-- id, email and created_at can never be changed from the app.
grant update (full_name, role, branch_id, active, updated_at) on profiles to authenticated;

-- Debtors: contact details are editable, but the balance is NOT. total_owed and
-- last_payment move only through create_sale / record_debtor_payment.
grant insert (name, phone, address, national_id, notes, branch_id) on debtors to authenticated;
grant update (name, phone, address, national_id, notes, updated_at) on debtors to authenticated;

-- sales, sale_items, debtor_transactions: read-only from the app (written by the
-- security-definer functions). notifications, sync_logs, users: no app access.

-- Helper/trigger functions are not callable by the public key.
revoke all on function auth_role() from public, anon;
revoke all on function auth_branch() from public, anon;
grant execute on function auth_role() to authenticated;
grant execute on function auth_branch() to authenticated;
revoke all on function handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Stock ledger rows must be signed by the person writing them
-- ---------------------------------------------------------------------------
drop policy if exists stock_tx_insert on stock_transactions;
create policy stock_tx_insert on stock_transactions for insert to authenticated
  with check (auth_role() in ('admin', 'manager', 'storekeeper') and created_by = auth.uid());

-- ---------------------------------------------------------------------------
-- 3. Never lock everyone out: keep at least one active admin
-- ---------------------------------------------------------------------------
create or replace function guard_last_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role = 'admin' and old.active
     and (tg_op = 'DELETE' or new.role <> 'admin' or not new.active)
     and not exists (select 1 from profiles where role = 'admin' and active and id <> old.id) then
    raise exception 'At least one active administrator must remain';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function guard_last_admin() from public, anon, authenticated;

drop trigger if exists profiles_guard_last_admin on profiles;
create trigger profiles_guard_last_admin
  before update or delete on profiles
  for each row execute function guard_last_admin();

-- ---------------------------------------------------------------------------
-- 4. Data-integrity constraints (checked for every new write; NOT VALID so an old
--    odd row cannot block this migration. Run `alter table .. validate constraint ..`
--    after cleaning any legacy data.)
-- ---------------------------------------------------------------------------
do $$
declare
  c record;
begin
  for c in
    select * from (values
      ('products',    'products_stock_nonneg',      'stock >= 0'),
      ('products',    'products_prices_nonneg',     'buying_price >= 0 and selling_price >= 0 and wholesale_price >= 0'),
      ('products',    'products_reorder_nonneg',    'reorder_level >= 0'),
      ('sale_items',  'sale_items_qty_positive',    'quantity > 0'),
      ('sale_items',  'sale_items_price_nonneg',    'unit_price >= 0 and subtotal >= 0'),
      ('sales',       'sales_total_nonneg',         'total_amount >= 0'),
      ('debtors',     'debtors_owed_nonneg',        'total_owed >= 0'),
      ('debtor_transactions', 'debtor_tx_amount_positive', 'amount > 0')
    ) as t(tbl, name, expr)
  loop
    if not exists (select 1 from pg_constraint where conname = c.name) then
      execute format('alter table %I add constraint %I check (%s) not valid', c.tbl, c.name, c.expr);
    end if;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Audit log of sensitive changes (admins can read it; nobody can edit it)
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  actor uuid,
  actor_role text,
  table_name text not null,
  operation text not null,
  record_id text,
  old_data jsonb,
  new_data jsonb
);
alter table audit_log enable row level security;
drop policy if exists audit_log_admin_select on audit_log;
create policy audit_log_admin_select on audit_log for select to authenticated
  using (auth_role() = 'admin');
revoke all on audit_log from anon, authenticated;
grant select on audit_log to authenticated;

create or replace function write_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_new jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  -- Stock moves on every sale; that is already in stock_transactions, so only log
  -- price/identity edits on products.
  if tg_table_name = 'products' and tg_op = 'UPDATE' then
    if v_old - 'stock' - 'updated_at' = v_new - 'stock' - 'updated_at' then
      return new;
    end if;
  end if;
  if tg_op = 'UPDATE' and v_old - 'updated_at' = v_new - 'updated_at' then
    return new;
  end if;
  -- Debtor balances change on every credit sale / payment (see debtor_transactions).
  if tg_table_name = 'debtors' and tg_op = 'UPDATE' then
    if v_old - 'total_owed' - 'last_payment' - 'updated_at' = v_new - 'total_owed' - 'last_payment' - 'updated_at' then
      return new;
    end if;
  end if;

  insert into audit_log (actor, actor_role, table_name, operation, record_id, old_data, new_data)
  values (auth.uid(), auth_role(), tg_table_name, tg_op,
          coalesce(coalesce(v_new, v_old)->>'id', coalesce(v_new, v_old)->>'key'), v_old, v_new);

  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function write_audit() from public, anon, authenticated;

do $$
declare
  t text;
begin
  foreach t in array array['products', 'profiles', 'app_settings', 'branches', 'debtors'] loop
    execute format('drop trigger if exists %I on %I', t || '_audit', t);
    execute format('create trigger %I before insert or update or delete on %I for each row execute function write_audit()', t || '_audit', t);
  end loop;
end $$;
