# QA-002 — Manual smoke checklist

> File này tổng hợp bước smoke test thủ công trên group test riêng (docs §14 QA-002).
> Owner thực hiện: DEV-D + chủ dự án + DEV-A review.
> Auto-submit **KHÔNG** nằm trong smoke nếu `GOV-AUTO` chưa pass — chỉ assisted.

## 1. Điều kiện tiên quyết

- [ ] LapLap API mock đang chạy (nếu không có internet/prod API).
- [ ] 1 tài khoản Facebook test được phép đăng vào group test riêng (đã pre-approve với chủ dự án).
- [ ] Group test riêng KHÔNG có người dùng thật.
- [ ] Profile Playwright tách biệt (`<userData>/browser-profile`), KHÔNG dùng Chrome profile cá nhân.
- [ ] 1 bài/lúc (serial worker QUE-002).
- [ ] Settings.defaultPostingMode = "assisted", autoSubmitGloballyAllowed = false.

## 2. Smoke matrix

Mỗi case ghi Expected/Actual, post URL/status, commit hash, evidence (screenshot/trace).

| # | Case | Expected | Actual | Evidence |
|---|------|----------|--------|----------|
| 1 | Login app, login FB 2FA | authStatus=authenticated; queue cho job đầu chạy. | | |
| 2 | Đăng bài text + 1 ảnh | posted; group test nhận bài; postUrl có dạng /posts/. | | |
| 3 | Đăng bài text + nhiều ảnh (giữa plan = 5) | posted; thumbnail preview khớp thứ tự. | | |
| 4 | pending_approval | group cần duyệt → job chuyển `pending_approval` (KHÔNG auto retry). | | |
| 5 | no_permission | job chuyển `needs_action`; queue dừng tại group đó. | | |
| 6 | session expired (logout FB) | job kế tiếp dừng ở `preflight`; user phải login lại. | | |
| 7 | checkpoint/CAPTCHA | job chuyển `needs_action`; queue dừng; diagnostics screenshot lưu. | | |
| 8 | unknown UI | job chuyển `needs_action` + reason="unknown UI". | | |
| 9 | Cancel mid-flight | job chuyển `cancelled`; không submit click. | | |
| 10 | Pause/Resume | job tạm dừng không chạy tiếp; resume chạy tiếp. | | |
| 11 | Emergency stop | job hiện tại cancel; job sau không lấy. | | |
| 12 | Crash app giữa posting | restart app → RecoveryService: pre-submit requeue, post-submit unverified. | | |
| 13 | Restart app giữa chừng | queue resume đúng state, không tạo bài trùng (fingerprint). | | |
| 14 | Sửa template sau enqueue | snapshot JSON không đổi; bài đã đăng vẫn dùng text cũ. | | |
| 15 | Sửa product sau enqueue | snapshot JSON giữ giá/updatedAt cũ; preflight phát hiện mismatch. | | |

## 3. Sensitive info trong evidence

- [ ] KHÔNG chụp màn hình có token/cookie FB.
- [ ] Diagnostics screenshot đã redact (PW-008 `redact()`).
- [ ] Post URL: che phần `fbclid=` nếu có.
- [ ] Email user: che domain sau `@`.

## 4. Acceptance

Smoke pass khi:
- 15/15 case đạt Expected (Actual = Expected).
- Evidence đầy đủ + che thông tin nhạy cảm.
- Auto-submit CHƯA chạy (chỉ assisted) nếu `GOV-AUTO` chưa pass.