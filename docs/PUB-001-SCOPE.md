# PUB-001 — Chốt phạm vi vận hành

**Owner**: DEV-A  
**Reviewer**: chủ dự án + DEV-D  
**Size**: S  
**Status**: DONE

## Phạm vi hỗ trợ (in-scope)

- Nền tảng: Windows 10/11 x64.
- Một tài khoản Facebook, một browser profile, một queue tuần tự.
- User tự thêm URL các nhóm đã tham gia và được phép đăng bán hàng.
- Bài đăng trong group: Unicode text + một hoặc nhiều ảnh.
- UI Facebook tiếng Việt trước; kiến trúc để thêm tiếng Anh.
- Playwright **luôn chạy `headless: false`** (user nhìn thấy trình duyệt).
- Chế độ mặc định: **Assisted mode** (tool điền, user bấm Submit).
- Queue bền vững, chống trùng, preflight gia/tồn kho, phân loại kết quả.
- CAPTCHA / checkpoint / 2FA / UI không nhận diện → tự động **dừng queue**.

## Ngoài phạm vi (out-of-scope)

- Tự tìm / thu thập / tham gia group.
- Marketplace & form "Bán mặt hàng" chuyên dụng.
- Nhiều tài khoản, proxy, fingerprint spoofing, kỹ thuật né phát hiện.
- Vượt CAPTCHA, 2FA, checkpoint, cảnh báo Facebook.
- Scheduler chạy ngầm, analytics, watermark, cloud sync đa người.
- Tự động submit trên Facebook thật khi chưa qua gate phê duyệt vận hành.

## Vertical slice mẫu (cho reviewer check)

> Khi user dùng "Đăng bài hỗ trợ" vào group `Laptop Sạc Pin – Test`, hệ thống phải:
>
> 1. Render template với product/biến thể đã chọn và tải ảnh về local.
> 2. Mở Chromium ở chế độ hiển thị đến group URL đó.
> 3. Điền text + ảnh, **dừng lại** trước khi submit và đợi user bấm "Submit" trong app.
> 4. Sau khi user xác nhận → mới bấm nút Post trên Facebook.
> 5. Kết quả: success / pending_approval / no_permission / unknown → cập nhật job state.

## Những yêu cầu mơ hồ đã chốt

| Câu cũ | Chốt |
|--------|------|
| "thành công" | = job ở state `success` trong DB, kèm `post_url` và `posted_at`. |
| "tự động" | = chỉ auto-submit khi `settings.auto_submit === true` **và** group `posting_mode === "auto"`. Ngược lại: assisted. |
| "nhiều ảnh" | = tối đa 5 ảnh / job (theo quy tắc Facebook composer). |

## Kết quả

- Owner đã ghi nhận phạm vi.
- DEV-B, DEV-C, DEV-D đã đọc và mô tả giống nhau một vertical slice.