# LapLap Mini Tool — Plan chi tiết & Task list

> **Ngày soạn:** 2026-08-18
> **Phạm vi:** Mini desktop tool (portable, chạy từ USB) để kết nối với web
> `laplapcantho.store` đang deploy trên Fly.io (`laplapv2`).
> **Mục đích tài liệu:** thống nhất kiến trúc, schema, API, milestones, task
> list ưu tiên (P0/P1/P2) trước khi bắt đầu code.

---

## 1. Overview

### 1.1. Vấn đề hiện tại
Web LapLap đã có giao diện `/test-laptop/*` rất đầy đủ (ranking, system-scan,
benchmark FurMark, tools, keyboard, speakers, display, camera-mic…) nhưng phần
lớn tính năng nặng (quét WMI, SMART, benchmark GPU, gọi `.exe` từ nhà cung
cấp…) lại phải **download file `.bat`/`.zip` rồi chạy thủ công** (`/test-laptop/benchmark`
tải `furmark-benchmark.exe`, `/test-laptop/system-scan` tải zip chứa
`LapLap-Scanner.bat`). Quy trình này:

- Phụ thuộc SmartScreen, PowerShell execution policy
- Khó dùng cho khách hàng cuối (KTV mới, khách mua máy)
- Thiếu các tính năng: cleanup, rename PC, wallpaper, test mic/camera/touchpad/
  Wi-Fi/chuột
- Phải chạy tool rồi quay lại web nhập tay từng thông số

### 1.2. Mục tiêu
Xây **một mini desktop tool portable** (chạy từ USB, double-click, không cài
đặt) — gom toàn bộ nhóm chức năng dưới đây vào một UI gọn gàng, đồng bộ trực
tiếp với web LapLap bằng cách sinh **URL sâu** / gọi **API upload** dựa trên
session token mà web cung cấp.

### 1.3. 4 nhóm chức năng (user persona = KTV / tester / khách mua máy)
1. **Hardware info checker** — quét toàn bộ phần cứng (CPU, RAM, SSD, GPU,
   mainboard, battery, S/N, OS, network).
2. **Benchmark runner** — chạy FurMark / UserBenchmark / (tương lai 3DMark,
   Cinebench, CrystalDiskMark, AIDA64) rồi upload điểm.
3. **Optimization utilities** — dọn rác, tắt BitLocker, rename PC, đổi
   wallpaper, disable startup.
4. **Hardware tester** — loa, mic, camera, màn hình (dead pixel, color),
   bàn phím, touchpad, Wi-Fi speed test, chuột.

### 1.4. Use case chính
- KTV mở web `/test-laptop/system-scan` → copy URL/session → mở tool từ USB
  → tool đọc clipboard → quét máy → bấm nút "Đẩy lên web" → tool mở browser
  trỏ về trang ranking với data đã gắn vào URL / đã POST xong.
- KTV chạy FurMark 5 phút từ tool → tool ghi điểm + cấu hình → bấm "Upload
  kết quả" → xuất hiện rank Excellent/Good/Fair/Poor trên web.

### 1.5. Out of scope (Phase 1)
- Build/installer có ký số (Code Signing cert) — chỉ phát hành portable.
- Tự động cập nhật tool — user copy phiên bản mới từ USB.
- Hỗ trợ macOS, Linux — chỉ Win 10/11.
- Login/account trong tool — không cần.

---

## 2. Tech stack đề xuất

### 2.1. So sánh nhanh

| Tiêu chí | **Electron + React + Tailwind** | Tauri + React + Tailwind | WPF / WinUI 3 (.NET) |
|----------|---------------------------------|--------------------------|----------------------|
| Cùng stack với web (dùng lại component) | ✅ Tuyệt vời | ✅ OK | ❌ C# riêng |
| Kích thước portable | ⚠ ~150MB unpack | ✅ ~10–30MB | ✅ ~30MB self-contained |
| Khởi động / RAM | ⚠ 200–400MB RAM | ✅ ~50–100MB | ✅ ~30–80MB |
| API truy cập phần cứng | ⚠ qua `systeminformation` (npm) hoặc spawn PowerShell | ⚠ qua PowerShell | ✅ Native WMI/CIM trực tiếp |
| Đóng gói USB portable | ⚠ `electron-builder` portable target | ✅ Tauri portable build | ✅ dotnet publish single-file |
| Thời gian dev | ⭐⭐⭐ nhanh | ⭐⭐ trung bình | ⭐ chậm (UI tốn công) |
| Logo + UI đẹp (consistency) | ✅ Tailwind + shadcn/ui dùng lại | ✅ tương tự | ⚠ phải code XAML riêng |

### 2.2. Đề xuất: **Electron + React + Tailwind + shadcn/ui**

**Lý do:**
1. **Consistency 100%** với web đang dùng (Next.js + React 19 + Tailwind +
   Radix/shadcn). Có thể **chia sẻ** component code nếu tách thành package
   `packages/shared`.
2. `systeminformation` (npm package) — đã support Windows full WMI + battery
   + SMART + baseboard rất đầy đủ, không phải tự viết PowerShell wrapper cho
   phần lớn use case.
3. UI đẹp theo style LapLap hiện tại (đã thấy ở `/test-laptop/*`) gần như copy-paste
   được.
4. Đóng gói portable: `electron-builder --win portable` → 1 file `.exe` duy nhất,
   double-click chạy, không cài đặt → rất hợp "USB box".
5. Trọng lượng không phải vấn đề (yêu cầu: *"không cần tối ưu dung lượng"*).

**Trade-off chấp nhận:**
- Kích thước ~150MB unpack, ~80–100MB khi nén zip. Trên USB 16GB thừa sức.
- RAM ~250MB khi mở → chấp nhận được.
- Windows SmartScreen sẽ cảnh báo "Unknown publisher" → user bấm "More info →
  Run anyway" (giống flow `furmark-benchmark.exe` hiện tại).

**Stack cụ thể:**
- Electron (latest stable, hiện >= v33)
- React 19 + TypeScript
- Vite + Electron Forge **hoặc** electron-vite
- Tailwind CSS v3 (đồng bộ với web)
- shadcn/ui (copy từ web sang)
- `systeminformation` — phần lớn hardware info
- `node-wmic` hoặc spawn PowerShell — fallback cho những gì `systeminformation`
  chưa có (VD: cycle count battery chính xác, SMART chi tiết) → đã có sẵn
  pattern ở file `system-scan/page.tsx`.
