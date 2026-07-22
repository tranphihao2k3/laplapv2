# LapLap API — Audit Report
**Ngày:** 2026-05-22  
**Mục đích:** Kiểm tra logic, dependencies, auth, middleware, RBAC

---

## ✅ 1. Authentication & JWT

### Supabase JWT Flow
- **Middleware:** `src/middleware.ts` → `src/lib/supabase/middleware.ts`
  - Gọi `supabase.auth.getUser()` mỗi request để refresh JWT token
  - Redirect chưa login khỏi `/dashboard`, `/account`
  - Redirect đã login khỏi `/login`, `/signup`
  - ✅ **OK:** JWT được Supabase quản lý tự động qua cookie `sb-access-token`

### Route Guards
- **`src/lib/api/guard.ts`:**
  - `requireUser()` — check JWT, throw 401 nếu chưa login
  - `requireOrg()` — check user có `organization_id` trong `user_profiles`
  - `requireShopAccess(shopId)` — check user trong `shop_staff` của shop
  - `requirePermission(code)` — check qua `shop_staff → roles → role_permissions → permissions`
  - ✅ **OK:** Guard đầy đủ, nhưng **chưa được áp dụng vào tất cả route**

---

## ⚠️ 2. Authorization & RBAC

### RLS (Row Level Security)
- **File:** `supabase/migrations/001_rls.sql`
- **Helper functions:**
  - `current_org_id()` — lấy org của user từ `user_profiles`
  - `user_in_shop(shop_id)` — check `shop_staff.is_active = true`
  - `has_permission(code)` — check qua join `shop_staff → role_permissions → permissions`
- **Policies:**
  - Tenant isolation: `organization_id = current_org_id()`
  - Join policies cho warehouses, variants, serials, stock_levels, PO, orders, payments, warranties, etc.
  - ✅ **OK:** RLS đã bật cho 30 bảng

### RBAC trong API Routes
- **Vấn đề:** Hầu hết route chỉ gọi `requireUser()`, **KHÔNG check permission**
- **Ví dụ:**
  - `POST /api/v1/products` — chỉ check login, không check `manage_products`
  - `DELETE /api/v1/orders/:id` — chỉ check login, không check `delete_orders`
  - `POST /api/v1/checkout` — chỉ check login, không check `create_orders`

### ❌ **THIẾU:** Permission check ở API layer
**Khuyến nghị:**
```typescript
// Ví dụ: src/app/api/v1/products/route.ts
export async function POST(req: NextRequest) {
  await requirePermission('manage_products'); // ← THÊM DÒNG NÀY
  const supabase = await createClient();
  // ...
}
```

---

## ✅ 3. API Dependencies & Logic Flow

### A. Checkout Flow (RPC)
**Endpoint:** `POST /api/v1/checkout`
**Service:** `src/server/services/checkout-service.ts`
**RPC:** `supabase/migrations/002_rpc.sql` → `checkout_order(payload jsonb)`

**Logic:**
1. Chọn warehouse mặc định của shop
2. Check stock đủ không (từ `stock_levels`)
3. Gen order_number `LPL-YYYYMMDD-####`
4. Insert `orders` + `order_items` với `product_snapshot`
5. Trừ `stock_levels.quantity`
6. Ghi `inventory_transactions` type=`sale`
7. Đánh dấu serial `sold` + tạo `warranties` 12 tháng
8. Insert `payments`
9. Tính loyalty: `1đ = 0.001 điểm` (1đ/10k)
10. Ghi `audit_logs`

**Dependencies:**
- `shops` → `warehouses` (default warehouse)
- `product_variants` → `stock_levels`
- `serial_numbers` (nếu có)
- `customers` (loyalty_points)
- `settings` (loyalty_rate, warranty_months)

✅ **OK:** Logic atomic trong RPC, đảm bảo consistency

---

### B. Cancel Order Flow (RPC)
**Endpoint:** `POST /api/v1/orders/:id/cancel`
**RPC:** `cancel_order(p_order_id uuid)`

**Logic:**
1. Đảo stock: cộng lại `stock_levels.quantity`
2. Đảo serial: set `status = 'in_stock'`
3. Đảo loyalty: trừ điểm khách hàng
4. Void warranty: set `voided_at = now()`
5. Set order `status = 'cancelled'`

✅ **OK:** Rollback đầy đủ

---

### C. Receive Purchase Order (RPC)
**Endpoint:** `POST /api/v1/purchase-orders/:id/receive`
**RPC:** `receive_purchase_order(p_po_id, p_serials)`

**Logic:**
1. Cộng stock theo `purchase_order_items`
2. Ghi `inventory_transactions` type=`purchase`
3. Update `product_variants.cost_price`
4. Bulk insert `serial_numbers`
5. Set PO `status = 'received'`

**Dependencies:**
- `purchase_orders` → `purchase_order_items`
- `product_variants` → `stock_levels`
- `warehouses`

✅ **OK:** Logic đúng

---

### D. Transfer Inventory (RPC)
**Endpoint:** `POST /api/v1/inventory/transfer`
**RPC:** `transfer_inventory(from, to, items, note)`

**Logic:**
1. Trừ stock kho nguồn
2. Cộng stock kho đích
3. Ghi 2 dòng `inventory_transactions` (out + in)

✅ **OK:** Atomic transfer

---

