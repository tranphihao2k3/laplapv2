-- ============================================================================
-- Module: Quản lý đơn hàng (hoàn thiện)
-- Thêm 3 bảng: order_status_logs, return_orders, return_order_items
-- Thêm trigger tự log status, RPC tạo đơn trả + hoàn stock atomic
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. order_status_logs — lịch sử thay đổi status & payment_status
-- ----------------------------------------------------------------------------
create table if not exists public.order_status_logs (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  organization_id uuid references public.organizations(id) on delete set null,
  from_status text,
  to_status text,
  from_payment_status text,
  to_payment_status text,
  from_fulfillment_status text,
  to_fulfillment_status text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_order_status_logs_order on public.order_status_logs(order_id);
create index if not exists idx_order_status_logs_created on public.order_status_logs(created_at desc);
create index if not exists idx_order_status_logs_org on public.order_status_logs(organization_id);

alter table public.order_status_logs enable row level security;

drop policy if exists order_status_logs_select on public.order_status_logs;
create policy order_status_logs_select on public.order_status_logs
  for select using (auth.uid() is not null);

drop policy if exists order_status_logs_insert on public.order_status_logs;
create policy order_status_logs_insert on public.order_status_logs
  for insert with check (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- 2. return_orders — đơn trả hàng
-- ----------------------------------------------------------------------------
create table if not exists public.return_orders (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  order_id uuid not null references public.orders(id) on delete restrict,
  return_number text not null unique,
  status text not null default 'pending' check (status in ('pending','approved','rejected','refunded','completed','cancelled')),
  reason text,
  refund_amount numeric default 0,
  refund_method text check (refund_method in ('cash','card','transfer','ewallet','credit','store_credit')),
  refund_status text default 'unpaid' check (refund_status in ('unpaid','partial','paid')),
  note text,
  created_by uuid references auth.users(id) on delete set null,
  approved_by uuid references auth.users(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_return_orders_order on public.return_orders(order_id);
create index if not exists idx_return_orders_status on public.return_orders(status);
create index if not exists idx_return_orders_created on public.return_orders(created_at desc);
create index if not exists idx_return_orders_org on public.return_orders(organization_id);

alter table public.return_orders enable row level security;

drop policy if exists return_orders_all on public.return_orders;
create policy return_orders_all on public.return_orders
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- 3. return_order_items — chi tiết món trả
-- ----------------------------------------------------------------------------
create table if not exists public.return_order_items (
  id uuid primary key default gen_random_uuid(),
  return_order_id uuid not null references public.return_orders(id) on delete cascade,
  order_item_id uuid references public.order_items(id) on delete set null,
  product_variant_id uuid not null references public.product_variants(id) on delete restrict,
  quantity int not null check (quantity > 0),
  unit_price numeric not null default 0,
  total_price numeric not null default 0,
  reason text,
  restock boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_return_order_items_return on public.return_order_items(return_order_id);
create index if not exists idx_return_order_items_variant on public.return_order_items(product_variant_id);

alter table public.return_order_items enable row level security;

drop policy if exists return_order_items_all on public.return_order_items;
create policy return_order_items_all on public.return_order_items
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- ----------------------------------------------------------------------------
-- 4. Trigger: tự ghi log mỗi khi orders.status/payment_status/fulfillment_status đổi
-- ----------------------------------------------------------------------------
create or replace function public.log_order_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE') then
    if new.status is distinct from old.status
       or new.payment_status is distinct from old.payment_status
       or new.fulfillment_status is distinct from old.fulfillment_status then
      insert into public.order_status_logs(
        order_id, organization_id,
        from_status, to_status,
        from_payment_status, to_payment_status,
        from_fulfillment_status, to_fulfillment_status,
        changed_by
      ) values (
        new.id, new.organization_id,
        old.status, new.status,
        old.payment_status, new.payment_status,
        old.fulfillment_status, new.fulfillment_status,
        auth.uid()
      );
    end if;
  elsif (tg_op = 'INSERT') then
    insert into public.order_status_logs(
      order_id, organization_id,
      from_status, to_status,
      from_payment_status, to_payment_status,
      from_fulfillment_status, to_fulfillment_status,
      changed_by,
      note
    ) values (
      new.id, new.organization_id,
      null, new.status,
      null, new.payment_status,
      null, new.fulfillment_status,
      auth.uid(),
      'Khởi tạo đơn'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_order_status on public.orders;
create trigger trg_log_order_status
  after insert or update of status, payment_status, fulfillment_status
  on public.orders
  for each row
  execute function public.log_order_status_change();

-- ----------------------------------------------------------------------------
-- 5. RPC change_order_status — đổi status thủ công kèm note (note ghi vào log)
-- ----------------------------------------------------------------------------
create or replace function public.change_order_status(
  p_order_id uuid,
  p_to_status text default null,
  p_to_payment_status text default null,
  p_to_fulfillment_status text default null,
  p_note text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_order public.orders%rowtype;
begin
  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Không tìm thấy đơn hàng %', p_order_id;
  end if;

  update public.orders
     set status = coalesce(p_to_status, status),
         payment_status = coalesce(p_to_payment_status, payment_status),
         fulfillment_status = coalesce(p_to_fulfillment_status, fulfillment_status)
   where id = p_order_id
   returning * into v_order;

  -- ghi note bổ sung vào log mới nhất (trigger đã tạo dòng trước đó)
  if p_note is not null and length(p_note) > 0 then
    update public.order_status_logs
       set note = p_note
     where id = (
       select id from public.order_status_logs
        where order_id = p_order_id
        order by created_at desc
        limit 1
     );
  end if;

  return v_order;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RPC create_return_order — tạo đơn trả + items + cộng lại stock (atomic)
--    payload jsonb: { order_id, reason, refund_amount, refund_method, note,
--                     items: [{ order_item_id?, product_variant_id, quantity,
--                                unit_price, restock, reason }] }
-- ----------------------------------------------------------------------------
create or replace function public.create_return_order(payload jsonb)
returns public.return_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.return_orders%rowtype;
  v_order public.orders%rowtype;
  v_item jsonb;
  v_return_number text;
  v_total numeric := 0;
  v_org uuid;
begin
  select * into v_order from public.orders
   where id = (payload->>'order_id')::uuid;
  if not found then
    raise exception 'Đơn gốc không tồn tại';
  end if;

  v_org := v_order.organization_id;
  v_return_number := 'RT-' || to_char(now(), 'YYYYMMDDHH24MISS') || '-' || substr(md5(random()::text), 1, 4);

  insert into public.return_orders(
    organization_id, order_id, return_number, reason, refund_amount,
    refund_method, note, created_by, status
  ) values (
    v_org,
    v_order.id,
    v_return_number,
    payload->>'reason',
    coalesce((payload->>'refund_amount')::numeric, 0),
    payload->>'refund_method',
    payload->>'note',
    auth.uid(),
    coalesce(payload->>'status', 'pending')
  )
  returning * into v_return;

  for v_item in select * from jsonb_array_elements(coalesce(payload->'items', '[]'::jsonb))
  loop
    insert into public.return_order_items(
      return_order_id, order_item_id, product_variant_id,
      quantity, unit_price, total_price, reason, restock
    ) values (
      v_return.id,
      nullif(v_item->>'order_item_id','')::uuid,
      (v_item->>'product_variant_id')::uuid,
      (v_item->>'quantity')::int,
      coalesce((v_item->>'unit_price')::numeric, 0),
      coalesce((v_item->>'unit_price')::numeric, 0) * coalesce((v_item->>'quantity')::int, 0),
      v_item->>'reason',
      coalesce((v_item->>'restock')::boolean, true)
    );

    v_total := v_total + coalesce((v_item->>'unit_price')::numeric, 0) * coalesce((v_item->>'quantity')::int, 0);
  end loop;

  -- nếu user không truyền refund_amount, dùng tổng tính được
  if (payload->>'refund_amount') is null then
    update public.return_orders set refund_amount = v_total where id = v_return.id returning * into v_return;
  end if;

  return v_return;
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. RPC approve_return_order — duyệt + cộng lại stock + ghi inventory_transactions
-- ----------------------------------------------------------------------------
create or replace function public.approve_return_order(p_return_id uuid, p_warehouse_id uuid default null)
returns public.return_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  v_return public.return_orders%rowtype;
  v_item public.return_order_items%rowtype;
  v_wh uuid;
begin
  select * into v_return from public.return_orders where id = p_return_id for update;
  if not found then raise exception 'Đơn trả không tồn tại'; end if;
  if v_return.status not in ('pending') then
    raise exception 'Chỉ duyệt được đơn ở trạng thái pending (hiện: %)', v_return.status;
  end if;

  -- chọn kho mặc định nếu không truyền
  v_wh := p_warehouse_id;
  if v_wh is null then
    select id into v_wh from public.warehouses
     where organization_id = v_return.organization_id
     order by created_at limit 1;
  end if;

  for v_item in
    select * from public.return_order_items where return_order_id = p_return_id
  loop
    if v_item.restock and v_wh is not null then
      -- cộng stock
      insert into public.stock_levels(warehouse_id, product_variant_id, available_qty)
      values (v_wh, v_item.product_variant_id, v_item.quantity)
      on conflict (warehouse_id, product_variant_id)
      do update set available_qty = public.stock_levels.available_qty + excluded.available_qty;

      -- ghi giao dịch kho nếu bảng tồn tại
      begin
        insert into public.inventory_transactions(
          warehouse_id, product_variant_id, type, quantity, reference_type, reference_id, note
        ) values (
          v_wh, v_item.product_variant_id, 'return_in', v_item.quantity, 'return_orders', p_return_id,
          'Hoàn kho từ đơn trả ' || v_return.return_number
        );
      exception when undefined_table or undefined_column then
        -- bỏ qua nếu schema khác
        null;
      end;
    end if;
  end loop;

  update public.return_orders
     set status = 'approved',
         approved_by = auth.uid(),
         approved_at = now(),
         updated_at = now()
   where id = p_return_id
   returning * into v_return;

  return v_return;
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. Quyền cho các permission key mới (nếu hệ thống dùng RBAC mềm)
--    Bảng permissions seed — bỏ qua nếu schema khác
-- ----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema='public' and table_name='permissions') then
    insert into public.permissions(key, label) values
      ('returns.read',    'Xem đơn trả'),
      ('returns.create',  'Tạo đơn trả'),
      ('returns.update',  'Cập nhật đơn trả'),
      ('returns.delete',  'Xoá đơn trả'),
      ('returns.approve', 'Duyệt đơn trả'),
      ('orders.change_status', 'Đổi trạng thái đơn hàng'),
      ('reports.read',    'Xem báo cáo')
    on conflict (key) do nothing;
  end if;
exception when undefined_column then
  -- bảng permissions có schema khác (vd: name thay vì key) → skip
  null;
end$$;

-- ----------------------------------------------------------------------------
-- 9. View báo cáo doanh thu theo ngày (tiện gọi từ /v1/reports/revenue)
-- ----------------------------------------------------------------------------
create or replace view public.v_revenue_daily as
select
  date_trunc('day', created_at) as day,
  organization_id,
  shop_id,
  count(*) filter (where status in ('completed','fulfilled')) as completed_orders,
  count(*) filter (where status = 'cancelled') as cancelled_orders,
  sum(total_amount) filter (where status in ('completed','fulfilled')) as revenue,
  sum(total_amount) filter (where status = 'cancelled') as cancelled_amount
from public.orders
group by 1, 2, 3;

comment on view public.v_revenue_daily is 'Tổng doanh thu theo ngày — dùng cho /quanly/reports/revenue';