- Native shell APIs qua Electron: `shell.openExternal` (mở URL trong browser),
  `dialog` (chọn file).
- Storage local: `electron-store` (JSON file) + optional SQLite qua
  `better-sqlite3` cho logs.
- Auto-launch / portable-friendly: bundle `.exe` + tài nguyên vào 1 folder.

---

## 3. Architecture

### 3.1. Sơ đồ tổng quan

```
┌─────────────────────────────────────────┐         ┌─────────────────────────┐
│       WEB  (laplapcantho.store)         │         │  MINI TOOL (USB)        │
│                                         │         │  Electron + React       │
│   /test-laptop                          │         │                         │
│   ┌────────────────────────┐            │         │   ┌──────────────┐       │
│   │ User mở trang test    │            │         │   │ UI Tabs:     │       │
│   │ → URL có ?sid=...     │            │         │   │  - Hardware  │       │
│   └─────────┬──────────────┘            │         │   │  - Benchmark │       │
│             │                           │         │   │  - Optimize  │       │
│             ▼                           │         │   │  - Test HW   │       │
│   ┌────────────────────────┐    poll    │         │   └──────┬───────┘       │
│   │ Generate session token │◄───────────┼─────────┼──────────┘               │
│   │ + return session URL   │   token    │         │      │                   │
│   │ (1 lần từ device_id)   │            │         │      ▼                   │
│   └─────────┬──────────────┘            │         │   ┌──────────────┐       │
│             │                           │         │   │ systeminfo + │       │
│             ▼                           │         │   │ PowerShell   │       │
│   ┌────────────────────────┐            │         │   │ (fallback)   │       │
│   │ Supabase               │            │         │   └──────┬───────┘       │
│   │  tables + storage      │            │         │          │               │
│   └────────────────────────┘            │         │          ▼               │
│                                         │         │   ┌──────────────┐       │
│   ┌────────────────────────┐            │         │   │ Build upload │       │
│   │ POST /api/v1/mini-tool │◄───────────┼─────────┼───┤ payload +    │       │
│   │   /upload?sid=X&sig=Y  │  JSON body │         │   │ encode       │       │
│   └────────────────────────┘            │         │   └──────────────┘       │
│                                         │         │                         │
└─────────────────────────────────────────┘         └─────────────────────────┘
```

### 3.2. Luồng "đẩy data lên web" — Happy path

```
Bước  Actor       Hành động
────  ───────────  ─────────────────────────────────────────────────────────
1     User         Mở web /test-laptop/system-scan (đã đăng nhập/không cần)
                  Web sinh session token + URL kèm ?sid=
2     User         Khởi động mini tool từ USB
                  → Tool paste URL/sid từ clipboard (1 nút "Import session")
3     Tool         GET  https://laplapcantho.store/api/v1/mini-tool/session?sid=X
                  ← Server verify sid còn hạn, return { sessionId, expiresAt,
                     laptopId?, requiredFields[] }
4     Tool         User quét / test xong (data + benchmark + utilities)
                  → Tool build payload MiniToolUploadPayload
5     Tool         (A) POST /api/v1/mini-tool/upload?sid=X
                        Body: payload (JSON) + signature (HMAC-SHA256(localSecret))
                  ← 201 { ok: true, redirectUrl, rankingId?, saved: { ... } }
                  hoặc (B) Tạo deep URL → mở browser tự động
6     Web          Nhận payload, verify signature, save Supabase
                  Redirect về /test-laptop/ranking hoặc /test-laptop/system-scan
                  với status=complete
```

### 3.3. Luồng phụ — không cần session (utility / data dump)
Nếu user chỉ muốn xem hardware info trên tool (không upload), tool vẫn hoạt động
bình thường — session chỉ cần khi muốn upload ranking.

### 3.4. Sơ đồ thư mục dự kiến (repo web hiện tại)

> Tùy monorepo hay sub-repo. Đề xuất giai đoạn đầu: **sub-repo riêng**
> `laplap-mini-tool/` ở ngoài, share không qua npm package (copy component). Khi
> ổn định → refactor sang Turborepo / pnpm workspace.

```
laplap-mini-tool/                    ← mới, song song với laplap-laptop
├── package.json
├── electron.vite.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── forge/                           ← Electron Forge assets
│   └── plugin.icon.svg
├── src/
│   ├── main/                        ← Electron main process (Node)
│   │   ├── window.ts                ← BrowserWindow create / portable mode
│   │   ├── ipc.ts                   ← IPC handlers
│   │   ├── hardware.ts              ← Wrap systeminformation
│   │   ├── powershell.ts            ← Spawn PowerShell scripts (fallback)
│   │   ├── benchmark.ts             ← Launch FurMark/UserBenchmark, parse
│   │   ├── store.ts                 ← electron-store wrapper
│   │   └── upload.ts                ← Build payload + signature
│   ├── preload/
│   │   └── index.ts                 ← contextBridge → expose API
│   └── renderer/                    ← React UI (giống /test-laptop)
│       ├── App.tsx
│       ├── pages/
│       │   ├── Hardware.tsx
│       │   ├── Benchmark.tsx
│       │   ├── Optimize.tsx
│       │   └── TestHw.tsx
│       ├── components/
│       │   ├── ui/                  ← shadcn copy từ web
│       │   ├── HardwareCards.tsx
│       │   └── ...
│       ├── lib/
│       │   ├── session.ts           ← paste URL/sid, save state
│       │   └── upload.ts
│       └── styles/
│           └── globals.css
├── assets/                          ← logo LapLap, icons, sample wallpaper
└── scripts/
    ├── pack-portable.ps1            ← Build → dist-portable/
    └── sign.ps1                     ← (optional) codesign sau này
```

---

## 4. Database schema

> **Lưu ý:** Trình bày ở đây là **DDL ĐỀ XUẤT** chưa chạy. Khi triển khai sẽ tạo
> migration mới `025_mini_tool.sql` (chạy trong Supabase SQL Editor).

### 4.1. Bảng mới cần thêm

