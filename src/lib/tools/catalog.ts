/**
 * Tool Catalog — danh sách các công cụ portable có thể tải về sau khi scan.
 *
 * Mỗi tool có 2 URL chính:
 * - `cdnUrl`: URL gốc từ nhà cung cấp (dùng làm nguồn chính, không cần upload lên R2)
 * - `r2Url` (optional): URL trên R2 của LapLap (nếu admin đã upload lên R2 thì dùng)
 *
 * Khi client tải tool:
 * - Server API /tools/download sẽ proxy: thử R2 trước, fallback CDN.
 * - Client KHÔNG gọi trực tiếp URL gốc → tránh rủi ro redirect/cookie/CORS.
 *
 * Trường `exec` chỉ định file exe chính để launch sau khi extract.
 * Trường `extract` cho biết có phải ZIP (true) hay EXE trực tiếp (false).
 */

export interface ToolEntry {
  id: string;
  name: string;
  description: string;
  category: "diagnostic" | "stress" | "benchmark";
  /** Dung lượng xấp xỉ (bytes). Chỉ để hiển thị UI. */
  sizeBytes: number;
  /** SHA256 của file gốc để verify sau khi tải. */
  sha256: string;
  /** URL gốc từ nhà cung cấp (primary). */
  cdnUrl: string;
  /** URL R2 của LapLap (fallback nếu admin đã upload). */
  r2Url: string | null;
  /** Là ZIP cần extract hay EXE chạy trực tiếp? */
  extract: boolean;
  /** Tên file exe chính sau khi extract (hoặc chính file tải về nếu không zip). */
  exec: string;
  /** Args mặc định khi launch (optional). */
  launchArgs?: string[];
  /** Có cần quyền admin không? */
  requiresAdmin: boolean;
  /** Icon emoji cho UI. */
  icon: string;
}

export const TOOL_CATALOG: ToolEntry[] = [
  {
    id: "cpu-z",
    name: "CPU-Z",
    description: "Chi tiết CPU, mainboard, RAM, cache, SPD. Portable, không cần cài.",
    category: "diagnostic",
    sizeBytes: 6 * 1024 * 1024,
    sha256: "320e073a6f387464ac3faac5f010b5fe70e31fab30745883d023c8372e80f3c5",
    cdnUrl: "https://download.cpuid.com/cpu-z/cpu-z_2.20.2-en.zip",
    r2Url: null,
    extract: true,
    exec: "cpuz_x64.exe",
    launchArgs: [],
    requiresAdmin: false,
    icon: "🔧",
  },
  {
    id: "gpu-z",
    name: "GPU-Z",
    description: "Chi tiết GPU NVIDIA/AMD/Intel: clock, sensor, BIOS, validation.",
    category: "diagnostic",
    sizeBytes: 11 * 1024 * 1024,
    sha256: "VERIFY_REQUIRED",
    cdnUrl: "https://download.gpu-z.com/GPU-Z.2.70.0.zip",
    r2Url: null,
    extract: true,
    exec: "GPU-Z.2.70.0.exe",
    launchArgs: [],
    requiresAdmin: false,
    icon: "🎮",
  },
  {
    id: "furmark",
    name: "FurMark",
    description: "GPU stress test và benchmark OpenGL/Vulkan. Đốt nóng GPU để test.",
    category: "stress",
    sizeBytes: 15 * 1024 * 1024,
    sha256: "27ab2e723e2e65df720bcafea681d2104744eda4a1e0a0374d7e61eaa820e63b",
    cdnUrl: "https://geeks3d.com/dl/show/830",
    r2Url: null,
    extract: true,
    exec: "FurMark.exe",
    launchArgs: ["/run_mode=1"],
    requiresAdmin: false,
    icon: "🔥",
  },
  {
    id: "hwinfo",
    name: "HWiNFO",
    description: "Sensor toàn hệ thống: CPU/GPU temp, fan, voltage, power. Realtime.",
    category: "diagnostic",
    sizeBytes: 18 * 1024 * 1024,
    sha256: "VERIFY_REQUIRED",
    cdnUrl: "https://download.hwinfo.com/hwi_834.zip",
    r2Url: null,
    extract: true,
    exec: "HWiNFO64.exe",
    launchArgs: ["-minimized"],
    requiresAdmin: false,
    icon: "📊",
  },
  {
    id: "crystaldiskmark",
    name: "CrystalDiskMark",
    description: "Benchmark SSD/HDD: read/write speed tuần tự & random. Open-source.",
    category: "benchmark",
    sizeBytes: 3 * 1024 * 1024,
    sha256: "386f1d2f05a2f8c0a1a0b7d8deda63b8fd594ad9e90a2c4e75812348398dfa53",
    cdnUrl: "https://downloads.sourceforge.net/project/crystaldiskmark/9.0.3/CrystalDiskMark9_0_3.zip",
    r2Url: null,
    extract: true,
    exec: "DiskMark64A.exe",
    launchArgs: [],
    requiresAdmin: true,
    icon: "⚡",
  },
  {
    id: "hdsentinel",
    name: "Hard Disk Sentinel",
    description: "Đọc SMART chi tiết + nhiệt độ + health score. Trial 30 ngày.",
    category: "diagnostic",
    sizeBytes: 50 * 1024 * 1024,
    sha256: "VERIFY_REQUIRED",
    cdnUrl: "https://www.hdsentinel.com/hdsentinel_pro_portable.zip",
    r2Url: null,
    extract: true,
    exec: "HDSentinel.exe",
    launchArgs: [],
    requiresAdmin: false,
    icon: "💾",
  },
];

/**
 * Verify-Sha256 mode:
 * - "strict": SHA256 bat buoc khop. Neu k co trong catalog, server tu dong
 *   compute va luu vao hash cache file (persistent).
 * - "warn": Verify neu co, chi canh bao neu sai.
 * - "skip": Bo qua verify hoan toan (khong khuyen khich).
 *
 * Mac dinh: "strict". User co the override qua env LAPLAP_VERIFY_MODE.
 *
 * Luu y: voi nhung tool co sha256="VERIFY_REQUIRED" (chua biet hash goc),
 * che do strict se:
 *   1. Download file lan dau.
 *   2. Compute SHA256 thuc te.
 *   3. Compare voi hash trong catalog (se fail vi la placeholder).
 *   4. Retry download 1 lan (CDN co the tra file cu/cache).
 *   5. Neu van fail -> cho phep install nhung warning UI "unverified".
 * Day la trade-off MVP: khong block user, nhung bao ro cho user biet.
 */
export type VerifyMode = "strict" | "warn" | "skip";

/** Tìm tool theo id. */
export function findTool(id: string): ToolEntry | undefined {
  return TOOL_CATALOG.find((t) => t.id === id);
}

/** Format bytes → "15 MB" cho UI. */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}