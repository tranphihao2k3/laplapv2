# Plan Tối Ưu & Phát Triển Admin (`/quanly`)

> Tài liệu này là roadmap tổng thể cho việc tối ưu và phát triển admin. Mỗi phase đều có tiêu chí DONE rõ ràng và ước lượng effort.

---

## 1. Tổng quan

**Hiện trạng**: 60+ trang admin, 8 nhóm chức năng lớn, dashboard đã có 8 sections chart. Cấu trúc đầy đủ nhưng thiếu các "lớp tăng năng suất" cho admin làm việc hằng ngày.

**Mục tiêu**: biến `/quanly` từ "hệ thống có đủ trang" thành "công cụ làm việc nhanh, ít click, ít sai sót".

---

## 2. Phase 1 — Tăng năng suất (1-2 sprint)

### 2.1 Notification Bell + Dropdown ⭐ IMPACT CAO

**Mục tiêu**: Admin không cần mở từng trang để check đơn mới / phiếu sửa mới / hàng sắp hết.

**Cần làm**:
- [ ] API `/api/v1/admin/alerts` trả về danh sách alerts (đơn chờ, phiếu sửa, tồn kho thấp, BH sắp hết hạn)
- [ ] Component `NotificationBell` với badge đếm số
- [ ] Dropdown hiển thị alerts, click → navigate tới trang chi tiết
- [ ] Polling mỗi 60s
- [ ] Tích hợp vào `SiteHeader`

**Tiêu chí DONE**: Admin thấy ngay trên top-bar có bao nhiêu thứ cần xử lý, click vào là nhảy thẳng tới đó.

### 2.2 Command Palette (Ctrl+K) ⭐ IMPACT CAO

**Mục tiêu**: Power-user đi tới bất kỳ trang admin nào trong 2 phím tắt.

**Cần làm**:
- [ ] Component `CommandPalette` dùng `cmdk` (đã có thư viện hoặc tự build bằng Dialog + Search)
- [ ] Trigger bằng `Ctrl+K` / `Cmd+K`
- [ ] Index toàn bộ nav items + actions phổ biến (tạo đơn, tạo sản phẩm, tạo phiếu sửa)
- [ ] Recent items (lưu localStorage)
- [ ] Keyboard navigation (↑↓ Enter Esc)

**Tiêu chí DONE**: Ctrl+K → gõ "đơn" → Enter → sang trang đơn hàng.

### 2.3 Alerts Panel trên Dashboard ⭐ IMPACT CAO

**Mục tiêu**: Tóm tắt "cần làm gì hôm nay" ngay trên Dashboard.

**Cần làm**:
- [ ] Component `AlertsPanel` ở đầu Dashboard
- [ ] Cards: Đơn chờ xử lý / Phiếu sửa đang mở / Tồn kho thấp / BH sắp hết hạn / Yêu cầu thu cũ pending
- [ ] Click vào card → lọc trang tương ứng với điều kiện đó
- [ ] Màu sắc theo severity (đỏ = critical, vàng = warning, xanh = info)

**Tiêu chí DONE**: Mở Dashboard → biết ngay hôm nay cần xử lý gì.

### 2.4 Quick Actions Bar ⭐ IMPACT TRUNG BÌNH

**Mục tiêu**: Tác vụ thường gặp chỉ trong 1 click.

**Cần làm**:
- [ ] Component `QuickActions` ngay sau header Dashboard
- [ ] Grid 6 nút lớn: + Đơn POS, + Phiếu sửa, + Nhập kho, + SP mới, + KH mới, + Voucher
- [ ] Mỗi nút navigate tới trang tạo với focus vào form

**Tiêu chí DONE**: 1 click từ Dashboard tới form tạo bất kỳ entity chính.

### 2.5 Bulk operations mở rộng

**Mục tiêu**: Thao tác hàng trăm record cùng lúc.

**Cần làm**:
- [ ] Thêm `bulk-actions.tsx` vào: customers, vouchers, suppliers, repair-tickets
- [ ] Tác vụ: xóa, đổi status, gán tag, xuất Excel
- [ ] Hiển thị "Đã chọn: N mục" ở sticky bottom

### 2.6 Advanced Filters

**Mục tiêu**: Tìm data nhanh hơn text search.