#### 4.1.1. `mini_tool_sessions` — session token do web sinh ra
```sql
CREATE TABLE IF NOT EXISTS mini_tool_sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text UNIQUE NOT NULL,                  -- UUID không gạch nối, 32 chars (gửi cho tool)
  -- optional: gắn với user nếu user đăng nhập
  created_by   uuid,
  -- tham chiếu tới laptop nếu user đã đăng ký từ trước
  laptop_id    uuid REFERENCES laptops(id) ON DELETE SET NULL,
  -- dữ liệu web đã biết (form user nhập tay trên web)
  context      jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- đã dùng chưa (tool gọi /upload xong thì mark used)
  consumed_at  timestamptz,
  -- hết hạn
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '2 hours'),
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_sid    ON mini_tool_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_sessions_expiry ON mini_tool_sessions(expires_at);
ALTER TABLE mini_tool_sessions ENABLE ROW LEVEL SECURITY;
-- public read để tool verify; creation phải qua service role (admin API)
CREATE POLICY "Allow public read mini_tool_sessions"
  ON mini_tool_sessions FOR SELECT USING (true);
```

#### 4.1.2. `mini_tool_uploads` — payload đầy đủ tool gửi lên
```sql
CREATE TABLE IF NOT EXISTS mini_tool_uploads (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      text REFERENCES mini_tool_sessions(session_id) ON DELETE SET NULL,
  -- identity người dùng
  device_id       text NOT NULL,
  device_name     text,
  -- raw payload đầy đủ (để audit / re-parse nếu schema đổi)
  payload         jsonb NOT NULL,
  -- "mini-tool-v1" — đánh version cho payload schema
  payload_version text NOT NULL DEFAULT 'mini-tool-v1',
  -- signature HMAC-SHA256(secret, payload) hex
  signature       text,
  -- nếu link với laptop đã có (upsert theo device_id)
  laptop_id       uuid REFERENCES laptops(id) ON DELETE SET NULL,
  -- benchmark nếu có
  gpu_score       integer,
  -- trạng thái xử lý server: pending, processed, rejected
  status          text NOT NULL DEFAULT 'processed',
  rejection_reason text,
  -- OS đã thấy (để filter)
  os_info         jsonb,
  -- IP nguồn (log)
  source_ip       inet,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '60 days')
);

CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_session  ON mini_tool_uploads(session_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_device   ON mini_tool_uploads(device_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_laptop   ON mini_tool_uploads(laptop_id);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_expires  ON mini_tool_uploads(expires_at);
CREATE INDEX IF NOT EXISTS idx_mini_tool_uploads_gpu      ON mini_tool_uploads(gpu_score DESC NULLS LAST);

ALTER TABLE mini_tool_uploads ENABLE ROW LEVEL SECURITY;
-- Public read (mirror public read laptop_specs, gpu_benchmarks)
CREATE POLICY "Allow public read mini_tool_uploads"
  ON mini_tool_uploads FOR SELECT USING (true);
-- INSERT chỉ qua service role (API route) — không có policy INSERT từ anon/auth
```

#### 4.1.3. Bảng `hardware_test_results` — lưu từng test (pass/fail)
```sql
CREATE TABLE IF NOT EXISTS hardware_test_results (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id      uuid NOT NULL REFERENCES mini_tool_uploads(id) ON DELETE CASCADE,
  laptop_id      uuid REFERENCES laptops(id) ON DELETE SET NULL,
  -- 'speaker' | 'mic' | 'camera' | 'display_deadpixel' | 'display_color' |
  -- 'keyboard' | 'touchpad' | 'wifi' | 'mouse' | 'launcher_test'
  test_type      text NOT NULL,
  -- 'pass' | 'fail' | 'skip' | 'inconclusive'
  result         text NOT NULL,
  -- dữ liệu raw (ví dụ 'speaker': test song id, volume, channel L/R; 'wifi': Mbps)
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- tuỳ chọn ghi chú KTV
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hw_tests_upload  ON hardware_test_results(upload_id);
CREATE INDEX IF NOT EXISTS idx_hw_tests_type    ON hardware_test_results(test_type);
CREATE INDEX IF NOT EXISTS idx_hw_tests_result  ON hardware_test_results(result);

ALTER TABLE hardware_test_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read hardware_test_results"
  ON hardware_test_results FOR SELECT USING (true);
```

### 4.2. Bổ sung &o bảng `laptop_specs` (nếu chưa có)
Schema hiện tại ở `013_laptop_benchmarks.sql` đã có gần hết. Tool cần thêm một
số trường (đa số optional → nếu chưa có thì ALTER):
```sql
-- Nếu chưa có trong 013/016/018:
ALTER TABLE laptop_specs
  ADD COLUMN IF NOT EXISTS mainboard             varchar(255),     -- migration 016 có
  ADD COLUMN IF NOT EXISTS battery_cycles        integer,          -- migration 016 có
  ADD COLUMN IF NOT EXISTS bios_version          varchar(64),
  ADD COLUMN IF NOT EXISTS bios_serial           text,
  ADD COLUMN IF NOT EXISTS motherboard_serial    text,
  ADD COLUMN IF NOT EXISTS product_sku           varchar(128),
  ADD COLUMN IF NOT EXISTS os_edition            varchar(64),
  ADD COLUMN IF NOT EXISTS os_build              varchar(32),
  ADD COLUMN IF NOT EXISTS os_arch               varchar(16),      -- x64 / arm64
  ADD COLUMN IF NOT EXISTS os_activated          boolean,
  ADD COLUMN IF NOT EXISTS network_macs          jsonb,            -- [{ iface, mac, ipv4[] }]
  ADD COLUMN IF NOT EXISTS wifi_adapter          varchar(255),
  -- Đa đĩa (multi disk): giữ schema hiện cho "primary", bổ sung vào JSONB
  ADD COLUMN IF NOT EXISTS storage_drives        jsonb,
  -- RAM per-slot (nâng cao từ modules rời rạc)
  ADD COLUMN IF NOT EXISTS ram_slots_detail      jsonb,
  -- SMART health % (số nguyên 0..100, null nếu không đọc được)
  ADD COLUMN IF NOT EXISTS storage_health_pct    integer,
  -- GPU driver version
  ADD COLUMN IF NOT EXISTS gpu_driver_version    varchar(64);
```

### 4.3. Quan hệ giữa các bảng (tóm tắt)
```
laptops ──┬── laptop_specs          (1:1)
          ├── gpu_benchmarks        (1:N, mỗi lần test)
          └── mini_tool_uploads     (1:N, mỗi lần tool upload)
                  │
                  └── hardware_test_results (1:N, các test phụ)

mini_tool_sessions (token do web cấp, 1:N → mini_tool_uploads qua session_id)
```

---

## 5. API endpoints

### 5.1. Endpoints mới cần thêm

