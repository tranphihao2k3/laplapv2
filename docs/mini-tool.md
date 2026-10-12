# LapLap Mini Tool

> All-in-one portable PowerShell tool — quét phần cứng + benchmark FurMark + auto-upload lên bảng xếp hạng.

## Mục đích

Thay vì 3 bước thủ công (scan → benchmark → nhập tay vào web), Mini Tool gộp thành 1 lần double-click:

1. Tự detect phần cứng (CPU, GPU, RAM, SSD, pin, màn hình) qua WMI
2. Tự phát hiện/cài FurMark 2 nếu chưa có
3. Chạy FurMark preset 1080p đúng 5 phút
4. Ký HMAC-SHA256 payload + POST `/api/v1/mini-tool/upload`
5. Auto mở browser tới `/test-laptop?highlight=<laptop_id>` — dòng mới trên leaderboard

## Trạng thái hiện tại (Oct 2026)

| Artifact | Status | Cách dùng |
|---|---|---|
| `public/scripts/laplap-mini-tool.ps1` | ✅ Sẵn sàng | `powershell -ExecutionPolicy Bypass -File laplap-mini-tool.ps1 -ApiBase "..."` |
| `public/scripts/laplap-mini-tool.bat` | ✅ Sẵn sàng | Double-click → gọi .ps1 với ExecutionPolicy Bypass |
| `public/scripts/laplap-mini-tool.exe` | ❌ Chưa build | Cần Windows + chạy `scripts/build-mini-tool.ps1` |
| `scripts/build-mini-tool.ps1` | ✅ Sẵn sàng | Build .ps1 → .exe với PS2EXE (tự động cài module nếu thiếu) |
| `scripts/test-mini-tool-canonical.mjs` | ✅ Sẵn sàng | Verify HMAC canonical JSON giữa Node/TS và PowerShell |

**Lưu ý quan trọng**: vì chưa có .exe, nút "Tải Mini Tool" trên `/test-laptop` hiện đang link tới file `.ps1`. Người dùng cuối có thể chạy thẳng `.ps1` (cần Windows + PowerShell 5.1+) hoặc dùng luôn **Quick Score form** trên trang chủ `/test-laptop` (nhập điểm + submit, không cần cài gì).

## Prerequisites

| Yêu cầu | Ghi chú |
|---|---|
| Windows 10/11 | Không hỗ trợ macOS/Linux (WMI là Windows-only) |
| PowerShell 5.1+ | Đã có sẵn trên Win 10/11 |
| .NET Framework 4.5+ | Đã có sẵn (cần cho HMAC SHA256) |
| Quyền Administrator | Một số lệnh WMI cần admin để đọc SMART chi tiết |
| Kết nối Internet | Để POST lên server LapLap |
| FurMark 2 | Tự động tải về nếu chưa cài (Inno Setup silent) |

## Cách dùng

### Cho KTV / khách mua máy (3 cách)

**Cách 1 — Quick Score form (NHANH NHẤT, không cần cài gì)**

