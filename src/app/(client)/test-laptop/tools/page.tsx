"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, ExternalLink } from "lucide-react";

const tools = [
  {
    name: "HWiNFO64",
    category: "System Info",
    description: "Phần mềm kiểm tra phần cứng chi tiết nhất, theo dõi nhiệt độ, điện áp, tốc độ quạt realtime",
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
    name: "AIDA64",
    category: "System Benchmark",
    description: "Kiểm tra toàn diện hệ thống, stress test, benchmark CPU/RAM/GPU",
    url: "https://www.aida64.com/downloads",
    logo: "📊",
  },
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
  {
    name: "MemTest86",
    category: "RAM Test",
    description: "Kiểm tra lỗi RAM (memory errors), chạy độc lập không cần OS",
    url: "https://www.memtest86.com/download.htm",
    logo: "🧠",
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
  {
    name: "BatteryInfoView",
    category: "Battery Info",
    description: "Xem thông tin pin laptop chi tiết: dung lượng, chu kỳ sạc, tình trạng chai pin",
    url: "https://www.nirsoft.net/utils/battery_information_view.html",
    logo: "🔋",
  },
];

const categories = Array.from(new Set(tools.map((t) => t.category)));

export default function ToolsPage() {
  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Tải công cụ kiểm tra ngoài</CardTitle>
          <CardDescription>
            Danh sách các phần mềm kiểm tra laptop phổ biến và đáng tin cậy. 
            Nhấn vào nút tải về để truy cập trang chủ chính thức.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {categories.map((cat) => (
            <div key={cat} className="space-y-3">
              <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide">
                {cat}
              </h3>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tools
                  .filter((t) => t.category === cat)
                  .map((tool) => (
                    <Card
                      key={tool.name}
                      className="group hover:shadow-md transition-shadow"
                    >
                      <CardHeader className="pb-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-2xl">
                            {tool.logo}
                          </div>
                          <div className="min-w-0 flex-1">
                            <CardTitle className="text-base">{tool.name}</CardTitle>
                            <Badge variant="secondary" className="mt-1 text-[10px]">
                              {tool.category}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <p className="text-xs text-zinc-600 leading-relaxed">
                          {tool.description}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full group-hover:bg-zinc-900 group-hover:text-white group-hover:border-zinc-900"
                          onClick={() => window.open(tool.url, "_blank")}
                        >
                          <Download className="mr-2 h-3.5 w-3.5" />
                          Tải về
                          <ExternalLink className="ml-2 h-3 w-3 opacity-50" />
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <p className="text-sm text-zinc-600">
          <strong>Lưu ý an toàn:</strong> Tất cả các liên kết đều dẫn đến trang chủ chính thức của nhà phát triển. 
          Chúng tôi không tự host hay phân phối bất kỳ file thực thi nào để đảm bảo an toàn tuyệt đối cho bạn.
        </p>
      </div>
    </div>
  );
}
