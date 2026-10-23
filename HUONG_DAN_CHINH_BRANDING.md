# 🎨 Hướng dẫn Chỉnh Tên Thương Hiệu & Thông Tin Cửa Hàng

## ✨ Vấn đề Trước Đây
Bạn chỉnh tên thương hiệu ở 1 chỗ nhưng **không áp dụng khắp nơi**? 
- Header không update
- Footer không update  
- Các trang khác không cập nhật

## ✅ Giải Pháp - Chỉ Cần Chỉnh 1 Chỗ

### 🌐 Truy Cập Admin Settings
1. Vào **Admin Dashboard** → **Cấu hình**
2. Chọn tab **"Thông tin cửa hàng"** (tab đầu tiên)

### 📝 Các Trường Có Thể Chỉnh
| Trường | Mục đích | Hiển thị ở đâu |
|--------|---------|----------------|
| **Tên cửa hàng** | Tên thương hiệu | Header (Logo), Footer, Trang Liên hệ |
| **Email** | Email liên hệ | Footer, Form Liên hệ |
| **Số điện thoại** | SĐT chính | Footer, Trang Liên hệ |
| **Hotline** | Hotline riêng | Footer (nếu khác số điện thoại) |
| **Địa chỉ** | Địa điểm cửa hàng | Footer, Trang Liên hệ, Trang Giới thiệu |
| **Mô tả cửa hàng** | Giới thiệu ngắn | Footer, Trang Giới thiệu |

### 💾 Lưu Thay Đổi
1. Nhập dữ liệu mới vào các trường
2. Nhấn nút **"Lưu thông tin cửa hàng"**
3. Chờ thông báo "Đã cập nhật thông tin cửa hàng"

## 🔄 Cách Hoạt Động

### Server-Side (Backend)
- Tất cả thông tin được **lưu trong database** (bảng `settings`)
- Mỗi lần user truy cập trang, server **tự động lấy dữ liệu mới nhất** từ DB

### Client-Side (Frontend - Header)
- Header dùng hook `useBrandName()` để lấy tên cửa hàng
- **Tự động fetch từ API** khi component mount (lần đầu)
- **Cache trong localStorage** để tránh fetch liên tục
- Khi bạn lưu settings → cache bị xoá → lần tiếp theo tự động fetch mới

### Footer
- Footer dùng `getStoreInfoForRequest()` - **luôn lấy dữ liệu fresh** từ server
- Nên update **ngay lập tức** mà không cần reload

## 🚀 Kiểm Tra Kết Quả

### Sau khi lưu:
1. **Không cần reload** - trang sẽ **tự động update**
2. Kiểm tra:
   - ✅ **Header** - Logo/tên thương hiệu (phía trên cùng)
   - ✅ **Footer** - Tên, địa chỉ, liên hệ (cuối trang)
   - ✅ **Trang Liên hệ** - Hiển thị địa chỉ, điện thoại, giờ mở cửa

### Nếu vẫn chưa thay đổi:
1. **Xoá cache localStorage**:
   - Mở DevTools (F12)
   - Tab "Application" → "Local Storage"
   - Tìm key `STORE_INFO_CACHE` → Delete
   - Reload trang (Ctrl+F5)

2. **Hoặc dùng cách đơn giản**:
   - Mở Private/Incognito Window (Chrome)
   - Truy cập trang để kiểm tra

## 📍 Tab Liên Quan

| Tab | Chức năng |
|-----|-----------|
| **Thông tin cửa hàng** ← **Bạn ở đây** | Tên, email, phone, địa chỉ |
| Tổ chức | Thông tin doanh nghiệp (hoá đơn) |
| Cấu hình hệ thống | Bảo hành, hoá đơn, loyalty |
| Trust Badges | Huy hiệu tin tưởng |
| Liên hệ | Kênh liên hệ, giờ mở cửa, mạng xã hội |
| Footer | Cấu trúc footer, cột link |
| Pháp lý & BCT | Thông tin doanh nghiệp, Bộ Công Thương |

## 🔧 Cách Sửa Lỗi

### Lỗi: "Lỗi khi lưu dữ liệu"
- Kiểm tra internet connection
- Thử lại lần nữa
- Nếu vẫn lỗi, báo cáo bug

### Lỗi: Thay đổi không hiển thị sau 30 giây
- Xoá cache localStorage (hướng dẫn ở trên)
- Refresh trang bằng `Ctrl+Shift+Delete` (full refresh)

## 📚 Cấu Trúc Hệ Thống

```
Database (settings table)
    ↓
API /v1/settings
    ↓
Server-side: getStoreInfo() → Footer (luôn fresh)
Client-side: useBrandName() → Header (cache localStorage)
```

## ✨ Điểm Khác Biệt

### Header (Client-Side Hook)
```
1. Lần đầu: Gọi API → Cache → Display
2. Khi user lưu: Cache xoá → Lần tới gọi API lại
3. Lợi ích: Nhanh, không load mỗi khi render
```

### Footer (Server-Side)
```
1. Mỗi page load: Gọi API (server) → Display
2. Lợi ích: Luôn up-to-date, SEO tốt
3. Lưu ý: Có caching ở level Next.js
```

## 💡 Mẹo Tối Ưu

1. **Khi chỉnh tên thương hiệu**
   - Dùng 1-2 từ, ngắn gọn
   - Tránh ký tự đặc biệt
   - VD: "LapLap" (tốt), "Cửa Hàng Bán Laptop" (quá dài)

2. **Khi chỉnh email/phone**
   - Đảm bảo format đúng (email phải có @)
   - Phone phải hợp lệ (số hoặc định dạng quốc tế)

3. **Khi chỉnh địa chỉ**
   - Ghi đầy đủ: số nhà, đường, quận, thành phố
   - VD: "123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ"

---

**Bạn có thắc mắc gì không?** Hãy liên hệ qua email hoặc hotline! 📞
