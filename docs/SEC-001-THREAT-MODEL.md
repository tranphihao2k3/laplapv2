# SEC-001 — Security gate

> Bảo vệ chống lộ secret/cookie/token; renderer bị cô lập; profile cá nhân không bị đụng; log sạch.

## 1. Threat model

| ID | Vector | Impact | Mitigation |
|----|--------|--------|------------|
| TM-1 | Renderer process cố `require` Node API | Code execution ngoài sandbox | `contextIsolation:true`, `nodeIntegration:false`, `sandbox:true`, CSP không cho `unsafe-eval`. |
| TM-2 | Renderer gửi IPC payload độc hại | SQL injection, type confusion | Zod validate payload ở preload + main; tất cả SQL qua prepared statements. |
| TM-3 | Renderer cố truy cập file ngoài allowlist | Lộ file user | Renderer KHÔNG có `fs`; mọi file I/O qua main service IPC. |
| TM-4 | Renderer dò access_token qua channel trộm | Token lộ | Preload KHÔNG truyền token qua IPC; chỉ `authGetStatus` (boolean+metadata). Token cất trong main process. |
| TM-5 | Refresh token lưu plain text | Token lộ khi DB lộ | `safeStorage` mã hoá refresh token; access token chỉ in-memory. |
| TM-6 | Log lộ cookie/token | Forensic leak | `DiagnosticsService.redact` áp dụng cho mọi log đi qua. |
| TM-7 | Playwright dùng Chrome cá nhân | Profile leak | `BrowserProfileManager` ép path = `<userData>/browser-profile`; KHÔNG trỏ `~/.config/google-chrome`. |
| TM-8 | Profile bị lock bởi context thứ 2 | Race condition | Lock file atomic `wx`; nếu fail → reject launch. |
| TM-9 | Secret (service_role key, JWT) lọt vào bundle | Privilege escalation | `tests/security/scanner.ts` quét src + tests + docs mỗi `verify`. |
| TM-10 | Ảnh tải từ host lạ | SSRF / data leak | `ImageService` host whitelist + MIME allowlist + size cap. |
| TM-11 | URL Facebook bypass qua `normalizeFacebookGroupUrl` | Đăng nhầm group | Helper chỉ accept `facebook.com/groups/<id>`; reject các path khác. |
| TM-12 | Template eval qua body | Code execution | `engine` KHÔNG eval; chỉ duyệt token `{{var}}`; assert allowlist prefix. |
| TM-13 | Anti-detection | Tài khoản bị flag | KHÔNG dùng proxy rotation, stealth plugin, fake user agent (docs §12 PW-007). |
| TM-14 | ReDoS qua regex template body | DoS | Engine duyệt tuần tự `{{` `}}`, không regex phức tạp. |

## 2. Security checklist (CI gate)

Trong `apps/facebook-publisher`, mỗi PR phải pass:

- [ ] `npm run typecheck` exit 0.
- [ ] `npm run lint` exit 0.
- [ ] `npm run test:unit` exit 0.
- [ ] `npm run test:integration` exit 0 (bao gồm `secret-scanner.test.ts`).
- [ ] Secret scanner KHÔNG tìm thấy service-role key / JWT / cookie pattern trong `src/`, `tests/`, `docs/`.
- [ ] BrowserWindow cấu hình đúng (test `tests/integration/security.test.ts` kiểm tra flag).
- [ ] Preload KHÔNG truyền token qua IPC channel.
- [ ] IPC handlers dùng Zod validation 2 lớp.

## 3. Forbidden patterns (CI check)

`tests/integration/security.test.ts` chạy trên bundle và source để chặn:

- `eval(` trong main/preload.
- `require("electron")` ngoài main.
- `child_process.exec(` trong main (chỉ được dùng `spawn` cho `chromium.launch`).
- `process.env` đọc trực tiếp secret.
- `Buffer.from(atob(` hoặc `atob(` trong renderer (decode ngoài sandbox).