| Method | Path                                  | Mô tả | Auth |
|--------|---------------------------------------|-------|------|
| `POST` | `/api/v1/mini-tool/sessions`          | Web sinh session mới (khi user bấm nút "Mở tool" trên trang `/test-laptop/*`) | optional (gắn với user đăng nhập nếu có) |
| `GET`  | `/api/v1/mini-tool/session`           | Tool gọi để verify sid còn hạn, lấy context (laptop_id?, requiredFields?) | public (sid là secret enough) |
| `POST` | `/api/v1/mini-tool/upload`            | Tool đẩy data lên. Body: payload + signature | public + verify signature |
| `GET`  | `/api/v1/mini-tool/uploads/:laptopId` | Web xem lịch sử các lần upload (cho ranking view mở rộng) | public |

### 5.2. Endpoint chi tiết

#### 5.2.1. `POST /api/v1/mini-tool/sessions`
**Body:**
```json
{
  "redirectAfterUpload": "/test-laptop/ranking",   // optional
  "context": {                                     // optional, gắn vào session
    "laptop_id": "uuid?",
    "require": ["hardware_info", "benchmark", "speaker_test"]
  }
}
```
**Response 200:**
```json
{
  "ok": true,
  "data": {
    "sessionId":   "9f3a... 32hex",
    "uploadUrl":   "https://laplapcantho.store/api/v1/mini-tool/upload?sid=9f3a...",
    "webUrl":      "https://laplapcantho.store/api/v1/mini-tool/receive?sid=9f3a...",
    "verifyUrl":   "https://laplapcantho.store/api/v1/mini-tool/session?sid=9f3a...",
    "expiresAt":   "2026-08-18T22:33:00Z",
    "ttlSeconds":  7200
  }
}
```
**Lưu ý:** secret để tool ký signature sẽ là **shared HMAC key** được
admin pre-config trong tool config (không truyền qua URL). Tool giữ key này
hard-coded + checksum trong binary; thay đổi key → rebuild tool.

#### 5.2.2. `GET /api/v1/mini-tool/session?sid=X`
**Response 200:**
```json
{
  "ok": true,
  "data": {
    "sessionId":     "9f3a...",
    "valid":         true,
    "consumed":      false,
    "expiresAt":     "2026-08-18T22:33:00Z",
    "laptopId":      "uuid?",
    "context":       {},
    "requiredFields": ["hardware_info", "gpu_score"]     // echo từ POST sessions
  }
}
```

#### 5.2.3. `POST /api/v1/mini-tool/upload?sid=X`
**Body (JSON):**
```json
{
  "payloadVersion": "mini-tool-v1",
  "device": {
    "deviceId":   "ASUS-TUF-F15-001",
    "deviceName": "ASUS TUF Gaming F15",
    "productSku": "FX506HC-HN002T",
    "serial":     { "bios": "X123ABC", "motherboard": "MNB123" },
    "os": {
      "name": "Windows 11 Home",
      "version": "23H2",
      "build": "22631.4317",
      "arch": "x64",
      "activated": true
    }
  },
  "hardware": {
    "cpu":      { "name": "Intel Core i7-12700H", "cores": 14, "threads": 20, "baseGhz": 2.3, "boostGhz": 4.7 },
    "ram":      { "totalGb": 16, "type": "DDR4", "speedMhz": 3200, "slots": 2, "modules": [...] },
    "storage":  [ { "name": "WD SN570", "type": "NVMe SSD", "capacityGb": 512, "healthPct": 92, "smart": {...} } ],
    "gpu":      [ { "name": "NVIDIA RTX 3050", "vendor": "NVIDIA", "vramGb": 4, "driverVersion": "555.99" } ],
    "mainboard":{ "model": "ASUS FX506HC", "biosVersion": "1.21" },
    "battery":  { "designMwh": 57000, "fullMwh": 52000, "healthPct": 91.2, "cycles": 134, "voltageMv": 11800 },
    "network":  { "mac": "AA:BB:CC:DD:EE:FF", "ip": "192.168.1.42", "wifi": "Intel AX201" }
  },
  "benchmark": {
    "tool":      "FurMark 2",
    "gpuScore":  5109,
    "fpsAvg":    43.5,
    "testWidth": 1920, "testHeight": 1080, "testPreset": "1080p",
    "duration": 300
  },
  "tests": [
    { "type": "speaker",     "result": "pass", "payload": { "songId": "...", "volume": 0.8, "channel": "both" } },
    { "type": "mic",         "result": "pass", "payload": { "level": 0.45, "duration": 5 } },
    { "type": "camera",      "result": "pass", "payload": { "resolution": "1920x1080" } },
    { "type": "keyboard",    "result": "pass", "payload": { "pressedCount": 86, "totalKeys": 86 } },
    { "type": "display",     "result": "pass", "payload": { "deadPixelCount": 0 } },
    { "type": "wifi",        "result": "pass", "payload": { "downloadMbps": 152, "uploadMbps": 95, "pingMs": 8 } }
  ],
  "signature": "a1b2c3..." // HMAC-SHA256(shared_secret, JSON.stringify(payloadNoSig))
}
```
**Response 201:**
```json
{
  "ok": true,
  "data": {
    "uploadId":   "uuid",
    "laptopId":   "uuid",
    "redirectUrl":"https://laplapcantho.store/test-laptop/ranking?highlight=laptop_id&rank=Good",
    "saved": {
      "specsUpdated":   true,
      "benchmarkId":    "uuid?",
      "testResultsSaved": 6
    }
  }
}
```

#### 5.2.4. Error codes
| Code | HTTP | Ý nghĩa |
|------|------|---------|
| `SESSION_NOT_FOUND` | 404 | sid không tồn tại |
| `SESSION_EXPIRED` | 410 | sid hết hạn |
| `SESSION_CONSUMED` | 409 | sid đã dùng (chỉ cho 1 lần nếu mark consumed) |
| `INVALID_SIGNATURE` | 401 | HMAC không khớp → nghi payload bị sửa |
| `PAYLOAD_TOO_LARGE` | 413 | > 256KB |
| `INVALID_VERSION` | 400 | payloadVersion không nằm trong whitelist |
| `RATE_LIMITED` | 429 | mỗi sid chỉ gọi /upload tối đa 5 lần / 5 phút |

---

## 6. Mini tool features

> Acceptance criteria cụ thể cho mỗi feature. Đánh P0/P1/P2 cho từng nhóm
> trong section Task list.

