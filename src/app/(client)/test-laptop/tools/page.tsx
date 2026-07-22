"use client";

import { Badge } from "@/components/ui/badge";
import {
  Download,
  ExternalLink,
  ShieldCheck,
  Info,
  Gauge,
  FlameKindling,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Tool = {
  name: string;
  category: string;
  description: string;
  url: string;
  logo: string;
};

// Gom 12 công cụ thành 4 nhóm lớn có nghĩa, tránh mỗi công cụ một mục rời rạc.
type Group = {
  id: string;
  title: string;
  subtitle: string;
  Icon: LucideIcon;
  accent: string; // text color
  chip: string; // badge + icon ring bg
  tools: Tool[];
};

const GROUPS: Group[] = [
  {
    id: "info",
    title: "Thông tin phần cứng",
    subtitle: "Xem cấu hình chi tiết CPU, GPU, RAM, pin",
    Icon: Info,
    accent: "text-sky-600",
    chip: "bg-sky-50 text-sky-700 ring-sky-100",
    tools: [
      {
        name: "HWiNFO64",
        category: "System Info",
        description:
          "Phần mềm kiểm tra phần cứng chi tiết nhất, theo dõi nhiệt độ, điện áp, tốc độ quạt realtime",
        url: "https://www.hwinfo.com/download/",
        logo: "🔧",
      },
      {
        name: "CPU-Z",
        category: "CPU Info",
        description: "Thông tin chi tiết về CPU, mainboard, RAM, tốc độ bus, điện áp",
        url: "https://www.cpuid.com/softwares/cpu-z.html",
        logo: "🖥️",
      },
      {
        name: "GPU-Z",
        category: "GPU Info",
        description: "Kiểm tra card đồ họa (GPU), VRAM, driver, tốc độ clock, nhiệt độ GPU",
        url: "https://www.techpowerup.com/gpuz/",
        logo: "🎮",
      },
      {
        name: "BatteryInfoView",
        category: "Battery Info",
        description:
          "Xem thông tin pin laptop chi tiết: dung lượng, chu kỳ sạc, tình trạng chai pin",
        url: "https://www.nirsoft.net/utils/battery_information_view.html",
        logo: "🔋",
      },
    ],
  },
  {
    id: "storage",
    title: "Ổ cứng & bộ nhớ",
    subtitle: "Kiểm tra sức khỏe, tốc độ ổ cứng và lỗi RAM",
    Icon: Gauge,
    accent: "text-teal-600",
    chip: "bg-teal-50 text-teal-700 ring-teal-100",
    tools: [
      {
        name: "CrystalDiskInfo",
        category: "Storage Health",
        description: "Kiểm tra sức khỏe ổ cứng/SSD, S.M.A.R.T status, nhiệt độ, tuổi thọ",
        url: "https://crystalmark.info/en/software/crystaldiskinfo/",
        logo: "💾",
      },
      {
        name: "CrystalDiskMark",
        category: "Storage Benchmark",
        description: "Đo tốc độ đọc/ghi ổ cứng (SSD/HDD), kiểm tra hiệu năng thực tế",
        url: "https://crystalmark.info/en/software/crystaldiskmark/",
        logo: "⚡",
      },
      {
        name: "MemTest86",
        category: "RAM Test",
        description: "Kiểm tra lỗi RAM (memory errors), chạy độc lập không cần OS",
        url: "https://www.memtest86.com/download.htm",
        logo: "🧠",
      },
    ],
  },
  {
    id: "benchmark",
    title: "Benchmark hiệu năng",
    subtitle: "Chấm điểm CPU, GPU và khả năng chơi game",
    Icon: Gauge,
    accent: "text-indigo-600",
    chip: "bg-indigo-50 text-indigo-700 ring-indigo-100",
    tools: [
      {
        name: "AIDA64",
        category: "System Benchmark",
        description: "Kiểm tra toàn diện hệ thống, stress test, benchmark CPU/RAM/GPU",
        url: "https://www.aida64.com/downloads",
        logo: "📊",
      },
      {
        name: "3DMark",
        category: "Gaming Benchmark",
        description: "Benchmark gaming phổ biến nhất, kiểm tra hiệu năng đồ họa 3D",
        url: "https://www.3dmark.com/",
        logo: "🎯",
      },
      {
        name: "Cinebench",
        category: "CPU Benchmark",
        description: "Benchmark CPU rendering, đánh giá hiệu năng đa nhân và đơn nhân",
        url: "https://www.maxon.net/en/cinebench",
        logo: "🎬",
      },
    ],
  },
  {
    id: "stress",
    title: "Stress test độ ổn định",
    subtitle: "Ép tải tối đa để kiểm tra nhiệt độ và độ bền",
    Icon: FlameKindling,
    accent: "text-orange-600",
    chip: "bg-orange-50 text-orange-700 ring-orange-100",
    tools: [
      {
        name: "Prime95",
        category: "CPU Stress Test",
        description: "Stress test CPU cực mạnh để kiểm tra độ ổn định và nhiệt độ dưới tải cao",
        url: "https://www.mersenne.org/download/",
        logo: "🔥",
      },
      {
        name: "FurMark",
        category: "GPU Stress Test",
        description: "Stress test GPU (card đồ họa), kiểm tra nhiệt độ và ổn định dưới tải cực cao",
        url: "https://geeks3d.com/furmark/",
        logo: "🦊",
      },
    ],
  },
];

const TOTAL = GROUPS.reduce((n, g) => n + g.tools.length, 0);

function ToolCard({ tool, chip }: { tool: Tool; chip: string }) {
  return (
    <a
      href={tool.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm",
        "transition-all duration-300 ease-out hover:-translate-y-1 hover:border-zinc-300 hover:shadow-[0_16px_40px_rgba(0,0,0,0.10)]",
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-0.5 origin-left scale-x-0 bg-zinc-900 transition-transform duration-300 group-hover:scale-x-100" />

      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl ring-1 transition-transform duration-300 group-hover:scale-110",
            chip,
          )}
        >
          {tool.logo}
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-zinc-900">{tool.name}</h3>
          <Badge variant="secondary" className={cn("mt-1 border-0 text-[10px] font-medium", chip)}>
            {tool.category}
          </Badge>
        </div>
        <ExternalLink className="h-4 w-4 shrink-0 text-zinc-300 transition-colors group-hover:text-zinc-500" />
      </div>

      <p className="mt-3 line-clamp-3 flex-1 text-xs leading-relaxed text-zinc-500">
        {tool.description}
      </p>

      <div className="mt-4 flex items-center justify-between border-t border-zinc-100 pt-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-700 transition-colors group-hover:text-zinc-900">
          <Download className="h-4 w-4 transition-transform duration-300 group-hover:-translate-y-0.5" />
          Tải về
        </span>
        <span className="text-xs text-zinc-400 transition-transform duration-300 group-hover:translate-x-0.5">
          →
        </span>
      </div>
    </a>
  );
}

