# LapLap API — Task Breakdown

> Tài liệu tổng hợp công việc cần làm để build API CRUD + business logic cho schema Supabase hiện tại.
> Schema: 28 bảng `public.*` + tham chiếu `auth.users`. Multi-tenant theo `organization_id`, scope theo `shop_id`.

---

## 0. Trả lời nhanh

**Có dựng API được từ schema này không?** Có. 28 bảng đều có khóa chính `uuid` + FK đầy đủ → đủ thông tin để generate CRUD. Khoảng **80% endpoint chỉ là CRUD thuần**, phần còn lại (orders, inventory, POS, loyalty, warranty) cần xử lý nghiệp vụ trong transaction.

**Kiến trúc API đề xuất:** Next.js 15 App Router → Server Actions cho mutation từ UI nội bộ, Route Handlers (`/api/v1/*`) cho REST endpoint công khai / mobile. Cả hai cùng gọi chung **service layer** (`src/server/services/*`) để tránh trùng logic.

```
[Client / Mobile]
   │
   ├─► Route Handler (REST)  ─┐
   ├─► Server Action          ├─► Service (business logic) ─► Supabase client (RLS) / Admin client (jobs)
   └─► RPC (postgres function)┘
```

---

## 1. Foundation (làm trước, chặn mọi thứ)

### F1. Sinh TypeScript types từ schema  ⚠️ blocker
- **Why:** `client.ts`, `server.ts`, `admin.ts` đều import `Database` từ `@/types/database` nhưng file đó hiện đang rỗng/cũ.
- **Do:**
  ```powershell
  npx supabase login
  npx supabase gen types typescript --project-id bmvgnhgxbkrhixydsqjh --schema public > src/types/database.ts
  ```
- **Done when:** `import { Database } from "@/types/database"` không lỗi TS, các bảng autocomplete trong `.from(...)`.

### F2. Bật RLS + policy cơ bản theo `organization_id`
- **Why:** Schema chưa thấy policy. Nếu để mở, anon key của bạn (`sb_publishable_*`) sẽ truy cập được mọi org.
- **Do:** Trong SQL Editor, với mỗi bảng có `organization_id`:
  ```sql
  alter table public.products enable row level security;

  create policy "tenant_isolation_select" on public.products
    for select using (
      organization_id = (
        select organization_id from public.user_profiles where id = auth.uid()
      )
    );
  -- repeat for insert/update/delete + các bảng khác
  ```
- **Pattern phụ:** với `order_items`, `payments` (không có `organization_id` trực tiếp) → policy join qua `orders.organization_id`.
- **Done when:** Test bằng anon key — query thấy đúng dữ liệu của user, không thấy org khác.

### F3. Helper bắt buộc kiểm tra session
- **File:** `src/lib/api/guard.ts` (đã tồn tại — bổ sung)
- **Hàm cần có:**
  - `getCurrentUser()` → throw 401 nếu chưa login.
  - `getCurrentOrgId()` → lấy `organization_id` từ `user_profiles` của user hiện tại.
  - `requirePermission(code)` → check qua `shop_staff → roles → role_permissions → permissions`.
- **Done when:** Mọi service đều dùng 3 hàm trên thay vì query trực tiếp `auth.users`.

### F4. Chuẩn hóa response & error
- **File:** `src/lib/api/response.ts` (đã có — review lại)
- **Shape thống nhất:**
  ```ts
  // success
  { ok: true, data: T }
  // error
  { ok: false, error: { code: string; message: string; details?: unknown } }
  ```
- **Done when:** Mọi route handler return qua `ok()` / `fail()` helper.

### F5. Zod validator per bảng
- **Folder:** `src/lib/validators/` (đã có `auth.ts`, `order.ts`, `product.ts` — bổ sung)
- **Quy ước:** Mỗi bảng 1 file, export `createXxxSchema`, `updateXxxSchema`, `xxxQuerySchema` (filter + paginate).

---

## 2. CRUD thuần (chia theo domain, mỗi ô là 1 PR)

> Mỗi entity tạo:
> - `src/lib/validators/<entity>.ts`
> - `src/server/services/<entity>-service.ts` (list/get/create/update/delete)
> - `src/app/api/v1/<entity>/route.ts` (GET list, POST create)
> - `src/app/api/v1/<entity>/[id]/route.ts` (GET, PATCH, DELETE)
> - `src/actions/<entity>.ts` (server actions wrap service cho UI)

### Domain A — Tổ chức & nhân sự
- [ ] **A1. organizations** — chỉ admin được tạo/sửa. List chỉ trả org của user.
- [ ] **A2. shops** — CRUD, validate `code` unique trong org.
- [ ] **A3. warehouses** — CRUD, thuộc shop. Type: `store | central | online`.
- [ ] **A4. user_profiles** — GET own + admin list trong org. PATCH own profile.
- [ ] **A5. roles** — CRUD trong org.
- [ ] **A6. permissions** — read-only seed. CRUD admin global.
- [ ] **A7. role_permissions** — bulk assign/revoke (POST/DELETE batch).
- [ ] **A8. shop_staff** — gán user vào shop với role. Soft-deactivate (`is_active = false`).