### 6.1. Hardware info checker (P0)
- Lấy đầy đủ CPU/RAM/SSD(s)/GPU(s)/Mainboard/Battery/SKU/SN/OS/Network.
- Hiển thị 4 cột card giống layout `/test-laptop/system-scan` hiện tại (đã thấy
  ở code).
- Refresh button → quét lại.
- Cho phép copy từng phần (CPU name, S/N, OS key) ra clipboard.
- Export ra JSON (1-click) → lưu local file → user tự gửi nếu muốn.

### 6.2. Benchmark runner (P0 — FurMark; P1 — UserBenchmark/CDM/AIDA64)
- **FurMark:**
  - Phase 1 (P0): chỉ phát hiện file `.exe` đã cài → hiển thị "Score:
    ___" → user nhập → bấm Upload. (Pattern y hệt `/test-laptop/benchmark`).
  - Phase 2 (P1): auto-launch + parse kết quả từ log file FurMark xuất ra
    (nếu version hỗ trợ `--log=`).
  - Phase 3 (P2): chạy Fullload CLI mode: `furmark.exe -fullscr=yes -width=1920
    -height=1080 -duration=300 -log_score=result.txt` → tự lấy điểm.
- **UserBenchmark / 3DMark / CDM / AIDA64:** P1–P2, launch .exe tương ứng, parse
  output (HTML/JSON/XML).
- Nút **"Upload kết quả lên bảng xếp hạng"** → build payload MiniToolUploadPayload
  → POST `/upload` → mở browser redirectUrl.

### 6.3. Optimization utilities (P1)
- 1 panel liệt kê các action, mỗi action có nút chạy + mô tả ngắn.
- Các hành động:
  - 🧹 Clean temp files (`%TEMP%`, `%LOCALAPPDATA%\Temp`, `C:\Windows\Temp`,
    user cũng chọn 1 số folder khác)
  - 🧹 Clean Prefetch (`C:\Windows\Prefetch`)
  - 🗑 Empty Recycle Bin
  - 🧹 Clean browser cache (Edge/Chrome: `AppData\Local\...` → chỉ xóa cache,
    không xóa cookie/login)
  - 🧹 Remove Windows.old (chỉ sau khi xác nhận version mới đang dùng)
  - ⚙ Disable startup items (qua registry `HKCU\Software\Microsoft\Windows\
    CurrentVersion\Run` + Task Manager startup folder)
  - 💾 Defragment (chỉ HDD — kiểm tra `MediaType=HDD` trước khi gọi)
  - 🔒 Disable BitLocker (`manage-bde -off C:` — cần admin, hiển thị cảnh báo)
  - ✏ Rename PC (`Rename-Computer -NewName ...`)
  - 🖼 Set wallpaper (chọn file → `SystemParametersInfo` SPIF_UPDATEINIFILE + SPIF_SENDCHANGE)
- Mỗi action chạy xong → log lại ở tool + toast.

### 6.4. Hardware tester (P0 — speaker/keyboard/display; P1 — phần còn lại)
- **Speaker (P0):** List 5–10 bài từ Supabase `speaker_songs` (dùng endpoint
  `/api/v1/speaker-songs` đã có) → phát → user bấm **"Nghe rõ" / "Có vấn đề"**.
  - Render player dùng `<audio>` tương tự trang hiện tại.
- **Mic (P1):** `navigator.mediaDevices.getUserMedia({ audio: true })` → show
  RMS meter realtime + cho phép ghi 5s → playback lại. Pass = user xác nhận.
- **Camera (P1):** same `getUserMedia({ video: true })` → preview + bấm
  "Capture & verify" → lưu ảnh local (optional upload).
- **Màn hình (P0):**
  - Dead pixel test: full-screen màu đơn (đỏ, xanh lá, xanh dương, trắng,
    đen) lần lượt → user click khi thấy pixel lạ.
  - Color/gradient test: hiển thị gradient strip → user tự đánh giá.
  - Brightness zones: 5 ô từ 0% → 100%.
- **Bàn phím (P0):** reuse logic từ `/test-laptop/keyboard` nhưng nằm trong
  tool, đếm phím đã bấm. Lưu `pressedCount/totalKeys`.
- **Touchpad (P1):** vẽ 1 ô → yêu cầu user vẽ theo (drag bằng touchpad) → đo
  coverage + smoothness.
- **Wi-Fi (P1):** ping gateway + speed test (đo 2 file 5MB từ server LapLap
  hoặc `cloudfront`) → Mbps up/down + latency.
- **Chuột (P2):** vẽ khu vực di chuột, đếm distance + click count.

---

## 7. URL protocol & signing

### 7.1. Deep URL fallback (khi API không khả dụng)
Tool có thể vẫn mở 1 URL deep-link để web nhận data khi user paste thủ công:
```
https://laplapcantho.store/api/v1/mini-tool/receive?sid=9f3a...&payload=<base64-json>&sig=<hmac>
```
- `payload`: `encodeURIComponent(base64(JSON.stringify(payloadNoSig)))`.
- `sig`: `hmac-sha256(shared_secret, payload)`.
- Web parse → verify signature → upsert Supabase → redirect đến
  `redirectAfterUpload`.

### 7.2. Shared secret & signature
- Secret: 1 chuỗi 32+ bytes ngẫu nhiên, admin generate qua script
  `node scripts/gen-mini-tool-secret.mjs` → lưu vào:
  - Web env: `MINI_TOOL_SHARED_SECRET`
  - Tool config: bundle vào `src/main/config.ts` (file này build-time thay thế,
    không commit)
- Signature algorithm: **HMAC-SHA256** (`HMAC-SHA256(secret, canonicalJSON)`).
- CanonicalJSON = `JSON.stringify(payloadNoSig, sortedKeys)`.

### 7.3. Token TTL
- `mini_tool_sessions.expires_at` = `now() + 2h`
- Tool poll `/session` mỗi 5s khi đang ở màn hình chờ; nếu hết hạn → báo
  user refresh session.

### 7.4. CSRF / replay protection
- Mỗi session chỉ accept tối đa 5 lần upload / 5 phút.
- Upload `consumed_at` set sau khi web xử lý thành công → cùng payload không
  lọt qua 2 lần.
- Tool gắn `nonce` random 16B trong mỗi payload → server lưu vào bảng
  `mini_tool_uploads`; nếu nonce đã thấy trong 24h → reject.

---

## 8. Security

