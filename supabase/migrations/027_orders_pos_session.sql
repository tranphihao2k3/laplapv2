-- ============================================================================
-- Module: Liên kết POS sessions ↔ orders + sửa logic close_pos_session
-- Mục đích:
--   1. Mỗi đơn POS gắn với 1 ca → đối soát tiền mặt chính xác cho ca đó
--   2. close_pos_session tính expected_cash chỉ từ các orders thuộc session
--   3. Thay thế function checkout_order để chấp nhận pos_session_id
-- ============================================================================

-- 1. Cột pos_session_id trên orders
alter table public.orders
  add column if not exists pos_session_id uuid references public.pos_sessions(id) on delete set null;

create index if not exists idx_orders_pos_session on public.orders(pos_session_id);
create index if not exists idx_orders_pos_session_paid
  on public.orders(pos_session_id, paid_at)
  where pos_session_id is not null;

-- 2. Thay thế checkout_order: thêm trường pos_session_id trong payload,
--    nếu có thì ghi vào insert orders.
-- (Hai function dưới đây do migration ngoài tạo, ta chỉ DROP + CREATE lại)
DROP FUNCTION IF EXISTS public.checkout_order(jsonb);
CREATE FUNCTION public.checkout_order(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user uuid := auth.uid();
  v_org uuid := public.current_org_id();
  v_shop_id uuid := (payload->>'shop_id')::uuid;
  v_customer_id uuid := nullif(payload->>'customer_id','')::uuid;
  v_channel text := coalesce(payload->>'channel', 'pos');
  v_discount numeric := coalesce((payload->>'discount_amount')::numeric, 0);
  v_note text := payload->>'note';
  v_pos_session_id uuid := nullif(payload->>'pos_session_id','')::uuid;
  v_warehouse uuid;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal numeric := 0;
  v_total numeric := 0;
  v_item jsonb;
  v_variant_id uuid;
  v_qty int;
  v_price numeric;
  v_line_total numeric;
  v_serial_id uuid;
  v_stock int;
  v_pay jsonb := payload->'payment';
  v_pay_amount numeric;
  v_loyalty_points int := 0;
  v_default_warranty_months int := 12;
  v_warranty_months int := 0;
  v_warranty_raw text;
  v_remaining int;
  v_take int;
  v_wh record;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_org is null then raise exception 'NO_ORG'; end if;

  -- Nếu có pos_session_id thì kiểm tra hợp lệ
  if v_pos_session_id is not null then
    if not exists (
      select 1 from public.pos_sessions
      where id = v_pos_session_id
        and shop_id = v_shop_id
        and opened_by = v_user
        and closed_at is null
    ) then
      raise exception 'POS_SESSION_INVALID';
    end if;
  end if;

  select id into v_warehouse from public.warehouses
   where shop_id = v_shop_id
   order by case when type='store' then 0 else 1 end, created_at
   limit 1;
  if v_warehouse is null then raise exception 'NO_WAREHOUSE_FOR_SHOP'; end if;

  select coalesce((value #>> '{}')::int, 12)
    into v_default_warranty_months
    from public.settings
   where organization_id = v_org and key = 'default_warranty_months'
   limit 1;
  if v_default_warranty_months is null then v_default_warranty_months := 12; end if;

  v_order_number := 'LPL-' || to_char(now(),'YYYYMMDD') || '-' ||
    lpad((floor(random()*9000)+1000)::int::text, 4, '0');

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_variant_id := (v_item->>'product_variant_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := coalesce(
      (v_item->>'unit_price')::numeric,
      (select selling_price from public.product_variants where id = v_variant_id)
    );
    v_line_total := v_qty * v_price;
    v_subtotal := v_subtotal + v_line_total;

    select coalesce(sum(sl.available_qty), 0) into v_stock
      from public.stock_levels sl
      join public.warehouses w on w.id = sl.warehouse_id
     where w.shop_id = v_shop_id
       and sl.product_variant_id = v_variant_id;
    if coalesce(v_stock, 0) < v_qty then
      raise exception 'INSUFFICIENT_STOCK: variant=% qty=% have=%', v_variant_id, v_qty, coalesce(v_stock,0);
    end if;
  end loop;

  v_total := greatest(0, v_subtotal - v_discount);

  insert into public.orders(id, organization_id, shop_id, customer_id, order_number,
                            channel, status, payment_status, fulfillment_status,
                            subtotal, discount_amount, total_amount, note, created_by,
                            pos_session_id)
  values (v_order_id, v_org, v_shop_id, v_customer_id, v_order_number,
          v_channel, 'completed', 'paid', 'delivered',
          v_subtotal, v_discount, v_total, v_note, v_user,
          v_pos_session_id);

  for v_item in select * from jsonb_array_elements(payload->'items') loop
    v_variant_id := (v_item->>'product_variant_id')::uuid;
    v_qty := (v_item->>'quantity')::int;
    v_price := coalesce(
      (v_item->>'unit_price')::numeric,
      (select selling_price from public.product_variants where id = v_variant_id)
    );
    v_line_total := v_qty * v_price;
    v_serial_id := nullif(v_item->>'serial_id','')::uuid;

    insert into public.order_items(order_id, product_variant_id, quantity, unit_price, total_price, product_snapshot)
    values (v_order_id, v_variant_id, v_qty, v_price, v_line_total,
            (select to_jsonb(pv.*) from public.product_variants pv where pv.id = v_variant_id));

    v_remaining := v_qty;
    for v_wh in
      select sl.warehouse_id, sl.available_qty
        from public.stock_levels sl
        join public.warehouses w on w.id = sl.warehouse_id
       where w.shop_id = v_shop_id
         and sl.product_variant_id = v_variant_id
         and sl.available_qty > 0
       order by sl.available_qty desc
    loop
      exit when v_remaining <= 0;
      v_take := least(v_wh.available_qty, v_remaining);
      update public.stock_levels
         set available_qty = available_qty - v_take
       where warehouse_id = v_wh.warehouse_id and product_variant_id = v_variant_id;
      insert into public.inventory_transactions(organization_id, warehouse_id, product_variant_id,
                                                serial_number_id, type, quantity, reference_type, reference_id, created_by)
      values (v_org, v_wh.warehouse_id, v_variant_id, v_serial_id, 'sale', -v_take, 'order', v_order_id, v_user);
      v_remaining := v_remaining - v_take;
    end loop;

    if v_remaining > 0 then
      raise exception 'INSUFFICIENT_STOCK: variant=% qty=% have=%', v_variant_id, v_qty, v_qty - v_remaining;
    end if;

    if v_serial_id is not null then
      update public.serial_numbers
         set status='sold', sold_at = now()
       where id = v_serial_id;
    end if;

    select coalesce(
      pv.specs->>'warranty',
      pv.specs->>'bao_hanh',
      pv.attributes->>'warranty',
      pv.attributes->>'bao_hanh',
      ''
    ) into v_warranty_raw
      from public.product_variants pv
     where pv.id = v_variant_id;

    begin
      v_warranty_months := nullif(regexp_replace(coalesce(v_warranty_raw, ''), '[^0-9]', '', 'g'), '')::int;
    exception when others then
      v_warranty_months := null;
    end;

    if v_warranty_months is null or v_warranty_months <= 0 then
      v_warranty_months := v_default_warranty_months;
    end if;

    if coalesce(v_warranty_months, 0) > 0 then
      insert into public.warranties(serial_number_id, customer_id, order_id, start_date, end_date, status)
      values (
        v_serial_id,
        v_customer_id,
        v_order_id,
        current_date,
        (current_date + make_interval(months => v_warranty_months))::date,
        'active'
      );
    end if;
  end loop;

  if v_pay is not null then
    v_pay_amount := coalesce((v_pay->>'amount')::numeric, v_total);
    insert into public.payments(order_id, method, amount, status, transaction_code, paid_at)
    values (v_order_id, v_pay->>'method', v_pay_amount, 'paid', v_pay->>'transaction_code', now());
  end if;

  if v_customer_id is not null and v_total > 0 then
    v_loyalty_points := floor(v_total / 10000)::int;
    if v_loyalty_points > 0 then
      insert into public.loyalty_transactions(customer_id, order_id, points, type)
      values (v_customer_id, v_order_id, v_loyalty_points, 'earn');
      update public.customers
         set loyalty_points = coalesce(loyalty_points,0) + v_loyalty_points
       where id = v_customer_id;
    end if;
  end if;

  insert into public.audit_logs(organization_id, user_id, entity_type, entity_id, action, after_data)
  values (v_org, v_user, 'order', v_order_id, 'checkout',
          jsonb_build_object('order_number', v_order_number, 'total', v_total,
                             'pos_session_id', v_pos_session_id));

  return jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'total', v_total,
    'loyalty_earned', v_loyalty_points,
    'pos_session_id', v_pos_session_id
  );
end;
$$;

-- 3. Sửa close_pos_session: lọc theo pos_session_id thay vì opened_at
DROP FUNCTION IF EXISTS public.close_pos_session(uuid, numeric);
CREATE FUNCTION public.close_pos_session(
  p_session_id uuid,
  p_closing_cash numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  v_user uuid := auth.uid();
  v_session record;
  v_expected numeric := 0;
  v_diff numeric;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;

  select * into v_session from public.pos_sessions where id = p_session_id;
  if v_session.id is null then raise exception 'SESSION_NOT_FOUND'; end if;
  if v_session.closed_at is not null then raise exception 'SESSION_ALREADY_CLOSED'; end if;
  if v_session.opened_by <> v_user then raise exception 'SESSION_NOT_OWNED'; end if;

  select coalesce(sum(p.amount), 0) into v_expected
    from public.payments p
    join public.orders o on o.id = p.order_id
   where o.pos_session_id = p_session_id
     and p.method = 'cash';

  v_expected := v_expected + coalesce(v_session.opening_cash, 0);
  v_diff := p_closing_cash - v_expected;

  update public.pos_sessions
     set closed_at = now(),
         closing_cash = p_closing_cash,
         expected_cash = v_expected,
         difference_cash = v_diff
   where id = p_session_id;

  return jsonb_build_object(
    'session_id', p_session_id,
    'expected_cash', v_expected,
    'closing_cash', p_closing_cash,
    'difference', v_diff
  );
end;
$$;
