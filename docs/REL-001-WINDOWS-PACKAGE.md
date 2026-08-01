# REL-001 — Windows package, browser provisioning & upgrade

> Build NSIS installer x64 cho Windows. Playwright browser binary **KHÔNG** bundle (user tự cài qua `npx playwright install chromium` ở lần đầu; hoặc download qua installer giai đoạn sau).

## 1. Build NSIS

```bash
cd apps/facebook-publisher
npm ci
npm run rebuild    # rebuild better-sqlite3 cho Electron
npm run build      # electron-vite build + typecheck
npm run package:win
```

Output: `apps/facebook-publisher/release/LapLap Facebook Publisher-<version>-x64.exe`.

## 2. Browser provisioning

Lần đầu chạy app:

1. App mở cửa sổ Playwright riêng (headed).
2. Nếu chromium binary chưa có → `browserLaunch` trả `missing_binary`.
3. UI hiển thị: "Cần cài Chromium. Chạy `npx playwright install chromium` trong app folder, hoặc tải từ Playwright CDN."
4. Sau khi cài, `browserLaunch` chạy lại thành công → user login FB + 2FA.

## 3. Upgrade path

- DB: chạy migration khi version > installed (DB-001 / schema.ts). Idempotent, rollback an toàn.
- Settings: `SettingsRepository.patch()` merge vào JSON; field mới default = `DEFAULT_SETTINGS`.
- Profile Playwright: giữ nguyên, không xoá; user login lại nếu cookie invalid.

## 4. Smoke trên Windows

Acceptance (docs §14 REL-001):
- [ ] Installer cài vào `%LocalAppData%\Programs\LapLap Facebook Publisher` (per-user, không yêu cầu admin).
- [ ] Desktop + Start Menu shortcut tạo đúng.
- [ ] App mở với cùng login/auth state như build trước (DB persistent).
- [ ] Mở Settings hiển thị apiBaseUrl + locale + posting mode đúng.
- [ ] `npx playwright install chromium` chạy thành công từ app folder.
- [ ] Đăng bài smoke 1 case (text + 1 ảnh) qua group test riêng.
- [ ] Logs/diagnostics KHÔNG chứa token/cookie plain text.

## 5. Artifact cleanup

`release/` directory phải ignore khỏi git (`.gitignore` đã có). Commit chỉ chứa:
- Source code.
- Docs (REL-001, SEC-001, QA-002).
- Config (electron-builder).

Không commit installer binary.