| Mối đe dọa | Phòng chống |
|------------|-------------|
| **Replay attack** (kẻ tấn công copy URL có sid + payload gửi lại) | nonce + consumed_at + TTL 2h → bảng log check |
| **Tamper payload** qua deep-link | HMAC-SHA256 bắt buộc + server chỉ chấp nhận đúng secret |
| **Brute-force sid** | sid = `crypto.randomBytes(16)` hex → 128-bit entropy, không đoán được |
| **Leak shared secret** qua Git | secret không commit; build-time inject; rotate 1 lần / quarter |
| **Abuse rate** (spam upload) | Rate limit `/upload` (5 req / 5min / sid + 100 req / day / IP) |
| **Dangerous actions** (BitLocker off / rename PC / wallpaper) | Tool yêu cầu **elevated** (PowerShell `Start-Process -Verb RunAs`) + confirm dialog + note "KTV chịu trách nhiệm" |
| **Sensitive data leakage** (serial, Windows key) | Tool **không bao giờ** tự động upload field sensitive — chỉ upload khi user tick chọn; default = upload trừ BIOS serial nếu không tick |
| **Unsigned `.exe`** (SmartScreen) | Phase 1 chấp nhận cảnh báo như `furmark-benchmark.exe`; Phase 3 mua Code Signing cert (~$200/năm) |
| **Phishing UI** (giả tool LapLap) | Logo LapLap trên UI + about dialog hiển thị version + public key tool |

---

## 9. Milestones

> Phân theo 5 giai đoạn. Mỗi milestone = 1 PR reviewable.

### Phase 0 — Research & quyết định (1–2 ngày)
- ✅ Hoàn thành: `MINI_TOOL_PLAN.md` (file này)
- Spike: thử `systeminformation` + spawn PowerShell trên Electron → verify đủ
  fields.
- Quyết định: shared secret, brand assets cần dùng.

### Phase 1 — Scaffold (3–5 ngày)
- Tạo repo `laplap-mini-tool`, scaffold Vite + Electron + Tailwind + shadcn.
- Auto-update tự tay (Phase 1): build script sinh version string.
- Tích hợp biểu tượng LapLap, layout UI giống `/test-laptop/layout.tsx`.
- Đóng gói portable lần đầu (chưa đẹp).

### Phase 2 — MVP core (5–7 ngày)
- API endpoints mới ở §5.
- Migration `025_mini_tool.sql` ở §4.
- Tab **Hardware info** (full fields + JSON export).
- Tab **Benchmark** (FurMark 1 cách thủ công; UserBenchmark stub).
- Session flow end-to-end: Web sinh sid → tool paste → upload → ranking cập nhật.

### Phase 3 — Polish & utility (4–6 ngày)
- Tab **Optimize**: 7–10 action, mỗi action có mô tả + logging.
- Tab **Test hardware**: loa, mic, camera, màn hình, bàn phím.
- Auto-launch FurMark CLI (Phase 2 của §6.2) nếu file có flag `--result=`.
- Better UX: progress bars, logs panel mở rộng.

### Phase 4 — Test & release (3–5 ngày)
- Test trên máy thật (i5–11 / i7–13 / Ryzen 5; 8GB/16GB/32GB; HDD/SSD/NVMe).
- Test BitLocker / rename / wallpaper (có rollback).
- Đóng gói portable + viết README cho KTV.
- (Optional) Code Signing cert cho lần release tiếp.

**Tổng thời gian ước tính:** 16–25 ngày làm việc (1 dev full-time).

---

## 10. Task list (chi tiết + ưu tiên)

> Tổng **77 task**. Đánh dấu `[P0]` (làm trước), `[P1]`, `[P2]`. Trong nhóm,
> sắp theo thứ tự thực hiện.

### 10.1. Setup & kho tài liệu (6 task)
- [ ] **[P0]** Tạo repo `laplap-mini-tool` (git init, .gitignore, LICENSE)
- [ ] **[P0]** Khởi tạo Electron + Vite + React + TypeScript + Tailwind + shadcn
- [ ] **[P0]** Cấu hình `electron-builder` (`win: { target: portable }`)
- [ ] **[P1]** Copy component shadcn từ web LapLap (button, card, input, badge,
  dialog, tabs, tooltip, progress, separator, switch, label)
- [ ] **[P1]** Tạo logo LapLap cho tool (variant nhỏ) + favicon `.ico`
- [ ] **[P2]** README cho dev + cho KTV (hướng dẫn dùng + troubleshoot)

### 10.2. Web — schema & migration (7 task)
- [ ] **[P0]** Tạo `supabase/migrations/025_mini_tool.sql` (3 bảng mới + ALTER
  `laptop_specs` các trường bổ sung)
- [ ] **[P0]** Chạy migration trên dev Supabase project; verify RLS + indexes
- [ ] **[P0]** Tạo helper `src/lib/mini-tool/session.ts` (generate sid, validate TTL)
- [ ] **[P0]** Tạo helper `src/lib/mini-tool/signature.ts` (verify HMAC, nonce,
  rate limit)
- [ ] **[P1]** Hook `mini_tool_uploads` vào trang `/test-laptop/ranking` (hiển thị
  badge "uploaded via Mini Tool")
- [ ] **[P2]** Hook `hardware_test_results` vào trang `/test-laptop/submit` (cho
  KTV review)
- [ ] **[P2]** Thêm cron cleanup `mini_tool_sessions` + `mini_tool_uploads` đã
  hết hạn

### 10.3. Web — API endpoints (12 task)
- [ ] **[P0]** `POST /api/v1/mini-tool/sessions` (sinh sid 16B, lưu DB, set TTL 2h)
- [ ] **[P0]** `GET /api/v1/mini-tool/session?sid=X` (verify TTL + return context)
- [ ] **[P0]** `POST /api/v1/mini-tool/upload?sid=X` (verify HMAC, nonce check,
  upsert laptop + specs + benchmark + tests, return redirectUrl)
- [ ] **[P0]** Zod schema `mini-tool-upload` (validate payloadVersion + từng
  trường số)
- [ ] **[P0]** Rate limit (5 req/5min/sid + 100 req/day/IP) — dùng upstash / memory
  map (cho MVP)
- [ ] **[P0]** Test API bằng curl/Postman (happy path + mọi error code)
- [ ] **[P1]** `GET /api/v1/mini-tool/uploads/[laptopId]` (xem lịch sử)
- [ ] **[P1]** Nút "Mở mini tool" trên `/test-laptop` (header page) → POST
  sessions → show QR + URL
