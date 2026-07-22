# Hướng dẫn luồng kho & đơn hàng - LapLap

> Mục lục
> 1. [Kiến trúc tổng quan](#1-kiến-trúc-tổng-quan)
> 2. [Kho & Cửa hàng](#2-kho--cửa-hàng)
> 3. [Luồng nhập hàng (Purchase Order)](#3-nhập-hàng-purchase-order)
> 4. [Quản lý tồn kho (Stock Levels)](#4-quản-lý-tồn-kho-stock-levels)
> 5. [Chuyển kho giữa các kho](#5-chuyển-kho-giữa-các-kho)
> 6. [Bán hàng (Checkout)](#6-bán-hàng-checkout)
> 7. [Serial Number & IMEI](#7-serial-number--imei)
> 8. [Hủy đơn hàng](#8-hủy-đơn-hàng)
> 9. [Trả hàng (Return Order)](#9-trả-hàng-return-order)
> 10. [Bảo hành (Warranty)](#10-bảo-hành-warranty)
> 11. [Kiểm kê & điều chỉnh](#11-kiểm-kê--điều-chỉnh)
> 12. [Quy trình vận hành tiêu chuẩn](#12-quy-trình-vận-hành-tiêu-chuẩn)
> 13. [FAQ & Xử lý lỗi thường gặp](#13-faq--xử-lý-lỗi-thường-gặp)

---

## 1. Kiến trúc tổng quan

### Sơ đồ luồng dữ liệu

```
NHÀ CUNG CẤP
      │
      ├──[1] Tạo PO──> ĐƠN NHẬP HÀNG (Purchase Order) ──draft──
      │                                                          │
      │               ════════════════════════════════════════════╧═══════════════════╗
      │               ║  [2] NHẬN HÀNG (Receive PO)                                ║
      │               ║    ├──> stock_levels.available_qty += qty                  ║
      │               ║    ├──> serial_numbers (nếu có) → in_stock                ║
      │               ║    └──> inventory_transactions (type=purchase)            ║
      │               ╚══════════════════════════════════════════════════════════════╝
      │                                                     │
      │              ═════════════════════════════════════════╧══════════════════╗
      │              ║  [3] CHUYỂN KHO (Transfer)                              ║
      │              ║    stock_levels (kho A) -  ; stock_levels (kho B) +     ║
      │              ║    inventory_tx (transfer_out) + (transfer_in)          ║
      │              ╚══════════════════════════════════════════════════════════╝
      │                                                     │
      │              ═════════════════════════════════════════╧══════════════════╗
      │              ║  [4] BÁN HÀNG (Checkout)                                ║
      │              ║    ├──> order + order_items + payment                   ║
      │              ║    ├──> stock_levels.available_qty -= qty               ║
      │              ║    ├──> serial_numbers → sold (nếu có)                 ║
      │              ║    ├──> inventory_tx (type=sale)                        ║
      │              ║    ├──> warranties (tạo mới)                            ║
      │              ║    └──> loyalty_points (cộng điểm)                      ║
      │              ╚══════════════════════════════════════════════════════════╝
      │                                                     │
      │              ═════════════════════════════════════════╧══════════════════╗
      │              ║  [5] HỦY ĐƠN (Cancel)                                   ║
      │              ║    stock_levels + serial → in_stock + warranty → voided ║
      │              ╚══════════════════════════════════════════════════════════╝
      │                                                     │
      │              ═════════════════════════════════════════╧══════════════════╗
      │              ║  [6] TRẢ HÀNG (Return Order)                            ║
      │              ║    Tạo yêu cầu (pending) → Phê duyệt (approved)         ║
      │              ║    stock_levels + (nếu restock)                         ║
      │              ╚══════════════════════════════════════════════════════════╝
```

### Các bảng chính

| Bảng | Vai trò |
|------|---------|
| `organizations` | Tổ chức/doanh nghiệp (đa tenant); `parent_id` cho phép lồng cấp mẹ-con |
| `shops` | Cửa hàng vật lý (UI gọi là "Cửa hàng" — trước đây có nơi gọi "Chi nhánh") |
| `shop_staff` | Gán tài khoản ↔ cửa hàng + vai trò (quyết định tài khoản thấy cửa hàng nào) |
| `warehouses` | Kho chứa hàng; `shop_id` = kho của cửa hàng, NULL = kho chung tổ chức |
| `stock_levels` | Số lượng tồn kho thực tế (available_qty, reserved_qty, incoming_qty) |
| `inventory_transactions` | Lịch sử biến động tồn kho (nhập/xuất/chuyển/kiểm) |
| `serial_numbers` | Theo dõi từng đơn vị sản phẩm (serial/IMEI) |
| `purchase_orders` | Đơn nhập hàng từ nhà cung cấp |
| `orders` | Đơn bán hàng |
| `return_orders` | Đơn trả hàng |
| `warranties` | Bảo hành sản phẩm |

---

## 2. Kho & Cửa hàng

> ### ⚠️ THUẬT NGỮ: "Cửa hàng" = "Chi nhánh" = bảng `shops`
>
> Trong hệ thống **chỉ có một bảng `shops`**. Trước đây UI dùng lẫn lộn 2 từ
> "Cửa hàng" và "Chi nhánh" cho cùng một thứ, gây nhầm lẫn. **Đã thống nhất
> dùng một từ duy nhất: "Cửa hàng"** trên toàn bộ giao diện.
>
> - **KHÔNG** có khái niệm "chi nhánh" tách biệt với "cửa hàng".
> - Cái cho phép **lồng cấp tổ chức** (công ty mẹ → con) là `organizations.parent_id`,
>   **không phải** `shops`. Hiện tại UI chưa khai thác `parent_id` để dựng cây chi nhánh.

### Sơ đồ phân cấp

```
organizations (Tổ chức)                    ── doanh nghiệp / đa-tenant
  │  • id, name, code, parent_id (lồng cấp mẹ-con), settings
  │
  ├── shops (Cửa hàng)                      ── điểm bán vật lý
  │     • shops.organization_id → organizations.id
  │     • một tổ chức có nhiều cửa hàng
  │
  ├── warehouses (Kho)                      ── nơi chứa hàng
  │     • warehouses.organization_id → organizations.id  (BẮT BUỘC: kho thuộc tổ chức nào)
  │     • warehouses.shop_id → shops.id      (TÙY CHỌN)
  │          ├─ có shop_id  → kho RIÊNG của một cửa hàng (VD kho tại quầy, type=store)
  │          └─ shop_id NULL → kho CHUNG của tổ chức     (VD kho trung tâm, type=central)
  │
  └── shop_staff (Nhân sự cửa hàng)          ── gán tài khoản vào cửa hàng
        • shop_staff.user_id  → auth user
        • shop_staff.shop_id  → shops.id
        • shop_staff.role_id  → roles.id  (quyền hạn)
        • is_active
```

### Mối quan hệ

- Mỗi **Cửa hàng (shops)** có thể có **nhiều Kho (warehouses)**
- Mỗi **Kho** thuộc về **một Cửa hàng** (`warehouses.shop_id`) **hoặc không thuộc cửa hàng nào**
  (`shop_id = NULL` → kho chung của tổ chức, VD kho trung tâm phân phối)
- **Mọi kho đều thuộc một tổ chức** (`warehouses.organization_id`), dù có gắn cửa hàng hay không
- `warehouses.shop_id` xác định kho thuộc cửa hàng nào

### "Kho này là của tổ chức hay của cửa hàng?" — phụ thuộc từng kho

Bảng `stock_levels` (tồn kho) chỉ gắn với `warehouse_id`. Việc một kho là "của tổ chức"
hay "của cửa hàng" **do bạn cấu hình khi tạo kho** (trang **Quản lý → Kho hàng**):

| Trường hợp | `shop_id` | Ý nghĩa |
|------------|-----------|---------|
| Kho tại quầy của cửa hàng A | = id cửa hàng A | Tồn ở đây là tồn của cửa hàng A (POS cửa hàng A bán từ đây) |
| Kho trung tâm | `NULL` | Tồn chung của tổ chức, dùng để phân phối / chuyển về các cửa hàng |

### Ai được thấy / thao tác kho nào?

- **Tài khoản đăng nhập** được gán cửa hàng qua `shop_staff` → endpoint `GET /api/v1/me/shops`
  trả về danh sách cửa hàng của tài khoản đó (fallback: tất cả cửa hàng của tổ chức nếu
  tài khoản chưa được gán — VD admin).
- Các trang **POS**, **Thêm sản phẩm**, **Nhập tồn kho (stock-levels)** chỉ hiển thị cửa hàng
  của tài khoản, rồi **lọc kho theo `warehouses.shop_id`** của cửa hàng đang chọn.
- Trang **Quản lý → Kho hàng** hiển thị **toàn bộ kho của tổ chức** (không lọc theo tài khoản),
  vì đây là nơi cấu hình/gán kho cho cửa hàng.

### Các loại kho (Warehouse.type)

| Loại | Ý nghĩa |
|------|---------|
| `store` | Kho tại cửa hàng — dùng cho POS bán trực tiếp |
| `central` | Kho trung tâm — phân phối cho các shop |
| `online` | Kho dành riêng cho bán online |
| `transit` | Hàng đang vận chuyển giữa các kho |

### Cấu hình kho cho cửa hàng

- Vào menu **Quản lý → Kho hàng** để xem/tạo/sửa kho
- Vào menu **Quản lý → Cửa hàng** để xem/tạo/sửa cửa hàng
- Khi tạo kho, chọn cửa hàng tương ứng ở trường "Cửa hàng" (shop_id)

> **Lưu ý quan trọng:** Khi bán hàng ở POS, hệ thống kiểm tra tồn kho của (các) kho thuộc cửa hàng đó. Nếu sản phẩm chỉ có ở kho trung tâm, POS sẽ **tự động chuyển hàng** từ kho trung tâm về kho cửa hàng trước khi bán.

---

## 3. Nhập hàng (Purchase Order)

### Quy trình từng bước

#### Bước 1: Tạo đơn nhập hàng (PO)

Vào **Quản lý → Đơn nhập hàng → Thêm mới**

Thông tin cần nhập:
- **Nhà cung cấp** (chọn từ danh sách)
- **Kho nhập** (kho sẽ nhận hàng)
- **Số PO** (tự sinh hoặc nhập tay)
- **Ghi chú** (nếu có)

Kết quả: PO với trạng thái `draft`.

#### Bước 2: Thêm sản phẩm vào PO

Sau khi tạo PO, thêm các dòng sản phẩm:
- **Sản phẩm** (chọn variant)
- **Số lượng**
- **Đơn giá nhập**

#### Bước 3: Nhận hàng (Receive)

Khi hàng về đến kho, vào chi tiết PO → bấm **Nhận hàng**.

Hệ thống sẽ:
- Cập nhật PO → trạng thái `received`
- Cộng `available_qty` trong `stock_levels` cho từng sản phẩm
- Ghi nhận giao dịch `purchase` vào `inventory_transactions`
- Nếu nhập serial: tạo bản ghi `serial_numbers` với trạng thái `in_stock`

> **Mẹo:** Khi nhập hàng có serial (laptop), hãy chuẩn bị danh sách serial/IMEI để nhập cùng lúc với nhận hàng.

### API tương ứng

| Hành động | Endpoint |
|-----------|----------|
| Tạo PO | `POST /api/v1/purchase-orders` |
| Danh sách PO | `GET /api/v1/purchase-orders` |
| Nhận hàng | `POST /api/v1/purchase-orders/{id}/receive` |
| Hủy PO | `DELETE /api/v1/purchase-orders/{id}` (chỉ khi draft) |

---

## 4. Quản lý tồn kho (Stock Levels)

### Cách hoạt động

`stock_levels` là bảng tổng hợp số lượng tồn kho theo **từng kho + từng sản phẩm**:

| Trường | Ý nghĩa |
|--------|---------|
| `warehouse_id` | Kho |
| `product_variant_id` | Sản phẩm (variant) |
| `available_qty` | Số lượng có thể bán |
| `reserved_qty` | Đã giữ cho đơn hàng chưa thanh toán |
| `incoming_qty` | Đang về (PO đã đặt chưa nhận) |

### Số lượng được cập nhật tự động bởi:

| Hành động | Tác động đến available_qty |
|-----------|---------------------------|
| Nhận hàng (Receive PO) | **+** số lượng nhập |
| Bán hàng (Checkout) | **−** số lượng bán |
| Hủy đơn | **+** số lượng đã hủy |
| Chuyển kho đi | **−** số lượng chuyển |
| Chuyển kho đến | **+** số lượng nhận |
| Phê duyệt trả hàng (có restock) | **+** số lượng trả |
| Điều chỉnh thủ công | +/- tuỳ chỉnh |

### Xem tồn kho

Vào **Quản lý → Tồn kho** để xem:
- Tồn kho theo kho
- Tồn kho theo sản phẩm
- Lịch sử biến động (inventory_transactions)

---

## 5. Chuyển kho giữa các kho

### Khi nào cần chuyển kho?

- Hàng từ kho trung tâm → kho cửa hàng
- Hàng giữa các cửa hàng với nhau
- Hàng từ kho online → kho store (để bán trực tiếp)

### Cách thực hiện

Vào **Quản lý → Chuyển kho**

Nhập:
- **Kho nguồn** (chọn warehouse)
- **Kho đích** (chọn warehouse)
- **Sản phẩm & số lượng**
- **Ghi chú** (tùy chọn)

Hệ thống sẽ:
1. Giảm `available_qty` ở kho nguồn
2. Tăng `available_qty` ở kho đích
3. Ghi 2 giao dịch: `transfer_out` (nguồn) + `transfer_in` (đích)

### Tự động chuyển kho khi bán hàng

Từ phiên bản hiện tại, khi bán hàng tại POS:
- Nếu sản phẩm có tồn kho ở các kho khác (vd: kho trung tâm) nhưng **không có ở kho shop**
- Hệ thống **tự động chuyển** lượng hàng cần thiết từ kho kia về kho shop
- Sau đó mới thực hiện bán

> **Lưu ý:** Nếu tổng tồn kho trên tất cả các kho **không đủ** số lượng yêu cầu → báo lỗi "Không đủ tồn kho".

---

## 6. Bán hàng (Checkout)

### Các kênh bán hàng

| Kênh | Mô tả |
|------|-------|
| `pos` | Bán tại quầy (cửa hàng) |
| `online` | Bán online (website) |
| `marketplace` | Bán qua sàn TMĐT |
| `wholesale` | Bán buôn/sỉ |

### 1. Bán tại POS

Vào **Quản lý → POS** → giao diện bán hàng:

1. **Chọn cửa hàng** ở dropdown phía trên
2. **Tìm sản phẩm** bằng ô tìm kiếm (tìm theo tên, SKU, barcode)
3. **Thêm vào giỏ** — nhấn vào kết quả tìm kiếm
4. **Điều chỉnh số lượng** bằng nút +/- hoặc nhập trực tiếp
5. **Điều chỉnh đơn giá bán** (nếu cần giảm giá)
6. **Nhập giảm giá** cho toàn đơn (tuỳ chọn)
7. **Chọn khách hàng** (tuỳ chọn — để tích điểm & bảo hành)
8. **Bấm "Thanh toán"**
9. **Chọn phương thức thanh toán**:
   - Tiền mặt — nhập số tiền khách đưa, hệ thống tự tính tiền thừa
   - Chuyển khoản / Ví điện tử — nhập mã giao dịch (nếu có)
   - Quẹt thẻ
10. **Xác nhận** — hệ thống tạo đơn, trừ kho, in hóa đơn

### 2. Các thao tác sau khi bán

- **In lại hóa đơn:** Vào **Quản lý → Đơn hàng**, tìm đơn → bấm **In**
- **Xem chi tiết đơn:** Bấm vào số đơn hàng

### Luồng xử lý khi thanh toán

```
1. Kiểm tra kho shop có đủ hàng?
   ├── Có  ──> 2
   └── Không ──> Kiểm tra tổng tồn kho tất cả kho
                  ├── Đủ  ──> Tự động chuyển hàng về kho shop → 2
                  └── Không ──> Báo lỗi "Không đủ tồn kho"

2. RPC checkout_order:
   ├── Tạo order (status = pending)
   ├── Tạo order_items (kèm snapshot sản phẩm)
   ├── Trừ stock_levels.available_qty
   ├── Ghi inventory_transactions (type = sale)
   ├── Nếu có serial → cập nhật serial → sold
   ├── Tạo payment
   ├── Cộng điểm loyalty (nếu có khách hàng)
   └── Tạo warranty (nếu có serial) ← tự động
```

---

## 7. Serial Number & IMEI

### Serial Number dùng để làm gì?

- Theo dõi **từng sản phẩm riêng lẻ** (mỗi laptop có 1 số serial riêng)
- Quản lý IMEI cho thiết bị di động
- Tự động tạo **bảo hành** khi bán

### Vòng đời Serial

```
in_stock ──bán──> sold ──trả hàng──> returned ──> in_stock
  │                    │
  │                    └── hỏng ──> damaged
  │                    └── bảo hành ──> in_repair
  └── reserv──> reserved
```

### Import Serial

**Cách 1: Khi nhập hàng (Receive PO)**
- Khi nhận hàng từ PO, nhập danh sách serial/IMEI
- Serial sẽ được tạo với trạng thái `in_stock` tại kho nhập

**Cách 2: Import bulk riêng**
- Vào **Quản lý → Serial Numbers → Thêm hàng loạt**
- Chọn sản phẩm (variant), kho, và danh sách serial/IMEI

**Cách 3: Thêm thủ công từng cái**
- Vào **Quản lý → Serial Numbers → Thêm mới**

### Serial khi bán hàng

Tại POS:
- Nếu sản phẩm có quản lý serial, khi thêm vào giỏ hàng sẽ có tùy chọn **chọn serial**
- Hoặc có thể quét mã serial bằng barcode scanner

Khi thanh toán:
- Serial được chuyển từ `in_stock` → `sold`
- Tự động tạo bảo hành cho serial đó

---

## 8. Hủy đơn hàng

### Khi nào hủy được?

Có thể hủy đơn hàng khi:
- Đơn ở trạng thái không phải `cancelled`
- Người dùng có quyền `orders.cancel`

### Cách hủy

Vào **Quản lý → Đơn hàng → Chi tiết đơn → Hủy đơn**

### Hệ thống xử lý khi hủy

1. Đơn hàng → `cancelled`
2. **Hoàn lại tồn kho**: `stock_levels.available_qty +=` số lượng đã hủy
3. Nếu có serial: chuyển serial về `in_stock`, xóa `sold_at`
4. Ghi `inventory_transactions` (type = return)
5. Bảo hành liên quan → `voided`
6. Hoàn điểm loyalty (nếu có)

---

## 9. Trả hàng (Return Order)

### Quy trình trả hàng

#### Bước 1: Tạo yêu cầu trả

Vào **Quản lý → Đơn trả hàng → Thêm mới**

Nhập:
- **Đơn hàng gốc** (chọn order đã bán)
- **Lý do trả**
- **Số tiền hoàn** (tự động tính nếu để trống)
- **Phương thức hoàn** (tiền mặt/chuyển khoản)
- **Sản phẩm trả** (chọn từ order_items):
  - Số lượng trả
  - Lý do trả từng sản phẩm
  - **Có nhập lại kho không?** (restock = true/false)

Kết quả: Return order với trạng thái `pending`.

#### Bước 2: Phê duyệt trả

Vào chi tiết return order → bấm **Phê duyệt**

Hệ thống:
- Chọn kho nhập lại (mặc định kho đầu tiên của tổ chức, hoặc chọn tay)
- Với các sản phẩm có `restock = true`:
  - Cộng lại `available_qty` trong `stock_levels`
  - Ghi `inventory_transactions` (type = return_in)
- Nếu có serial → cập nhật serial về `returned` (hoặc `in_stock`)
- Cập nhật warranty tương ứng (nếu có)
- Return order → `approved`

> **Lưu ý:** Hàng trả không tự động nhập lại kho. Phải bật `restock = true` nếu muốn nhập lại.

---

## 10. Bảo hành (Warranty)

### Tự động tạo bảo hành

Khi bán hàng thành công (checkout) với sản phẩm có **serial number**:
- Hệ thống **tự động tạo** bản ghi bảo hành
- `start_date` = ngày bán
- `end_date` = start_date + thời gian bảo hành (ví dụ 12 tháng)
- `status` = `active`

### Trạng thái bảo hành

| Trạng thái | Ý nghĩa |
|------------|---------|
| `active` | Còn hiệu lực |
| `expired` | Đã hết hạn |
| `claimed` | Đã yêu cầu bảo hành |
| `voided` | Đã hủy (khi hủy đơn) |

### Tra cứu bảo hành

**Phía khách hàng:** Truy cập `/tra-cuu-bao-hanh`, nhập SĐT hoặc serial để tra cứu.

**Phía quản lý:** Vào **Quản lý → Bảo hành** để xem tất cả.

---

## 11. Kiểm kê & điều chỉnh

### Điều chỉnh tồn kho thủ công

Khi kiểm kê phát hiện sai lệch, vào **Quản lý → Tồn kho → Điều chỉnh**

Nhập:
- **Kho**
- **Sản phẩm**
- **Số lượng mới** (ghi đè available_qty)

> **Chú ý:** Thao tác này sẽ ghi đè số lượng tồn kho hiện tại mà **không tạo inventory_transactions**. Nên ghi chú lý do trước khi điều chỉnh.

### Ghi nhận hao hụt/hư hỏng

Vào **Quản lý → Phiếu nhập/xuất → Thêm mới**

Chọn loại:
- `adjustment`: Kiểm kê điều chỉnh
- `damage`: Hàng hư hỏng, mất mát

> **Lưu ý:** Tạo inventory_transactions thủ công **không tự động** cập nhật stock_levels. Chỉ mang tính chất ghi nhận.

---

## 12. Quy trình vận hành tiêu chuẩn

### Quy trình 1: Bán lẻ tại cửa hàng (đầy đủ)

```
1. Mở ca (POS Session) ──> ghi nhận tiền đầu ca
2. Tìm sản phẩm ──> thêm vào giỏ
3. Quét serial (nếu có)
4. Chọn khách hàng (nếu là khách quen)
5. Nhận tiền ─> thanh toán
6. In hóa đơn
7. Kết ca ──> đối chiếu tiền
```

### Quy trình 2: Nhập hàng mới

```
1. Tạo PO (đơn nhập hàng)
2. Thêm sản phẩm vào PO
3. Khi hàng về ──> Nhận hàng (Receive)
   - Nhập serial/IMEI nếu có
4. Kiểm tra tồn kho ──> confirm
```

### Quy trình 3: Chuyển hàng giữa các cửa hàng

```
1. Tạo phiếu chuyển kho
   - Kho nguồn: Cửa hàng A
   - Kho đích: Cửa hàng B
2. Hệ thống tự động cập nhật tồn kho 2 bên
3. Kiểm tra inventory_transactions để đối chiếu
```

### Quy trình 4: Xử lý trả hàng

```
1. Nhận hàng trả từ khách
2. Tạo Return Order ──> chọn đơn gốc
3. Chọn sản phẩm trả, quyết định có nhập kho lại không
4. Phê duyệt ──> hoàn tiền + nhập kho (nếu có)
```

---

## 13. FAQ & Xử lý lỗi thường gặp

### "Không đủ tồn kho" dù POS hiển thị có hàng

**Nguyên nhân:** Sản phẩm có tồn ở kho khác (vd: kho trung tâm) nhưng không có ở kho của cửa hàng đang bán.

**Giải pháp:**
- **Tự động:** Hệ thống sẽ tự chuyển hàng về kho shop. Nếu gặp lỗi này tức là tổng tồn kho trên tất cả kho cũng không đủ.
- **Thủ công:** Vào menu Chuyển kho để chuyển hàng về kho cửa hàng trước khi bán.

### "Chưa có kho" khi bán hàng

**Nguyên nhân:** Cửa hàng chưa được gán kho nào.

**Giải pháp:** Vào **Quản lý → Kho hàng → Thêm mới**, tạo kho và chọn cửa hàng tương ứng.

### POS báo "Không tìm thấy sản phẩm"

**Nguyên nhân:**
- Sản phẩm chưa được tạo variant
- Sản phẩm ở trạng thái `draft` hoặc `archived`

**Giải pháp:**
- Vào **Quản lý → Sản phẩm**, kiểm tra trạng thái sản phẩm (phải là `active`)
- Đảm bảo sản phẩm có ít nhất 1 variant (SKU)

### Không hủy được đơn hàng

**Nguyên nhân:** Đơn đã ở trạng thái không cho phép hủy.

**Giải pháp:** Chỉ hủy được đơn ở trạng thái `pending`, `confirmed`, `fulfilled`. Đơn đã `completed` hoặc `cancelled` không hủy được.

### Serial number đã bán nhưng muốn đổi trả

**Quy trình:** Tạo Return Order → Phê duyệt → Serial sẽ chuyển về `returned` hoặc `in_stock` tùy cấu hình.

### Tồn kho sai / lệch so với kiểm kê

**Giải pháp:** Vào **Quản lý → Tồn kho → Điều chỉnh**, nhập số lượng thực tế sau kiểm kê.

---

> **Liên hệ hỗ trợ:** Nếu có vấn đề về kỹ thuật hoặc cần hướng dẫn thêm, liên hệ quản trị hệ thống.