### E. POS Session
**Open:** `POST /api/v1/pos-sessions` (JS logic)
**Close:** `POST /api/v1/pos-sessions/:id/close` (RPC)

**Logic Close:**
1. Tính `expected_cash` từ `payments` trong khoảng ca
2. Ghi `difference = closing_cash - expected_cash`
3. Set `closed_at = now()`

✅ **OK**

---

## ⚠️ 4. Missing Features

### 4.1. API Rate Limiting
❌ **THIẾU:** Không có rate limit cho API
**Khuyến nghị:** Dùng middleware hoặc Supabase Edge Functions với rate limit

### 4.2. Audit Logs
✅ **CÓ:** Bảng `audit_logs` đã có
❌ **THIẾU:** Chưa ghi log tự động cho mọi API call
**Khuyến nghị:** Thêm middleware ghi audit log cho POST/PATCH/DELETE

### 4.3. Soft Delete
❌ **THIẾU:** Các bảng chưa có `deleted_at`
**Khuyến nghị:** Thêm cột `deleted_at` cho các bảng quan trọng (products, orders, customers)

### 4.4. API Versioning
✅ **CÓ:** `/api/v1/...`

### 4.5. CORS
❌ **THIẾU:** Chưa config CORS cho external client
**Khuyến nghị:** Thêm CORS headers trong `next.config.ts`

---

## ⚠️ 5. Security Issues

### 5.1. Service Role Key Exposure
⚠️ **CẢNH BÁO:** `SUPABASE_SERVICE_ROLE_KEY` trong `.env.local` có thể bị commit nhầm
**Khuyến nghị:** 
- Thêm `.env.local` vào `.gitignore`
- Rotate key trên Supabase Dashboard

### 5.2. SQL Injection
✅ **OK:** Dùng Supabase client (parameterized queries)

### 5.3. XSS
✅ **OK:** Next.js tự động escape output

### 5.4. CSRF
✅ **OK:** Supabase JWT không dùng cookie session truyền thống

---

## ⚠️ 6. Data Validation

### Zod Schemas
✅ **CÓ:** `src/lib/validators/` đầy đủ cho tất cả entity
- `common.ts` — uuid, phone, email, slug
- `org.ts` — organization, shop, warehouse, role, permission
- `catalog.ts` — brand, category, product, variant, serial
- `sales.ts` — customer, order, payment, checkout
- `inventory.ts` — PO, transfer, receive
- `after-sale.ts` — warranty, repair, trade-in

✅ **OK:** Validation đầy đủ

---

## ⚠️ 7. Error Handling

### Global Error Handler
✅ **CÓ:** `src/lib/api/response.ts` → `handleError()`
- Zod validation errors → 422
- ApiError → custom status
- PostgREST errors → map code (23505→409, 23503→400, 42501→403)
- Unknown errors → 500

✅ **OK:** Error handling đầy đủ

---

## ⚠️ 8. Testing

❌ **THIẾU:** Không có test nào
**Khuyến nghị:**
- Unit tests cho services
- Integration tests cho API endpoints
- E2E tests cho checkout flow

---

## 📋 Summary

| Category | Status | Notes |
|----------|--------|-------|
| JWT/Auth | ✅ OK | Supabase JWT tự động |
| Middleware | ✅ OK | Refresh token + redirect |
| RLS | ✅ OK | 30 bảng đã bật RLS |
| RBAC | ⚠️ PARTIAL | RLS có, nhưng API route chưa check permission |
| API Logic | ✅ OK | Checkout/Cancel/Receive/Transfer đều atomic |
| Validation | ✅ OK | Zod schemas đầy đủ |
| Error Handling | ✅ OK | Global handler + PostgREST mapping |
| Rate Limiting | ❌ MISSING | Chưa có |
| Audit Logs | ⚠️ PARTIAL | Bảng có, chưa ghi tự động |
| Soft Delete | ❌ MISSING | Chưa có |
| CORS | ❌ MISSING | Chưa config |
| Tests | ❌ MISSING | Không có test |

---

## 🔧 Action Items (Ưu tiên cao → thấp)

### P0 (Critical)
1. **Thêm permission check vào API routes** — hiện tại chỉ check login, chưa check quyền
2. **Rotate `SUPABASE_SERVICE_ROLE_KEY`** — đã lộ trong chat

### P1 (High)
3. **Thêm audit log middleware** — ghi log cho POST/PATCH/DELETE
4. **Config CORS** — cho phép external client gọi API
5. **Thêm rate limiting** — chống abuse

### P2 (Medium)
6. **Thêm soft delete** — `deleted_at` cho products, orders, customers
7. **Viết integration tests** — ít nhất cho checkout flow
8. **Thêm API documentation** — Swagger/OpenAPI

### P3 (Low)
9. **Thêm monitoring** — Sentry/LogRocket
10. **Optimize queries** — thêm index cho các cột thường filter

---

## ✅ Kết luận

**API đã sẵn sàng sử dụng** với các điều kiện:
- ✅ Auth/JWT hoạt động
- ✅ RLS bảo vệ data ở DB layer
- ✅ Logic nghiệp vụ đúng (checkout/cancel/receive/transfer)
- ✅ Validation đầy đủ
- ⚠️ **NHƯNG:** Cần thêm permission check ở API layer (P0)
- ⚠️ **VÀ:** Rotate service role key ngay (P0)

**Recommendation:** Triển khai P0 trước khi deploy production.
