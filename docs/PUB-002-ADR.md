# PUB-002 — ADR kiến trúc desktop

**Owner**: DEV-A + DEV-B  
**Reviewer**: DEV-C  
**Size**: M  
**Status**: DONE

## Quyết định

| # | Chủ đề | Lựa chọn | Lý do |
|---|--------|----------|-------|
| ADR-1 | Main / Renderer / Preload | Electron main + sandboxed renderer + contextBridge preload | Bảo mật IPC; tách biệt quyền truy cập fs/network. |
| ADR-2 | Local DB | SQLite (`better-sqlite3`) | Không cần server, ACID, schema migration dễ. WAL + foreign keys. |
| ADR-3 | Queue worker | Serial, single-thread, in main process | Đơn giản, không cần worker_threads cho MVP; race đã giải bằng unique partial index. |
| ADR-4 | App data path | `app.getPath('userData')` | OS-native, đa-user safe, không commit. |
| ADR-5 | Browser provisioning | Chromium của Playwright; profile riêng; **KHÔNG** bundle trong installer | Tuân thủ giấy phép; cho phép update độc lập; profile size nhỏ. |
| ADR-6 | Installer | `electron-builder` + NSIS per-user | Không yêu cầu admin; dễ gỡ; artifact trong `release/`. |
| ADR-7 | Update strategy | Không auto-update trong MVP | An toàn khi policy vận hành chưa chốt; user tải bản mới thủ công. |

## Folder ownership

```
apps/facebook-publisher/
  src/main/        ← DEV-B (data, queue, services)
  src/preload/     ← DEV-B
  src/renderer/    ← DEV-C
  src/shared/      ← DEV-B + DEV-C review chung (IPC contract)
  tests/           ← DEV-D
```

## Rollback

- Mỗi milestone có commit ngược (`feat/fbp-m<N>-*`). Rollback bằng `git revert`.
- DB migration: giữ `pragma user_version`; rollback bằng file `*.down.sql` trong
  `db/migrations/` (ngoại trừ version 1 không thể rollback).