**Cần làm**:
- [ ] Filter panel đa tiêu chí cho: products, orders, customers, repair-tickets
- [ ] Lưu filter vào URL (đã có `use-url-filters.ts`)
- [ ] Saved filter chips

### 2.7 Inline Edit

**Mục tiêu**: Sửa nhanh không cần mở form.

**Cần làm**:
- [ ] Double-click để edit price, stock, status, sort_order
- [ ] Enter save, Esc cancel
- [ ] Áp dụng cho products, variants, customers

### 2.8 Audit log nâng cao

**Mục tiêu**: Compliance + debug.

**Cần làm**:
- [ ] Auto log: create, update, delete, status change
- [ ] Diff viewer (xem field nào đổi từ A → B)
- [ ] Filter theo user, action, entity, date
- [ ] Export Excel

---

## 3. Phase 2 — Nghiệp vụ cốt lõi (3-4 sprint)

### 3.1 CRM Pipeline
- Funnel: Lead → Quan tâm → Tư vấn → Chốt → Mua → Thân thiết
- Gán lead cho sales, lịch sử tương tác, reminder follow-up
- **DB mới**: `leads`, `lead_activities`, `lead_sources`

### 3.2 Kho nâng cao
- Low-stock alert với threshold tuỳ chỉnh
- Phiên kiểm kê định kỳ
- Quản lý lô hàng + hạn sử dụng
- Barcode/QR scanning
- **DB mới**: `stock_batches`, `stock_adjustments`, `stock_thresholds`

### 3.3 Marketing Automation
- Customer segmentation
- Campaign manager (email + SMS)
- Auto-trigger campaigns
- A/B testing
- **DB mới**: `campaigns`, `campaign_steps`, `segments`

### 3.4 POS nâng cao
- Split payment
- Held orders
- Return/exchange tại POS
- Cash drawer management

### 3.5 Repair workflow
- Workflow trạng thái tuỳ chỉnh
- Phân công KTV + tracking thời gian
- Báo giá online
- Phụ tùng sử dụng
- **DB mới**: `repair_timeline`, `repair_parts_used`, `repair_quotes`

### 3.6 Order nâng cao
- Partial fulfillment
- Order timeline
- COD reconciliation
- **DB mới**: `shipments`, `cod_reconciliations`

---

## 4. Phase 3 — Nâng cao (2-3 tháng)

### 4.1 AI features
- AI description generator
- AI forecast doanh thu
- AI chatbot cho admin

### 4.2 Mobile PWA
- Cài được trên mobile
- Push notification
- Một số trang optimized mobile

### 4.3 Webhook + Integration
- Out: thông báo sang ERP/kế toán
- In: nhận data từ SAP, MISA
- Marketplace integrations

### 4.4 Compliance & Security
- 2FA cho admin
- IP whitelist
- Session management
- Data retention

### 4.5 Analytics nâng cao
- Custom report builder
- Real-time dashboard
- Cohort analysis
- Web traffic analytics

### 4.6 Tích hợp bên thứ ba
- Momo / ZaloPay / VNPay
- GHN / GHTK / Viettel Post
- e-Invoice (VNPT, MISA)
- Accounting (MISA, Fast)

### 4.7 Admin workflow & automation
- Auto-task với visual workflow builder
- Scheduled jobs
- **DB mới**: `workflows`, `scheduled_jobs`

---

## 5. Ưu tiên sprint hiện tại

| # | Tính năng | Impact | Effort | Tuần |
|---|---|---|---|---|
| 1 | Notification Bell | ⭐⭐⭐ | 1 tuần | 1 |
| 2 | Command Palette | ⭐⭐⭐ | 3 ngày | 1 |
| 3 | Alerts Panel | ⭐⭐⭐ | 3 ngày | 1 |
| 4 | Quick Actions | ⭐⭐ | 2 ngày | 1 |
| 5 | Bulk operations | ⭐⭐ | 4 ngày | 2 |
| 6 | Advanced filters | ⭐⭐ | 4 ngày | 2 |
| 7 | Inline edit | ⭐ | 3 ngày | 2 |
| 8 | Audit log nâng cao | ⭐⭐ | 1 tuần | 2 |

**Phase 1 hoàn thành** = admin có 4 "lớp tăng năng suất" mới: bell + palette + alerts + quick actions. Workflow hằng ngày giảm ~40% click.
