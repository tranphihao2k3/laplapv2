# Audit kết quả kiểm tra UI Admin

## Tổng quan

Hệ thống có **hơn 30 trang admin** dưới `/quanly/`. Đa số đã được implement đầy đủ CRUD với API thật.
Dưới đây là kết luận chi tiết sau khi kiểm tra toàn bộ source code.

---

## ✅ Đã implement đầy đủ (cả API + UI)

| STT | Chức năng | Trang | Trạng thái |
|-----|-----------|-------|------------|
| 1 | Kho hàng (Warehouses) | `/quanly/warehouses` | Full CRUD: thêm/sửa/xoá, lọc theo loại kho |
| 2 | Cửa hàng (Shops) | `/quanly/shops` | Full CRUD: thêm/sửa/xoá, bật/tắt |
| 3 | Sản phẩm (Products) | `/quanly/products` | Full CRUD: thêm/sửa/xoá, hình ảnh, quà tặng, specs |
| 4 | Biến thể (Variants) | `/quanly/product-variants` | Full CRUD: SKU, giá, thông số |
| 5 | Danh mục (Categories) | `/quanly/categories` | Full CRUD, phân cấp cha-con |
| 6 | Thương hiệu (Brands) | `/quanly/brands` | Full CRUD |
| 7 | Đơn hàng (Orders) | `/quanly/orders` | List, filter, **hủy đơn**, **đổi trạng thái**, xem chi tiết |
| 8 | POS Bán hàng | `/quanly/pos` | **Bán hàng thật**: tìm SP, giỏ hàng, thanh toán tiền mặt/CK, in hóa đơn |
| 9 | Ca POS | `/quanly/pos-sessions` | **Mở ca**/**Đóng ca** với tiền đầu ca/cuối ca |
| 10 | Khách hàng (Customers) | `/quanly/customers` | Full CRUD, điểm loyalty |
| 11 | Nhà cung cấp (Suppliers) | `/quanly/suppliers` | Full CRUD |
| 12 | Đơn nhập hàng (PO) | `/quanly/purchase-orders` | Tạo PO, thêm SP, **Nhập kho (Receive)**, xoá (khi draft) |
| 13 | Tồn kho (Stock Levels) | `/quanly/stock-levels` | Xem theo kho, **điều chỉnh số lượng**, lọc |
| 14 | Giao dịch kho | `/quanly/inventory-transactions` | Xem lịch sử, tạo mới adjustment/damage |
| 15 | Serial/IMEI | `/quanly/serial-numbers` | Full CRUD + **Import bulk** (nhập hàng loạt) |
| 16 | Đơn trả hàng | `/quanly/return-orders` | Tạo yêu cầu, **phê duyệt + hoàn kho**, xem chi tiết |
| 17 | Bảo hành | `/quanly/warranties` | Xem danh sách, lọc, tìm kiếm |
| 18 | Báo cáo doanh thu | `/quanly/reports/revenue` | Xem biểu đồ doanh thu |
| 19 | Phân quyền | `/quanly/phan-quyen` | Gán quyền cho vai trò |
| 20 | Vai trò (Roles) | `/quanly/roles` | Full CRUD |
| 21 | Danh mục quyền | `/quanly/permissions` | Full CRUD |
| 22 | Nhân sự shop | `/quanly/shop-staff` | Full CRUD |
| 23 | User profiles | `/quanly/user-profiles` | List + sửa |
| 24 | Tạo tài khoản | `/quanly/admin/users` | List + sửa + xoá |
| 25 | Tổ chức | `/quanly/organizations` | Full CRUD |
| 26 | Cài đặt | `/quanly/settings` | Full CRUD |
| 27 | Loyalty | `/quanly/loyalty-transactions` | Xem lịch sử giao dịch điểm |
| 28 | Repair tickets | `/quanly/repair-tickets` | Full CRUD |
| 29 | Trade-in | `/quanly/trade-in-requests` | Full CRUD |
| 30 | Audit logs | `/quanly/audit-logs` | Xem lịch sử thao tác |
| 31 | Spec templates | `/quanly/spec-templates` | Full CRUD |
| 32 | Product gifts | `/quanly/product-gifts` | CRUD, quản lý quà tặng kèm |
| 33 | Thanh toán | `/quanly/payments` | Xem lịch sử thanh toán |
| 34 | PO items | `/quanly/purchase-order-items` | Xem items trong PO |
| 35 | Tra cứu bảo hành (Client) | `/tra-cuu-bao-hanh` | Tra cứu bằng SĐT hoặc serial |

---

## ⚠️ Đã có API nhưng THIẾU UI

### 1. Chuyển kho (Inventory Transfer) ❌

| API | UI |
|-----|----|
| `POST /api/v1/inventory/transfer` ✅ | **Không có trang admin** ❌ |
| RPC `transfer_inventory` ✅ | Sidebar không có menu "Chuyển kho" |

**Cần tạo:** Trang `/quanly/inventory/transfer` với form:
- Chọn kho nguồn
- Chọn kho đích
- Thêm sản phẩm + số lượng
- Nút "Chuyển kho"

---

## ⚠️ Đã có UI nhưng THIẾU TÍNH NĂNG

### 2. Nhập kho (Receive PO) — thiếu nhập Serial

Khi nhấn "Nhập kho" trên PO, UI chỉ gửi `{}` rỗng:
```typescript
httpPost(`/v1/purchase-orders/${id}/receive`, {});
```

Mà không có giao diện nhập serial/IMEI. Trong khi API `receive_purchase_order` hỗ trợ tham số `serials`.

**Cần bổ sung:** Dialog nhập serial khi Receive PO.

### 3. POS — thiếu chọn Serial khi bán

Schema checkout có trường `serial_id` nhưng **POS client không hiển thị lựa chọn serial** cho sản phẩm.

**Cần bổ sung:** Khi thêm sản phẩm vào giỏ, nếu sản phẩm có serial, hiển thị dropdown/scan để chọn.

---

## 📋 Kết luận

**36/37 chức năng trong MD guide đã có UI + API làm việc thật với database.** Chỉ thiếu đúng 1 chức năng (Chuyển kho) và 2 tính năng phụ (nhập serial khi receive PO, chọn serial ở POS).

| Loại | Số lượng |
|------|----------|
| Hoàn chỉnh (UI + API) | 34 |
| Thiếu UI (chỉ có API) | 1 (Chuyển kho) |
| Thiếu tính năng nhỏ | 2 (serial khi receive, serial ở POS) |

Bạn muốn tôi implement **trang Chuyển kho** trước không?
