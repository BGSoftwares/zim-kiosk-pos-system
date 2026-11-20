-- Atomic sale creation.
-- Run once in the Supabase SQL editor. Inserts the sale, its items, decrements
-- stock and logs stock transactions in ONE transaction. Rows are locked
-- (FOR UPDATE) so concurrent sales cannot oversell, and any failure rolls
-- everything back.
--
-- SECURITY: runs as the function owner (security definer) because RLS on the
-- sales tables currently has only SELECT policies. Tighten the grants below
-- once real auth is in place.

create or replace function create_sale(p_sale jsonb, p_items jsonb)
returns sales
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sale   sales;
  v_item   jsonb;
  v_stock  integer;
  v_qty    integer;
  v_pid    uuid;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'A sale needs at least one item';
  end if;

  insert into sales (sale_date, total_amount, payment_method, currency,
                     cashier_id, branch_id, customer_phone, notes)
  values (coalesce((p_sale->>'sale_date')::timestamptz, now()),
          (p_sale->>'total_amount')::numeric,
          p_sale->>'payment_method',
          coalesce(p_sale->>'currency', 'ZWL'),
          (p_sale->>'cashier_id')::uuid,
          (p_sale->>'branch_id')::uuid,
          p_sale->>'customer_phone',
          p_sale->>'notes')
  returning * into v_sale;

  -- Lock products in a stable order to avoid deadlocks between concurrent sales
  for v_item in
    select value from jsonb_array_elements(p_items)
    order by value->>'product_id'
  loop
    v_pid := (v_item->>'product_id')::uuid;
    v_qty := (v_item->>'quantity')::integer;

    if v_qty is null or v_qty < 1 then
      raise exception 'Invalid quantity for product %', v_pid;
    end if;

    select stock into v_stock from products where id = v_pid for update;
    if not found then
      raise exception 'Product % not found', v_pid;
    end if;
    if v_stock < v_qty then
      raise exception 'Insufficient stock for product % (have %, need %)', v_pid, v_stock, v_qty;
    end if;

    insert into sale_items (sale_id, product_id, quantity, unit_price, discount, subtotal)
    values (v_sale.id, v_pid, v_qty,
            (v_item->>'unit_price')::numeric,
            coalesce((v_item->>'discount')::numeric, 0),
            (v_item->>'subtotal')::numeric);

    update products set stock = stock - v_qty, updated_at = now() where id = v_pid;

    insert into stock_transactions (product_id, transaction_type, quantity_change, reference_id, notes)
    values (v_pid, 'sale', -v_qty, v_sale.id, 'Sale transaction');
  end loop;

  return v_sale;
end;
$$;

revoke all on function create_sale(jsonb, jsonb) from public;
grant execute on function create_sale(jsonb, jsonb) to anon, authenticated;