1. Vào [https://laplapcantho.store/test-laptop](https://laplapcantho.store/test-laptop)
2. Cuộn xuống section "Đã có điểm FurMark? Submit nhanh"
3. Nhập: Tên thiết bị, Điểm GPU, (tùy chọn) Tên GPU, FPS
4. Bấm "Lên bảng xếp hạng"
5. Trang tự redirect về `/test-laptop?highlight=<laptop_id>` — dòng mới vàng

**Cách 2 — Form 4 bước (đầy đủ thông số máy)**

1. Vào `/test-laptop/benchmark`
2. Bước 1: Tải FurMark 2 (link Geeks3D)
3. Bước 2: Chạy FurMark 5 phút
4. Bước 3: Nhập điểm
5. Bước 4: Nhập thông số máy (CPU, RAM, SSD, GPU, pin)
6. Bấm "Lưu lên bảng xếp hạng"

**Cách 3 — Mini Tool .ps1 (one-click, cho KTV chuyên nghiệp)**

```powershell
# Download tu trang /test-laptop, hoac clone repo
powershell -NoProfile -ExecutionPolicy Bypass `
  -File .\laplap-mini-tool.ps1 `
  -ApiBase "https://laplapcantho.store" `
  -DurationMin 5 `
  -Preset "1080"
```

Các tham số khả dụng:
- `-ApiBase` (mặc định `http://localhost:3000`)
- `-SessionId` (mặc định = tự tạo mới)
- `-DurationMin` (mặc định `5`)
- `-Preset` (`1080` | `1440` | `2160`, mặc định `1080`)
- `-SharedSecret` (mặc định dùng dev fallback — phải set env trên production)
- `-AutoUpload:$false` (chỉ in payload ra stdout, không POST)
- `-FurMarkPath` (mặc định = tự detect)

## SmartScreen Bypass

File `.exe` được build bằng PS2EXE nên **chưa có Code Signing certificate**. Windows SmartScreen sẽ hiện cảnh báo "Windows protected your PC — Unknown publisher" lần đầu chạy.

**Cách bỏ qua** (giống mọi tool PS2EXE chưa ký):

```
┌────────────────────────────────────────────┐
│  Windows protected your PC                 │
│                                            │
│  Microsoft Defender SmartScreen prevented  │
│  an unrecognized app from starting.        │
│                                            │
│  [Don't run]              [Run anyway] ←─  │
│  ─────────                 ──────────────  │
│                  click "More info" first    │
└────────────────────────────────────────────┘
```

1. Bấm **"More info"** (chữ nhỏ dưới "Microsoft Defender SmartScreen")
2. Nút **"Run anyway"** xuất hiện → bấm vào
3. Tool chạy bình thường

> Nếu muốn verify source trước khi chạy: mở file `.ps1` bằng Notepad/VSCode và đọc — không có gì độc hại, chỉ gọi `Invoke-RestMethod` tới `laplapcantho.store` và `Start-Process furmark.exe`.

## Troubleshooting

### "Score = 0" hoặc FurMark không tự thoát

**Nguyên nhân**: FurMark 2 đôi khi không ghi score vào file log (do version mới đổi flag CLI).

**Fix**:
- Tool sẽ tự hỏi bạn nhập score thủ công khi parse thất bại
- Ghi số **Score** hiển thị trên màn hình FurMark lúc kết thúc

### "Upload thất bại" — lỗi kết nối

**Nguyên nhân phổ biến**:
1. **Mạng nội bộ chặn** laplapcantho.store → mở https://laplapcantho.store/test-laptop trên trình duyệt để test
2. **Proxy / firewall công ty** cần whitelist
3. **Session hết hạn** (2h) → chạy lại tool để tạo session mới

### Tool báo "FurMark không tìm thấy"

**Fix**:
- Tải thủ công từ https://geeks3d.com/furmark/ → cài vào `C:\Program Files\Geeks3D\FurMark2_x64\`
- Hoặc để tool tự tải (cần admin + internet)

### Payload gửi lên bị server từ chối "INVALID_SIGNATURE"

**Nguyên nhân**: Shared secret trong tool không khớp với server (chỉ xảy ra nếu bạn đã set `MINI_TOOL_SHARED_SECRET` trên Fly.io nhưng chưa rebuild tool).

**Fix**:
- Dev: dùng secret mặc định `laplap-mini-tool-dev-secret-DO-NOT-USE-IN-PROD` (tool và server cùng dùng)
- Production: cập nhật cả env server + rebuild tool cùng lúc

## Build .exe từ .ps1 (cho maintainer trên Windows)

```powershell
# Tu project root:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\build-mini-tool.ps1
```

Script sẽ tự động:
1. Kiểm tra / cài module `ps2exe` (CurrentUser scope)
2. Verify input file `public\scripts\laplap-mini-tool.ps1`
3. Compile → `public\scripts\laplap-mini-tool.exe` (RequireAdmin, ~2 MB)
4. In SHA-256 để cập nhật `src/lib/tools/catalog.ts`

Sau khi build xong, update `src/lib/tools/catalog.ts`:
```ts
{
  id: "laplap-mini-tool",
  ...
  sizeBytes: <actual>,
  sha256: "<from build>",   // replace PENDING_BUILD
  ...
}
```

Commit + push file `.exe` lên Git (hoặc R2/S3), rồi redeploy.

## Roadmap (Electron v2 — tương lai)

Khi có thêm thời gian, sẽ build bản Electron đầy đủ theo `MINI_TOOL_PLAN.md`:
- Tab Optimize (clean temp, defrag, rename PC, wallpaper)
- Tab Test HW (speaker, mic, camera, keyboard, touchpad, Wi-Fi)
- Auto-update qua version.json
- Code Signing certificate (~$200/năm)

Mini Tool v1 (PS2EXE) này đủ cho 80% use case: scan + benchmark + upload lên bảng xếp hạng.

## Hỗ trợ

- Zalo: 0909-xxx-xxx
- Fanpage: [facebook.com/laplapcantho](https://facebook.com/laplapcantho)
- GitHub issue: nội bộ LapLap
