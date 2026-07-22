# Hướng dẫn cài đặt & vận hành cửa hàng từ đầu — LapLap

Tài liệu này hướng dẫn **dọn sạch dữ liệu** rồi **thiết lập và sử dụng** hệ thống
từ con số 0: tạo cửa hàng, kho, sản phẩm, nhập tồn, bán hàng.

> Xem thêm chi tiết luồng kho/đơn hàng ở [`INVENTORY-FLOW-GUIDE.md`](./INVENTORY-FLOW-GUIDE.md).

---

## 0. Khái niệm nhanh (đọc 1 phút)

```
Tổ chức (organization)  →  Cửa hàng (shop)  →  Kho (warehouse)  →  Tồn kho (stock_levels)
        │                        │
   toàn bộ dữ liệu          tài khoản gán vào cửa hàng qua shop_staff
```

- **Tổ chức** = doanh nghiệp của bạn (chứa mọi dữ liệu).
- **Cửa hàng** (trước đây UI gọi lẫn "chi nhánh" — nay thống nhất là **Cửa hàng**) = điểm bán.
- **Kho** thuộc một cửa hàng (`shop_id`) hoặc là kho chung của tổ chức (`shop_id = NULL`).
- **Tài khoản** đăng nhập chỉ thấy cửa hàng mà nó được gán qua **shop_staff**.

---

## 1. Dọn sạch dữ liệu (chỉ chạy 1 lần khi khởi tạo)

> ⚠️ **KHÔNG HOÀN TÁC ĐƯỢC.** Chỉ chạy khi bạn chắc chắn muốn xoá trắng để bắt đầu lại.

Script `scripts/clean-data.mjs` sẽ:

| Giữ lại ✅ | Xoá trắng ❌ |
|-----------|-------------|
| 1 tài khoản admin (`admin@laplap.vn`) | Sản phẩm, biến thể, quà tặng, serial |
| Tổ chức + Cửa hàng + Kho của admin | Tồn kho, giao dịch kho, đơn nhập hàng |
| RBAC (roles, permissions, shop_staff) | Đơn hàng, thanh toán, phiên POS, điểm |
| **Thương hiệu (brands)** | Bảo hành, sửa chữa, trả hàng, thu cũ |
| **Danh mục (categories)** | Khách hàng, nhà cung cấp |
| **Mẫu thông số (spec_templates)** | settings, audit_logs; mọi org/shop/kho/user thừa |

### Bước 1a — Xem trước (DRY-RUN, không xoá gì)

```bash
node scripts/clean-data.mjs
```

Lệnh này chỉ **in ra số dòng sẽ bị xoá** ở từng bảng để bạn kiểm tra. Không thay đổi gì.

### Bước 1b — Xoá thật

```bash
CONFIRM=YES node scripts/clean-data.mjs
```

Muốn giữ tài khoản admin khác:

```bash
ADMIN_EMAIL=you@domain.com CONFIRM=YES node scripts/clean-data.mjs
```

### Bước 1c — Đảm bảo admin còn nguyên (idempotent, chạy lại được)

```bash
node scripts/bootstrap-admin.mjs
```

Tạo/khôi phục: tài khoản `admin@laplap.vn` / mật khẩu `admin1`, tổ chức, cửa hàng "Chi nhánh chính",
kho chính, role Admin + toàn bộ quyền.

> **Vì sao giữ tổ chức/cửa hàng của admin thay vì xoá hẳn?**
> Thương hiệu, danh mục, mẫu thông số và chính tài khoản admin đều phải thuộc **một tổ chức**.
> Xoá tổ chức sẽ làm chúng mồ côi và admin không đăng nhập được. Nên script giữ đúng **một bộ**
> tổ chức/cửa hàng/kho của admin (xoá các bộ thừa khác) — kết quả vẫn là hệ thống sạch, dùng được ngay.

### (Tuỳ chọn) Nạp lại dữ liệu mẫu

