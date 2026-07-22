# LapLap - Laptop Cần Thơ

Hệ thống quản lý bán hàng laptop đa chi nhánh với Next.js 15 + Supabase + TypeScript.

## Tính năng

- **Multi-tenant**: Tổ chức → Chi nhánh → Kho hàng
- **Catalog**: Thương hiệu, danh mục, sản phẩm, biến thể, serial number
- **Inventory**: Nhập hàng (PO), điều chuyển kho, tồn kho theo kho/biến thể
- **Sales**: Đơn hàng, thanh toán, POS session, checkout RPC, tích điểm loyalty
- **After-sale**: Bảo hành, sửa chữa, thu cũ đổi mới
- **Auth & RLS**: Row-level security theo organization + shop staff
- **Permissions**: Role-based access control (RBAC)

## Stack

| Layer       | Lib                                                                 |
| ----------- | ------------------------------------------------------------------- |
| Framework   | Next.js 15 (App Router, RSC, Server Actions) + React 19             |
| Language    | TypeScript 5.6 (strict)                                             |
| Database    | Supabase Postgres + Auth (SSR via `@supabase/ssr`)                  |
| Data        | TanStack Query v5 + Devtools                                        |
| HTTP        | Axios (cho external API), Supabase client (cho Supabase)            |
| State       | Zustand (+ persist)                                                 |
| Form        | React Hook Form + Zod                                               |
| UI          | Tailwind CSS + shadcn/ui + Radix Primitives + lucide-react          |
| Toast       | Sonner                                                              |
| Theme       | next-themes (dark/light/system)                                     |
| Tooling     | ESLint, Prettier, prettier-plugin-tailwindcss                       |

## Bắt đầu

### 1. Cài dependencies

```bash
npm install
```

### 2. Cấu hình Supabase

1. Tạo project tại https://app.supabase.com
2. Copy `.env.example` → `.env.local` và điền:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

### 3. Apply migrations

Vào **SQL Editor** trên Supabase Dashboard, chạy lần lượt:

1. `supabase/migrations/001_rls.sql` — Tạo bảng + RLS policies
2. `supabase/migrations/002_rpc.sql` — Tạo stored procedures (checkout, cancel, receive PO, transfer, close POS)
3. `supabase/migrations/003_seed.sql` — Seed dữ liệu mẫu (xem bước 4)

### 4. Seed dữ liệu mẫu

Trước khi chạy `003_seed.sql`:

1. Tạo user qua **Authentication** → **Add user** (hoặc signup qua UI)
2. Lấy UUID của user:
   ```sql
   select id, email from auth.users order by created_at desc limit 5;
   ```
3. Mở `supabase/migrations/003_seed.sql`, thay dòng:
   ```sql
   v_user_id uuid := 'YOUR_USER_UUID_HERE';
   ```
   bằng UUID thực tế, rồi chạy script.

Script sẽ tạo:
- 1 organization "LapLap Cần Thơ"
- 2 shop (Cần Thơ, TP.HCM) + 2 warehouse
- 2 role (Admin, Staff) + 2 permission
- 3 brand (Dell, HP, Lenovo)
- 2 category (Laptop, Phụ kiện)
- 2 product + 3 variant
- 2 customer, 1 supplier
- 1 purchase order (chưa receive)

### 5. Chạy dev server

```bash
npm run dev
```

Mở http://localhost:3000.

## Cấu trúc thư mục

```
src/
├── app/
│   ├── (auth)/                # Route group: login/signup
│   ├── api/v1/                # REST API endpoints
│   │   ├── _route-factory.ts  # Generic route handlers
│   │   ├── organizations/
│   │   ├── shops/
│   │   ├── warehouses/
│   │   ├── products/
│   │   ├── product-variants/
│   │   ├── serial-numbers/
│   │   ├── customers/
│   │   ├── suppliers/
│   │   ├── purchase-orders/
│   │   ├── inventory/
│   │   ├── orders/
│   │   ├── checkout/          # POST /api/v1/checkout
│   │   ├── payments/
│   │   ├── pos-sessions/
│   │   ├── warranties/
│   │   ├── repair-tickets/
│   │   ├── trade-in-requests/
│   │   └── ...
│   ├── auth/
│   │   ├── callback/route.ts
│   │   └── signout/route.ts
│   ├── dashboard/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── auth/
│   └── ui/                    # shadcn/ui primitives
├── hooks/                     # TanStack Query hooks
├── lib/
│   ├── api/
│   │   ├── guard.ts           # requireUser, requireOrg, requireShopAccess, requirePermission
│   │   ├── response.ts        # success, error, paginated helpers
│   │   ├── http.ts
│   │   └── axios.ts
│   ├── supabase/
│   │   ├── admin.ts           # Service-role client
│   │   ├── client.ts          # Browser client
│   │   ├── middleware.ts
│   │   └── server.ts          # SSR client
│   ├── validators/            # Zod schemas
│   │   ├── common.ts
│   │   ├── org.ts
│   │   ├── catalog.ts
│   │   ├── sales.ts
│   │   ├── inventory.ts
│   │   └── after-sale.ts
│   ├── env.ts
│   └── utils.ts
├── server/
│   └── services/              # CRUD + business logic services
│       ├── _crud-factory.ts
│       ├── index.ts           # 28 CRUD services
│       ├── checkout-service.ts
│       ├── inventory-actions-service.ts
│       └── pos-session-actions-service.ts
├── middleware.ts
├── providers/
├── stores/
└── types/
    └── database.ts            # Generated from Supabase

supabase/
└── migrations/
    ├── 001_rls.sql            # Schema + RLS policies
    ├── 002_rpc.sql            # Stored procedures
    └── 003_seed.sql           # Sample data
```