### Domain B — Catalog
- [ ] **B1. brands** — CRUD, slug auto từ name.
- [ ] **B2. categories** — CRUD cây (parent_id). Endpoint phụ: `GET /categories/tree`.
- [ ] **B3. spec_templates** — CRUD, `fields` là jsonb (validate schema).
- [ ] **B4. products** — CRUD + filter (category, brand, status, search by name/slug). Trả về variants count.
- [ ] **B5. product_variants** — CRUD, validate `sku` unique. Có endpoint phụ: `POST /products/:id/variants`.
- [ ] **B6. serial_numbers** — CRUD theo variant. Endpoint phụ: `POST /serials/bulk-import` (nhập lô IMEI).

### Domain C — Khách hàng & nhà cung cấp
- [ ] **C1. customers** — CRUD + tìm theo phone/email. Validate phone Việt Nam.
- [ ] **C2. suppliers** — CRUD.

### Domain D — Kho & nhập hàng
- [ ] **D1. purchase_orders** — CRUD draft.
- [ ] **D2. purchase_order_items** — nested under PO.
- [ ] **D3. stock_levels** — chỉ GET (read-only view).
- [ ] **D4. inventory_transactions** — chỉ GET list (logging được tạo bởi business logic, không CRUD tay).

### Domain E — Bán hàng
- [ ] **E1. orders** — CRUD draft + filter theo status, channel, date range.
- [ ] **E2. order_items** — nested under order.
- [ ] **E3. payments** — record payment cho order.
- [ ] **E4. pos_sessions** — CRUD ca POS.

### Domain F — After-sale
- [ ] **F1. warranties** — CRUD, auto-extend ngày khi tạo từ order.
- [ ] **F2. repair_tickets** — CRUD, status pipeline (`received → diagnosing → repairing → done → delivered`).
- [ ] **F3. trade_in_requests** — CRUD.
- [ ] **F4. loyalty_transactions** — chỉ GET (auto-gen từ orders).

### Domain G — Cấu hình & audit
- [ ] **G1. settings** — CRUD key/value theo org/shop.
- [ ] **G2. audit_logs** — chỉ GET list (auto-write từ trigger / middleware).

---

## 3. Business logic (cần transaction, không phải CRUD thuần)

> Khuyến nghị: viết bằng **Postgres function** (RPC) thay vì JS để đảm bảo atomicity, gọi qua `supabase.rpc(...)`.

### BL1. Tạo đơn hàng `POST /api/v1/orders/checkout`
**Input:** `{ shop_id, customer_id?, items: [{ variant_id, qty }], discount, payment_method }`
**Logic (1 transaction):**
1. Validate stock đủ trong `stock_levels` của shop's warehouse.
2. Insert `orders` (sinh `order_number` dạng `LPL-yyyymmdd-####`).
3. Insert `order_items` với `unit_price` từ variant + snapshot `product_snapshot` (name, sku, image).
4. Trừ `stock_levels.available_qty` + ghi `inventory_transactions` type=`sale`.
5. Nếu có serial → update `serial_numbers.status = 'sold'`, gắn vào `inventory_transactions.serial_number_id`.
6. Insert `payments`.
7. Tính & cộng `loyalty_transactions` (1 điểm / 10k VND).
8. Insert `warranties` cho mỗi serial đã bán (default 12 tháng).
9. Insert `audit_logs`.
**Output:** `{ order_id, order_number, total_amount }`.

### BL2. Hoàn / hủy đơn `POST /api/v1/orders/:id/cancel`
- Cộng lại stock, đảo serial về `in_stock`, hủy warranty, trừ loyalty, ghi `inventory_transactions` type=`return`, update `orders.status='cancelled'`.

### BL3. Nhập kho từ PO `POST /api/v1/purchase-orders/:id/receive`
- Update `purchase_orders.status='received'`.
- Cộng `stock_levels.available_qty`, ghi `inventory_transactions` type=`purchase`.
- Nếu là hàng có serial → bulk insert `serial_numbers` (input từ body).
- Cập nhật `product_variants.cost_price` (moving average hoặc latest).

### BL4. Chuyển kho `POST /api/v1/inventory/transfer`
- Input: `from_warehouse, to_warehouse, items`.
- Trừ kho nguồn + cộng kho đích trong 1 transaction. 2 dòng `inventory_transactions` (type=`transfer_out`, `transfer_in`).

### BL5. Mở / đóng ca POS
- `POST /pos-sessions/open` — chặn nếu đã có session đang mở của user đó.
- `POST /pos-sessions/:id/close` — tính `expected_cash` từ payments method=`cash` trong khoảng `opened_at..now()`, ghi `difference_cash`.

### BL6. Đổi điểm `POST /api/v1/customers/:id/redeem`
- Validate đủ điểm, ghi `loyalty_transactions` type=`redeem` (points âm), trả về voucher code / discount.

### BL7. Repair workflow
- State machine: `received → quoted → approved → repairing → done → delivered | cancelled`. Mỗi transition là 1 endpoint riêng để dễ phân quyền.