```bash
node scripts/seed-spec-templates.mjs   # mẫu thông số + danh mục cơ bản
node scripts/seed-data.mjs             # thương hiệu, nhà cung cấp... (nếu cần)
```

---

## 2. Đăng nhập lần đầu

1. Chạy app: `npm run dev` → mở `http://localhost:3000`
2. Vào `http://localhost:3000/login`
3. Đăng nhập:
   - **Email:** `admin@laplap.vn`
   - **Mật khẩu:** `admin1`
4. Sau khi vào, khu quản lý ở `http://localhost:3000/quanly`

> **Đổi mật khẩu admin ngay** sau lần đăng nhập đầu (Supabase Dashboard → Authentication → Users).

---

## 3. Thiết lập ban đầu (theo thứ tự)

### 3.1. Cửa hàng — `Quản lý → Cửa hàng` (`/quanly/shops`)
- Kiểm tra/đổi tên cửa hàng "Chi nhánh chính" cho đúng tên thật.
- Tạo thêm cửa hàng nếu bạn có nhiều điểm bán.

### 3.2. Kho hàng — `Quản lý → Kho hàng` (`/quanly/warehouses`)
- Mỗi cửa hàng cần **ít nhất 1 kho** (loại `store`) để bán tại quầy.
- Khi tạo kho: chọn **Tổ chức** + **Cửa hàng** tương ứng, chọn **Loại kho**:
  - `store` — kho tại quầy (POS bán từ đây)
  - `central` — kho trung tâm (để `shop_id` trống nếu là kho chung tổ chức)
  - `online` / `transit` — bán online / hàng đang chuyển.

### 3.3. Nhân sự — `Quản lý → Nhân sự cửa hàng` (`/quanly/shop-staff`)
- Gán tài khoản nhân viên vào cửa hàng + vai trò.
- **Quan trọng:** tài khoản chỉ thấy cửa hàng mà nó được gán ở đây. Chưa gán → POS/Sản phẩm báo
  *"Tài khoản chưa được gán cửa hàng nào"*.

### 3.4. Thương hiệu & Danh mục (nếu chưa có)
- `Quản lý → Thương hiệu` (`/quanly/brands`) — thêm hãng: Dell, HP, Asus...
- `Quản lý → Danh mục` (`/quanly/categories`) — cây danh mục: Laptop → Laptop Gaming...

### 3.5. Mẫu thông số — `Quản lý → Mẫu thông số` (`/quanly/spec-templates`)
- Định nghĩa các trường thông số theo danh mục (CPU, RAM, VGA...).
- Gán template vào danh mục để **kế thừa tự động** khi tạo sản phẩm thuộc danh mục đó.

---

## 4. Tạo sản phẩm & nhập tồn kho

### 4.1. Thêm sản phẩm — `Quản lý → Sản phẩm` (`/quanly/products`)
Bấm **Thêm sản phẩm**. Có thể:
- Dán mô tả từ Facebook/Zalo vào ô **AI** → tự điền tên, cấu hình, giá, quà tặng.
- Hoặc điền tay: Tên (bắt buộc), Danh mục, Thương hiệu, Trạng thái (mặc định **Kích hoạt**).
- **Giá bán:** để trống → hiển thị **"Giá liên hệ"**.
- **Tồn kho ban đầu** (mặc định 1) + chọn **Cửa hàng** (tự chọn theo tài khoản) + **Kho**
  → hệ thống ghi tồn vào kho đó luôn khi tạo.
- Sản phẩm nhiều phiên bản (i5/i7...) → mở mục **Biến thể nhiều cấu hình**.

> Sản phẩm phải có **≥ 1 biến thể (SKU)** và trạng thái **Kích hoạt** thì POS mới tìm thấy.

### 4.2. Nhập tồn cho sản phẩm cũ / điều chỉnh — `Quản lý → Tồn kho` (`/quanly/stock-levels`)
- Chọn **Cửa hàng** → **Kho** → **Sản phẩm (biến thể)** → nhập **Số lượng** → **Cập nhật tồn kho**.
- Dropdown đều có ô tìm kiếm. Kho được lọc theo cửa hàng đang chọn.
- Thao tác này **ghi đè** số tồn (dùng khi kiểm kê / nhập tồn khởi tạo).