## API Endpoints

### Organization & People
- `GET/POST /api/v1/organizations`
- `GET/PATCH/DELETE /api/v1/organizations/:id`
- `GET/POST /api/v1/shops`
- `GET/POST /api/v1/warehouses`
- `GET/POST /api/v1/user-profiles`
- `GET/POST /api/v1/roles`
- `GET /api/v1/permissions`
- `GET/POST /api/v1/shop-staff`
- `POST /api/v1/role-permissions/assign`

### Catalog
- `GET/POST /api/v1/brands`
- `GET/POST /api/v1/categories`
- `GET/POST /api/v1/spec-templates`
- `GET/POST /api/v1/products`
- `GET/POST /api/v1/product-variants`
- `GET/POST /api/v1/serial-numbers`
- `POST /api/v1/serial-numbers/bulk`

### Inventory
- `GET/POST /api/v1/purchase-orders`
- `POST /api/v1/purchase-orders/:id/receive` — RPC: nhập hàng + tạo serial
- `GET/POST /api/v1/purchase-order-items`
- `GET/POST /api/v1/inventory-transactions` — POST = adjust
- `POST /api/v1/inventory/transfer` — RPC: chuyển kho
- `GET /api/v1/stock-levels` — read-only

### Sales
- `GET/POST /api/v1/customers`
- `GET/POST /api/v1/suppliers`
- `GET/POST /api/v1/orders`
- `POST /api/v1/orders/:id/cancel` — RPC: hủy đơn + hoàn stock
- `POST /api/v1/checkout` — RPC: tạo đơn + trừ stock + tạo bảo hành + loyalty
- `GET/POST /api/v1/order-items`
- `GET/POST /api/v1/payments`
- `GET/POST /api/v1/pos-sessions`
- `POST /api/v1/pos-sessions/:id/close` — RPC: đóng ca
- `GET/POST /api/v1/loyalty-transactions`

### After-sale
- `GET/POST /api/v1/warranties`
- `GET/POST /api/v1/repair-tickets`
- `GET/POST /api/v1/trade-in-requests`

### Misc
- `GET/POST /api/v1/settings`
- `GET /api/v1/audit-logs` — read-only

## Ví dụ sử dụng

### 1. Tạo sản phẩm

```bash
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "MacBook Pro 14",
  "slug": "macbook-pro-14",
  "brand_id": "uuid",
  "category_id": "uuid",
  "status": "active"
}
```

### 2. Nhập hàng (receive PO)

```bash
POST /api/v1/purchase-orders/{po_id}/receive
Content-Type: application/json

{
  "serials": [
    { "product_variant_id": "uuid", "serial_number": "SN-001", "quantity": 1 },
    { "product_variant_id": "uuid", "serial_number": "SN-002", "quantity": 1 }
  ]
}
```

### 3. Checkout (bán hàng)

```bash
POST /api/v1/checkout
Content-Type: application/json

{
  "shop_id": "uuid",
  "customer_id": "uuid",
  "items": [
    {
      "product_variant_id": "uuid",
      "quantity": 1,
      "unit_price": 30000000,
      "serial_numbers": ["SN-001"]
    }
  ],
  "payment": {
    "method": "cash",
    "amount": 30000000
  }
}
```

### 4. Chuyển kho

```bash
POST /api/v1/inventory/transfer
Content-Type: application/json

{
  "from_warehouse_id": "uuid",
  "to_warehouse_id": "uuid",
  "items": [
    { "product_variant_id": "uuid", "quantity": 2 }
  ],
  "notes": "Chuyển hàng từ CT sang HCM"
}
```

## Scripts

| Script       | Mô tả                            |
| ------------ | -------------------------------- |
| `dev`        | Next dev server (Turbopack)      |
| `build`      | Production build                 |
| `start`      | Chạy bản build                   |
| `lint`       | ESLint                           |
| `typecheck`  | `tsc --noEmit`                   |
| `format`     | Prettier format toàn bộ `src/`   |

## Troubleshooting

### Lỗi RLS policy
- Kiểm tra `current_org_id()` trả về đúng UUID
- Đảm bảo `shop_staff` có `is_active = true`
- Verify `role_permissions` đã được gán đúng

### Lỗi 400/403 khi gọi API
- Kiểm tra token có hợp lệ không
- Xác nhận user có quyền truy cập organization/shop không
- Xem log trong Supabase Dashboard → Logs

### Lỗi type mismatch
```bash
npx supabase gen types typescript \
  --project-id <your-project-id> \
  --schema public \
  > src/types/database.ts
```

## License

MIT
