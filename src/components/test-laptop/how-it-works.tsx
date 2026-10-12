/**
 * HowItWorks — 4 bước ngang (vertical trên mobile).
 * Step 1: Tải Mini Tool → 2: Chạy benchmark → 3: Auto-upload → 4: Lên bảng xếp hạng
 */
import { Download, Flame, UploadCloud, Trophy } from "lucide-react";

const STEPS = [
  {
    n: 1,
    icon: Download,
    title: "Tải Mini Tool",
    body: "1 file .exe (~2 MB). Double-click chạy — không cần cài đặt, copy ra USB cũng được.",
  },
  {
    n: 2,
    icon: Flame,
    title: "Chạy benchmark",
    body: "Tự động quét CPU/RAM/SSD/GPU/pin (~30s) rồi chạy FurMark preset 1080p đúng 5 phút.",
  },
  {
    n: 3,
    icon: UploadCloud,
    title: "Auto-upload",
    body: "Tool ký HMAC-SHA256 và đẩy payload + điểm lên /api/v1/mini-tool/upload ngay khi xong.",
  },
  {
    n: 4,
    icon: Trophy,
    title: "Lên bảng xếp hạng",
    body: "Trình duyệt tự mở /test-laptop?highlight=<laptop_id> — bạn thấy dòng mới trên leaderboard.",
  },
];

export function HowItWorks() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-zinc-900 sm:text-lg">Cách hoạt động</h2>
        <span className="text-xs text-muted-foreground">4 bước · ~6 phút</span>
      </div>

      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li
              key={s.n}
              className="relative rounded-xl border border-zinc-200 bg-zinc-50/50 p-4"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs font-bold text-white">
                  {s.n}
                </span>
                <Icon className="h-4 w-4 text-zinc-500" />
              </div>
              <h3 className="text-sm font-semibold text-zinc-900">{s.title}</h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