export default function ToolsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* Hero header */}
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <span className="inline-block h-1 w-6 rounded-full bg-zinc-900" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-zinc-400">
              Công cụ kiểm tra · {TOTAL} phần mềm
            </span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 sm:text-3xl">
            Tải công cụ kiểm tra ngoài
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-zinc-500">
            Bộ phần mềm kiểm tra laptop phổ biến và đáng tin cậy. Mọi liên kết đều dẫn tới
            trang chủ chính thức của nhà phát triển.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <div className="text-xs leading-tight">
            <p className="font-semibold text-emerald-700">Nguồn chính thức</p>
            <p className="text-emerald-600/80">Không tự host file .exe</p>
          </div>
        </div>
      </div>

      {/* Groups */}
      <div className="space-y-10">
        {GROUPS.map((group) => {
          const GroupIcon = group.Icon;
          return (
            <section key={group.id} className="scroll-mt-24">
              <div className="mb-4 flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1",
                    group.chip,
                  )}
                >
                  <GroupIcon className={cn("h-5 w-5", group.accent)} />
                </div>
                <div className="min-w-0">
                  <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight text-zinc-900">
                    {group.title}
                    <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-500">
                      {group.tools.length}
                    </span>
                  </h2>
                  <p className="truncate text-xs text-zinc-500">{group.subtitle}</p>
                </div>
                <span className="ml-auto hidden h-px flex-1 bg-zinc-100 sm:block" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.tools.map((tool) => (
                  <ToolCard key={tool.name} tool={tool} chip={group.chip} />
                ))}
              </div>
            </section>
          );
        })}
      </div>

      {/* Safety note */}
      <div className="mt-10 flex items-start gap-3 rounded-2xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <Wrench className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-zinc-900">Lưu ý an toàn</p>
          <p className="mt-1 text-sm leading-relaxed text-zinc-500">
            Tất cả liên kết đều dẫn đến trang chủ chính thức của nhà phát triển. Chúng tôi không
            tự host hay phân phối bất kỳ file thực thi nào để đảm bảo an toàn tuyệt đối cho bạn.
          </p>
        </div>
      </div>
    </div>
  );
}
