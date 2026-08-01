# LapLap Facebook Publisher

Electron desktop app for posting product listings to Facebook groups via
Playwright. MVP scope, conventions, và acceptance criteria cho từng task
được chốt trong `docs/FB-PUBLISHER-TASKS.md`.

## Stack

- Electron + electron-vite
- React 18 + TypeScript
- electron-builder (Windows NSIS x64)

## Cấu trúc

```
src/
  main/        Electron main process — owns DB, FS, secret, queue, Playwright
  preload/     Typed bridge qua contextBridge — IPC allowlist
  renderer/    React UI — không có nodeIntegration
  shared/      Type dùng chung main/preload/renderer
```

## Scripts

```powershell
npm --prefix apps/facebook-publisher install
npm --prefix apps/facebook-publisher run dev          # Electron + HMR
npm --prefix apps/facebook-publisher run build        # Build main/preload/renderer
npm --prefix apps/facebook-publisher run typecheck    # typecheck main+renderer
npm --prefix apps/facebook-publisher run lint
npm --prefix apps/facebook-publisher run verify       # typecheck && lint && build
npm --prefix apps/facebook-publisher run package:win  # NSIS installer
```

## Nguyên tắc an toàn (giữ từ bây giờ)

- Renderer KHÔNG có `require`, `nodeIntegration`, filesystem access.
- Mọi capability từ renderer phải qua preload + IPC allowlist ở main.
- Browser profile tách riêng trong app data, không dùng Chrome cá nhân.
- Không cấp `SUPABASE_SERVICE_ROLE_KEY` cho app — chỉ user access token.
- Tailwind CSS chưa add — đợi UI-* (M3) quyết định design system.

## Trạng thái

- M1 (API cho desktop): ✅ commit trên `feat/fbp-api-m1-products`
- M2/APP-001: scaffold done — chưa commit
- M2 còn lại: APP-002 (security gate), DB-001 (SQLite), APP-003..005
