# Hệ thống Báo cáo & Xuất Excel `/quanly/bao-cao`

Hệ thống 8 báo cáo chuyên sâu kèm xuất Excel tự động, dành cho admin/quản lý cửa hàng.

## 8 báo cáo

| # | Báo cáo | URL | Mô tả |
|---|---|---|---|
| 1 | Doanh thu | `/quanly/bao-cao/doanh-thu` | Thống kê đơn hàng, doanh thu theo thời gian, cửa hàng, kênh bán |
| 2 | Sản phẩm | `/quanly/bao-cao/san-pham` | Top SP bán chạy, lợi nhuận, margin, phân bổ danh mục |
| 3 | Khách hàng | `/quanly/bao-cao/khach-hang` | KH theo hạng, doanh thu, điểm tích lũy |
| 4 | Kho | `/quanly/bao-cao/kho` | Tồn kho theo SP + kho, giá trị tồn, sắp hết/hết hàng |
| 5 | Nhân viên | `/quanly/bao-cao/nhan-vien` | Bảng xếp hạng NV theo doanh thu, số đơn, tỉ lệ hoàn tất |
| 6 | Sửa chữa | `/quanly/bao-cao/sua-chua` | Phiếu sửa theo KTV, khách, phí, giờ sửa |
| 7 | Bảo hành | `/quanly/bao-cao/bao-hanh` | Danh sách BH, trạng thái còn hiệu lực, sắp hết hạn |
| 8 | Voucher | `/quanly/bao-cao/voucher` | Tỉ lệ sử dụng voucher, doanh thu từ voucher |

## Kiến trúc

### Backend (8 API JSON + 8 API Excel)
```
src/app/api/v1/
├── reports/[type]/route.ts     # JSON: summary + charts + rows (max 200)
└── exports/[type]/route.ts     # Excel: xlsx download (max 50k rows)
```

Hai layer share helper:
- [src/lib/reports/query.ts](../../src/lib/reports/query.ts) — `parseFilters`, `fetchAll`, `fetchPage`, `summarize`, `bucketDate`
- [src/lib/excel/server.ts](../../src/lib/excel/server.ts) — `buildWorkbook` (exceljs), `excelResponse`

### Frontend (5 component + 8 page)
```
src/components/reports/
├── report-page.tsx          # Wrapper chung (header + filter + KPI + chart + table)
├── report-filter-bar.tsx    # Dải filter date/text/select + nút Reset
├── report-kpi-row.tsx       # Card KPI grid (icon + tone + sparkline)
├── report-table.tsx         # Bảng với search + pagination
└── export-button.tsx        # Nút tải file Excel

src/app/quanly/bao-cao/[type]/page.tsx  # 8 trang cụ thể
```

### Fix UI ID
- [src/lib/api/lookups.ts](../../src/lib/api/lookups.ts) — `useLookupMap` hook (cache 5 phút)
- [src/components/admin/name-cell.tsx](../../src/components/admin/name-cell.tsx) — `NameCell` component

## Filter hỗ trợ

| Param | Áp dụng cho | Mô tả |
|---|---|---|
| `from`, `to` | hầu hết | ISO date — lọc theo `created_at`/`received_at`/`start_date` |
| `shop_id` | doanh thu, sản phẩm, … | UUID cửa hàng |
| `channel` | doanh thu | pos, online, phone, in_store |
| `status` | orders, repair, voucher | tuỳ entity |
| `payment_status` | doanh thu | unpaid, partial, paid, refunded |
| `tier` | khách hàng | bronze, silver, gold, platinum, diamond |
| `category_id`, `brand_id` | sản phẩm | UUID phân loại |

## API Response shape

```ts
type ReportResponse<T> = {
  filters: Record<string, unknown>;
  generatedAt: string;
  summary: Record<string, number | string>;
  charts: {
    series?: Array<{ bucket: string; value: number; count?: number }>;
    distribution?: Array<{ key: string; value: number }>;
  };
  rows: T[];     // tối đa 200 cho UI
  total: number; // tổng rows trong DB
};
```

## Excel format

- 2 sheet: **Tổng quan** + **Chi tiết**
- Header row: bold + fill xanh `FF1E40AF` + text trắng, freeze row 1
- Auto-filter toàn bảng chi tiết
- Format cột: `money` → `#,##0`, `date` → `dd/mm/yyyy`, `datetime` → `dd/mm/yyyy hh:mm`, `percent` → `0.00%`
- Border nhẹ cho data rows
- Tên file: `bao-cao-[type]-YYYY-MM-DD.xlsx`

## Permission

Hiện tại chỉ yêu cầu `requireUser()` (đã đăng nhập). Permission chi tiết theo role sẽ thêm ở giai đoạn sau.

## Khắc phục sự cố

- **Báo cáo trống** — kiểm tra filter `from`/`to`, đảm bảo có dữ liệu trong khoảng
- **Excel lỗi font** — máy chưa cài font hỗ trợ tiếng Việt
- **Query chậm** — thêm index cho cột `created_at` trên các bảng lớn (`orders`, `order_items`)
- **Tải Excel 0 bytes** — kiểm tra RLS Supabase cho phép user hiện tại đọc bảng đó