- [ ] **[P2]** Trang `/api/v1/mini-tool/receive?sid=X&payload=Y&sig=Z` (deep-link
  fallback) → POST đẩy data + redirect
- [ ] **[P2]** Audit log ai đã dùng Mini Tool (qua user_id nếu đăng nhập)
- [ ] **[P2]** Email admin khi có upload đầu tiên trong ngày (sanity check)
- [ ] **[P2]** Slack/Discord webhook thông báo kết quả benchmark mới

### 10.4. Tool — core & IPC (8 task)
- [ ] **[P0]** Electron main window (size mặc định 1200×800, không resize xuống
  < 900×600)
- [ ] **[P0]** `preload.ts` expose contextBridge: `lapLap.hardware`, `lapLap.bench`,
  `lapLap.upload`, `lapLap.dialog`, `lapLap.openUrl`
- [ ] **[P0]** IPC handler `lapLap.hardware.collect()` → trả về JSON đầy đủ
- [ ] **[P0]** IPC handler `lapLap.bench.furmark.detect()` → tìm furmark.exe
  (PATH + registry + user-chosen path)
- [ ] **[P1]** IPC handler `lapLap.optimize.cleanTemp()`, `disableStartup()`,
  `renameComputer(name)`, `setWallpaper(file)`, `disableBitlocker()`
- [ ] **[P1]** IPC handler `lapLap.powerShell.exec(script, args, timeout)` (giới
  hạn 30s, sandbox argument)
- [ ] **[P2]** electron-store wrapper (lưu session gần nhất, settings UI)
- [ ] **[P2]** Splash screen + auto-update notification khi rebuild version mới

### 10.5. Tool — Hardware info tab (6 task)
- [ ] **[P0]** UI grid card CPU/RAM/Storage(s)/GPU(s)/Mainboard/Battery/OS/Network
  (mirror layout trang `/test-laptop/system-scan`)
- [ ] **[P0]** `systeminformation` wrapper (CPU/RAM/Storage/Network/BIOS/Mainboard
  + extra qua PowerShell cho battery cycles, SMART %)
- [ ] **[P0]** Nút **Refresh** + **Export JSON** + **Copy CPU name**
- [ ] **[P1]** Render SMART (CDI / WMI / smartctl priority) y hệt web
- [ ] **[P1]** Detect removable drive (USB) + display letter + free/total
- [ ] **[P2]** So sánh trước/sau (diff 2 lần scan) để KTV demo thay đổi

### 10.6. Tool — Benchmark tab (8 task)
- [ ] **[P0]** Card FurMark: có preset 1080p / 1440p / 4K; hiển thị timer 5 phút
- [ ] **[P0]** Nút **"Run FurMark"** → spawn .exe (auto-elevate) + bật polling log
- [ ] **[P0]** Auto-parse score từ log file (nếu phiên bản FurMark có ghi log);
  fallback: ô nhập tay
- [ ] **[P0]** Upload button → build payload + ký + POST → mở browser redirectUrl
- [ ] **[P1]** Card UserBenchmark launcher (manual score entry)
- [ ] **[P1]** Card CrystalDiskInfo launcher (parse kết quả `DiskInfo64.exe
  /copyexit` text output)
- [ ] **[P2]** Card 3DMark / AIDA64 (chỉ launcher, manual score)
- [ ] **[P2]** Lưu lịch sử benchmark local (electron-store); cho xuất CSV

### 10.7. Tool — Optimize tab (8 task)
- [ ] **[P1]** Action: Clean temp files (Temp + Prefetch + Recycle Bin) với confirm
- [ ] **[P1]** Action: Clean browser cache (Edge + Chrome — không xóa login)
- [ ] **[P1]** Action: Disable startup items (list checkbox trước khi disable)
- [ ] **[P1]** Action: Defragment (chỉ HDD) — kiểm tra drive type trước
- [ ] **[P1]** Action: Disable BitLocker — cảnh báo rõ "cần admin + nguy cơ mất
  data"
- [ ] **[P1]** Action: Rename PC (dialog nhập tên + restart)
- [ ] **[P1]** Action: Set wallpaper (file picker + preview)
- [ ] **[P2]** Action: Remove Windows.old (xác nhận thêm 1 lần)

### 10.8. Tool — Test HW tab (10 task)
- [ ] **[P0]** Test Speaker: kết nối `/api/v1/speaker-songs`, list bài, play,
  pass/fail
- [ ] **[P0]** Test Display: dead-pixel (5 màu) + gradient + brightness zones
- [ ] **[P0]** Test Keyboard: replicate `/test-laptop/keyboard/page.tsx` → đếm
  phím pressed/total
- [ ] **[P1]** Test Mic: getUserMedia → RMS meter + 5s record + playback
- [ ] **[P1]** Test Camera: getUserMedia → preview + capture (lưu local)
- [ ] **[P1]** Test Touchpad: drag-coverage test (vẽ rectangle, đo % vùng đã
  stroke)
- [ ] **[P1]** Test Wi-Fi: ping gateway + speed test (download 2 file 5MB từ
  `laplapcantho.store/static/speedtest/`)
- [ ] **[P1]** Session: gom tất cả test result → embed vào payload upload
- [ ] **[P2]** Test Mouse: di chuột, click counter
- [ ] **[P2]** Test fingerprint reader, SD card reader (advanced)

### 10.9. Tool — session & upload (6 task)
- [ ] **[P0]** Màn hình đầu tiên "Kết nối với web" → paste URL hoặc sid → verify
- [ ] **[P0]** Auto-detect sid trong clipboard (regex `sid=([a-f0-9]{32})`) khi mở
  app
- [ ] **[P0]** Button **"Đẩy kết quả lên web"** → POST `/upload` → toast success +
  nút "Mở trang ranking"
- [ ] **[P1]** Hiển thị countdown TTL session + nút "Refresh session"
- [ ] **[P2]** Auto-attempt POST → nếu fail → fallback mở deep-link URL (method §7.1)
- [ ] **[P2]** Settings page đổi shared secret (cũ → mới; rebuild tool khi đổi)

### 10.10. Tool — build & release (6 task)
- [ ] **[P0]** Script `npm run build:portable` → sinh `LapLap-Mini-Tool-Portable.exe`
  vào `dist/`
- [ ] **[P0]** Bundle sample assets (logo, sample wallpaper) trong app
- [ ] **[P1]** Auto-versioning từ git tag (`v0.1.0` → build v0.1.0)
- [ ] **[P1]** About dialog hiển thị version + build sha + secret key fingerprint
- [ ] **[P2]** Code signing (khi có cert) — `signtool sign /fd sha256 /tr ...`
- [ ] **[P2]** Auto-update qua file `version.json` trên web (check khi mở tool)