### 4.3. Nhập hàng theo đơn (có serial) — `Quản lý → Đơn nhập hàng` (`/quanly/purchase-orders`)
1. Tạo PO: chọn nhà cung cấp + kho nhận.
2. Thêm dòng sản phẩm (biến thể, số lượng, giá nhập).
3. **Nhận hàng (Receive)** → cộng tồn kho + tạo serial (nếu có) + ghi giao dịch.

---

## 5. Bán hàng (POS) — `Quản lý → POS` (`/quanly/pos`)

1. Chọn **Cửa hàng** (chỉ hiện cửa hàng của tài khoản; có ô tìm kiếm).
2. Tìm sản phẩm (theo tên/SKU/barcode) → thêm vào giỏ.
3. Chỉnh số lượng, đơn giá, giảm giá; chọn khách hàng (để tích điểm & bảo hành).
4. **Thanh toán** → chọn phương thức → xác nhận → trừ kho + in hoá đơn.

> Nếu kho cửa hàng hết nhưng kho khác còn, hệ thống **tự chuyển hàng** về rồi mới bán.
> Nếu tổng tồn không đủ → báo *"Không đủ tồn kho"*.

---

## 6. Nghiệp vụ sau bán

| Việc | Trang |
|------|-------|
| Xem/in lại đơn, huỷ đơn | `Quản lý → Đơn hàng` (`/quanly/orders`) |
| Trả hàng (có/không nhập lại kho) | `Quản lý → Đơn trả hàng` (`/quanly/return-orders`) |
| Bảo hành | `Quản lý → Bảo hành` (`/quanly/warranties`) |
| Sửa chữa | `Quản lý → Phiếu sửa chữa` (`/quanly/repair-tickets`) |
| Chuyển kho | `Quản lý → Chuyển kho` (`/quanly/inventory/transfer`) |
| Báo cáo doanh thu | `Quản lý → Báo cáo` (`/quanly/reports/revenue`) |

---

## 7. Checklist bắt đầu nhanh

- [ ] `node scripts/clean-data.mjs` (xem trước) → `CONFIRM=YES node scripts/clean-data.mjs`
- [ ] `node scripts/bootstrap-admin.mjs`
- [ ] Đăng nhập `/login` → **đổi mật khẩu admin**
- [ ] Cập nhật thông tin **Cửa hàng** + tạo **Kho** (store)
- [ ] Gán tài khoản vào cửa hàng ở **Nhân sự cửa hàng**
- [ ] Kiểm tra **Thương hiệu / Danh mục / Mẫu thông số**
- [ ] Thêm **Sản phẩm** (kèm tồn ban đầu) hoặc nhập qua **Tồn kho / Đơn nhập hàng**
- [ ] Bán thử 1 đơn ở **POS** để xác nhận toàn bộ luồng

---

## 8. Xử lý sự cố thường gặp

| Triệu chứng | Nguyên nhân & cách xử lý |
|-------------|--------------------------|
| POS/Sản phẩm báo "chưa được gán cửa hàng" | Tài khoản chưa có trong `shop_staff` → gán ở **Nhân sự cửa hàng** |
| Dropdown Kho trống | Cửa hàng chưa có kho → tạo kho ở **Kho hàng**, chọn đúng cửa hàng |
| POS "Không tìm thấy sản phẩm" | Sản phẩm chưa có biến thể, hoặc trạng thái chưa **Kích hoạt** |
| "Không đủ tồn kho" dù thấy có hàng | Hàng ở kho khác cửa hàng → dùng **Chuyển kho**, hoặc kiểm tra tổng tồn |
| Đăng nhập lỗi sau khi clean | Chạy lại `node scripts/bootstrap-admin.mjs` |
