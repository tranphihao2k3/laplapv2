# PUB-004 — Chuẩn hóa task evidence và verify scripts

**Owner**: DEV-D  
**Reviewer**: DEV-A  
**Size**: S  
**Status**: DONE

## Task evidence template

Mỗi task PHẢI có evidence file tại `docs/evidence/<TASK-ID>.md`:

```markdown
# <TASK-ID> — <Tên task ngắn gọn>

## Commit hash
- abc1234 — short description
- def5678 — short description

## Verify (Expected / Actual)

### npm --prefix apps/facebook-publisher run typecheck
- Expected: exit 0
- Actual: exit 0

### npm --prefix apps/facebook-publisher run test:integration -- --run <test-name>
- Expected: pass
- Actual: 5 passed, 0 failed

## Severity (P0/P1/P2/P3)
- Không có / list rủi ro

## Checklist từ docs/FB-PUBLISHER-TASKS.md §3
- [x] Mỗi verify exit 0
- [x] Không log/commit token/cookie
- [x] Có commit hash, Expected/Actual
- [x] Reviewer: DEV-X, 2026-08-02, Windows 11
```

## Severity

| Sev | Nghĩa |
|-----|-------|
| P0 | Lộ dữ liệu, mất tiền, account bị khóa vĩnh viễn |
| P1 | Chức năng chính không dùng được, không có workaround |
| P2 | Chức năng chính có workaround, hoặc chức năng phụ hỏng |
| P3 | Cosmetic, typo, perf nhẹ |

## Verify scripts bắt buộc

Tất cả chạy được trên Windows PowerShell 7:

```powershell
# Web
npm run lint
npm run typecheck
npm run build

# Desktop
npm --prefix apps/facebook-publisher run format:check
npm --prefix apps/facebook-publisher run lint
npm --prefix apps/facebook-publisher run typecheck
npm --prefix apps/facebook-publisher run test:unit
npm --prefix apps/facebook-publisher run test:integration
npm --prefix apps/facebook-publisher run build
npm --prefix apps/facebook-publisher run verify
```

Mỗi milestone PHẢI chạy đủ danh sách trên và attach output vào `docs/evidence/<milestone>.md`.