### 10.11. Q&A & cross-team (3 task)
- [ ] **[P0]** Họp nội bộ: confirm UI/UX giống web (tham khảo design system LapLap
  có sẵn)
- [ ] **[P1]** Viết SOP cho KTV (1 trang A4): copy USB → click → quét → upload
- [ ] **[P2]** Feedback collection form (trong tool → mở web `/feedback`)

---

## 11. Risks & mitigations

| # | Rủi ro | Mức | Mitigation |
|---|--------|-----|-----------|
| 1 | `systeminformation` đọc thiếu trên 1 số máy (đặc biệt laptop OEM) | Trung bình | Luôn có fallback PowerShell `Get-WmiObject` / `Get-CimInstance` (đã có ở `/test-laptop/system-scan`) |
| 2 | User chạy FurMark bản portable không có flag `--log=` | Thấp | Manual score entry là P0 (đủ MVP); auto-parse là P2 |
| 3 | SmartScreen chặn `.exe` unsigned | Trung bình | UI hướng dẫn rõ "More info → Run anyway"; Phase 4 mua Code Signing cert |
| 4 | PowerShell execution policy block script | Thấp | Tool spawn PowerShell với `-ExecutionPolicy Bypass` (cũng đã làm ở `system-scan/page.tsx`) |
| 5 | Shared secret lộ qua Git | Cao | `.env` cho web + build-time inject cho tool; CI fail nếu thấy secret trong source |
| 6 | Session replay attack | Trung bình | nonce + consumed_at + rate limit (đã trình bày ở §8) |
| 7 | User xoá nhầm data khi dùng Optimize | Trung bình | Mỗi action có confirm dialog + show files sẽ xoá trước khi xoá |
| 8 | BitLocker disable trên máy công ty | Cao | Đây là P1 nhưng phải có warning đỏ + 2-step confirm + yêu cầu elevated |
| 9 | Khác biệt Windows 10 vs 11 (một số WMI class) | Thấp | `systeminformation` abstraction đã handle; PowerShell fallback dùng `-ErrorAction SilentlyContinue` |
| 10 | Tool chạy trên máy ảo (không có GPU thật) | Thấp | Benchmark tab sẽ detect GPU là virtual (VMware Tools / Hyper-V) → tự skip + warning |
| 11 | RAM > 64GB gây lỗi chia cho 1024 | Thấp | `systeminformation.os.totalmem` đã return BigInt; chuyển đổi an toàn sang GB bằng Math.log2 |
| 12 | Web nhận payload quá lớn (>256KB do logs PowerShell) | Trung bình | Drop trường `rawConsoleLog` + chỉ giữ stats tóm tắt; enforce 256KB limit ở server |
| 13 | User bật tool trên USB bị virus scanner xóa | Trung bình | Distribute qua USB có hướng dẫn "Add exclusion"; release signed (nếu có cert) |
| 14 | User song ngữ (Anh/Việt) | Thấp | Tool UI dùng i18n đơn giản (next-intl / react-intl); Phase 1 chỉ Việt |

---

## 12. Open questions (cần user trả lời trước khi code)

1. **Shared secret** — generate khi nào? Ai giữ? Có cần rotate mỗi release?
2. **Code Signing cert** — đã có / chưa? budget bao nhiêu?
3. **Tool UI ngôn ngữ** — chỉ Việt hay song ngữ Anh–Việt?
4. **Logo & brand** — dùng logo web hiện tại hay cần redesign variant cho tool?
5. **Phạm vi Phase 1** — chỉ FurMark + Hardware info, hay cần Optimize/Test HW
   cùng phase?
6. **Scope test hardware** — Phase 1 có cần camera/mic hay P1 sau?
7. **Có cần KTV mode vs Customer mode?** (KTV = full opt; Customer = chỉ test info)
8. **Có muốn deep-link fallback** (§7.1) song song với API, hay chỉ cần API?

---

## 13. Phụ lục: file diff & code skeleton (gợi ý)

### 13.1. `src/app/api/v1/mini-tool/sessions/route.ts` (skeleton)

```typescript
import { NextRequest } from "next/server";
import { z } from "zod";
import { randomBytes } from "crypto";
import { ok, fail } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

const Body = z.object({
  redirectAfterUpload: z.string().startsWith("/").optional(),
  context: z.record(z.unknown()).optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return fail("INVALID_BODY", "Invalid body", 400);

  const sid = randomBytes(16).toString("hex"); // 32 chars
  const ttlSec = 2 * 60 * 60;
  const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString();

  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from("mini_tool_sessions").insert({
    session_id: sid,
    context: parsed.data.context ?? {},
    expires_at: expiresAt,
  });
  if (error) return fail("DB_ERROR", error.message, 500);

  return ok({
    sessionId:  sid,
    uploadUrl:  `/api/v1/mini-tool/upload?sid=${sid}`,
    webUrl:     `/api/v1/mini-tool/receive?sid=${sid}`,
    verifyUrl:  `/api/v1/mini-tool/session?sid=${sid}`,
    expiresAt,
    ttlSeconds: ttlSec,
  });
}
```

### 13.2. `src/main/upload.ts` (skeleton)

```typescript
import crypto from "crypto";
import { shell } from "electron";

export async function uploadToWeb(opts: {
  sid: string;
  payload: unknown;
  sharedSecret: string;
}): Promise<{ ok: boolean; redirectUrl?: string; error?: string }> {
  const canonical = JSON.stringify(opts.payload, Object.keys(opts.payload as object).sort());
  const sig = crypto
    .createHmac("sha256", opts.sharedSecret)
    .update(canonical)
    .digest("hex");

  const res = await fetch(
    `${process.env.WEB_BASE_URL}/api/v1/mini-tool/upload?sid=${opts.sid}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...opts.payload, signature: sig }),
    },
  );

  const json = await res.json();
  if (!res.ok || !json.ok) return { ok: false, error: json.error?.message };

  // tự mở browser
  if (json.data.redirectUrl) shell.openExternal(json.data.redirectUrl);
  return { ok: true, redirectUrl: json.data.redirectUrl };
}
```

---

> **Kết thúc tài liệu.** Sau khi user review và trả lời các câu hỏi ở §12,
> bắt đầu triển khai Phase 1 (Scaffold).