### BL8. Trade-in approval
- Khi `status='approved'` → tự động tạo đơn mua từ supplier hoặc credit cho customer.

---

## 4. Cross-cutting

- [ ] **X1. Audit middleware** — trigger postgres `before update/delete` ghi `audit_logs` với `before_data`, `after_data`. Hoặc làn riêng ở service layer.
- [ ] **X2. Pagination chuẩn** — query param `?page=1&pageSize=20&sort=created_at:desc`. Helper `paginate()` trong `src/lib/api/`.
- [ ] **X3. Search full-text** — bật `pg_trgm` cho `products.name`, `customers.full_name|phone`, `serial_numbers.imei`.
- [ ] **X4. Rate limit** — nếu mở REST ra ngoài, thêm Upstash Redis hoặc Supabase Edge Rate Limit.
- [ ] **X5. File upload** — `images`, `thumbnail_url`, `logo_url` → Supabase Storage bucket `media/`. Endpoint `POST /api/v1/uploads` trả về signed URL.
- [ ] **X6. Realtime** — bật Supabase Realtime cho `orders`, `pos_sessions` để màn POS đồng bộ.
- [ ] **X7. Seed dev data** — script `scripts/seed.ts` dùng admin client tạo 1 org + 1 shop + 1 warehouse + 5 products + 10 variants.
- [ ] **X8. OpenAPI doc** — generate từ Zod schema bằng `zod-to-openapi`, expose `/api/docs`.

---

## 5. Thứ tự thực hiện đề xuất

```
Sprint 1 (foundation) ────► F1 → F2 → F3 → F4 → F5 → X7 (seed)
Sprint 2 (catalog)    ────► B1 → B2 → B3 → B4 → B5 → B6
Sprint 3 (people)     ────► A2 → A3 → A4 → A5 → A8 → C1 → C2
Sprint 4 (inventory)  ────► D1 → D2 → D3 → D4 → BL3 → BL4
Sprint 5 (sales)      ────► E1 → E2 → E3 → BL1 → BL2 → E4 → BL5
Sprint 6 (after-sale) ────► F1 → F2 → F3 → BL7 → BL8 → BL6
Sprint 7 (polish)     ────► X1 → X2 → X3 → X5 → X6 → X8
```

---

## 6. Quy ước code (áp dụng cho mọi PR)

### Tên file
- Service: `src/server/services/<entity>-service.ts`, export functions, không default export.
- Validator: `src/lib/validators/<entity>.ts`, export Zod schemas + inferred types.
- Route handler: `src/app/api/v1/<entity>/route.ts` + `[id]/route.ts`.
- Server action: `src/actions/<entity>.ts`, `"use server"` ở đầu file.

### Service signature mẫu
```ts
// src/server/services/product-service.ts
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";
import { createProductSchema, type CreateProductInput } from "@/lib/validators/product";

export async function listProducts(query: ProductQuery) { /* ... */ }
export async function getProduct(id: string) { /* ... */ }
export async function createProduct(input: CreateProductInput) {
  const parsed = createProductSchema.parse(input);
  const supabase = await createClient();
  const { data, error } = await supabase.from("products").insert(parsed).select().single();
  if (error) throw error;
  return data;
}
export async function updateProduct(id: string, input: UpdateProductInput) { /* ... */ }
export async function deleteProduct(id: string) { /* ... */ }
```

### Route handler mẫu
```ts
// src/app/api/v1/products/route.ts
import { NextRequest } from "next/server";
import { listProducts, createProduct } from "@/server/services/product-service";
import { ok, fail } from "@/lib/api/response";
import { createProductSchema } from "@/lib/validators/product";

export async function GET(req: NextRequest) {
  try {
    const data = await listProducts(Object.fromEntries(req.nextUrl.searchParams));
    return ok(data);
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = createProductSchema.parse(await req.json());
    const data = await createProduct(body);
    return ok(data, 201);
  } catch (e) {
    return fail(e);
  }
}
```

### Quy tắc
1. **Không bao giờ** import `admin.ts` từ client component hoặc route handler "public".
2. **Mọi** mutation phải đi qua service — route handler chỉ làm parse + auth + return.
3. **Mọi** service hàm phải gọi `getCurrentUser()` / `getCurrentOrgId()` trừ khi có lý do rõ ràng (cron, webhook).
4. **Mọi** business logic nhiều bước phải dùng RPC postgres function — không "transaction-like" trong JS.
5. Test cuối mỗi PR: `npm run typecheck && npm run lint`.

---

## 7. Checklist trước khi bắt đầu code

- [ ] Service role key đã rotate (đã lộ trong chat).
- [ ] Đã chạy F1 (gen types).
- [ ] Đã bật RLS cho ít nhất `organizations`, `user_profiles`, `products`, `orders`.
- [ ] Đã seed 1 organization + 1 user + 1 shop để test (X7).
- [ ] Branch convention: `feat/api-<domain>-<entity>`, ví dụ `feat/api-catalog-products`.
