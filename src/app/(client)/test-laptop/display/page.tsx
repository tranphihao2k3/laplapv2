"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, ArrowLeft } from "lucide-react";

const colors = [
  { name: "Đen (Kiểm tra điểm sáng)", color: "bg-black" },
  { name: "Trắng (Kiểm tra điểm chết tối)", color: "bg-white" },
  { name: "Đỏ (Red color check)", color: "bg-red-500" },
  { name: "Xanh lá (Green color check)", color: "bg-green-500" },
  { name: "Xanh dương (Blue color check)", color: "bg-blue-500" },
  { name: "Xám (Gray scale/uniformity)", color: "bg-zinc-500" },
];

export default function DisplayPage() {
  const router = useRouter();
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentColorIdx, setCurrentColorIdx] = useState(0);

  const enterFullscreen = () => {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    }
    document.body.classList.add("display-fullscreen");
    setIsFullscreen(true);
    setCurrentColorIdx(0);
  };

  const exitFullscreen = () => {
    if (document.exitFullscreen) {
      document.exitFullscreen().catch(() => {});
    }
    document.body.classList.remove("display-fullscreen");
    setIsFullscreen(false);
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        document.body.classList.remove("display-fullscreen");
        setIsFullscreen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isFullscreen) return;
      if (e.key === "Escape") {
        exitFullscreen();
      } else if (e.key === "ArrowRight" || e.key === " " || e.key === "Enter") {
        setCurrentColorIdx((p) => (p + 1) % colors.length);
      } else if (e.key === "ArrowLeft") {
        setCurrentColorIdx((p) => (p - 1 + colors.length) % colors.length);
      }
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      window.removeEventListener("keydown", handleKeyDown);
      // Cleanup khi unmount
      document.body.classList.remove("display-fullscreen");
    };
  }, [isFullscreen]);

  const handleScreenClick = () => {
    if (isFullscreen) {
      setCurrentColorIdx((p) => (p + 1) % colors.length);
    }
  };

  if (isFullscreen) {
    // Chỉ có màu thuần phủ kín — không chữ, không nút, không lớp phủ nào.
    // Mọi text đều làm nhiễu việc soi điểm chết / dải màu, nên hướng dẫn
    // (click để đổi màu, Esc để thoát) được ghi ở trang trước khi vào fullscreen.
    const overlay = (
      <div
        className={`fixed inset-0 z-[2147483647] cursor-pointer ${colors[currentColorIdx].color}`}
        onClick={handleScreenClick}
      />
    );

    // Portal ra thẳng document.body: thoát khỏi mọi header sticky / containing block
    // của layout (ClientHeader + header test-laptop) để phủ kín toàn màn hình.
    return typeof document !== "undefined" ? createPortal(overlay, document.body) : overlay;
  }

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/test-laptop")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>
      <Card>
        <CardHeader>
          <CardTitle>Test Màn hình</CardTitle>
          <CardDescription>
            Kiểm tra điểm chết (Dead pixel) và dải màu (Gradient) ở chế độ toàn màn hình.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 py-12 text-center">
            <Monitor className="h-16 w-16 mb-4 text-zinc-900 opacity-80" />
            <h3 className="text-lg font-semibold mb-2">Kiểm tra điểm chết màn hình</h3>
            <p className="max-w-md text-sm text-zinc-500 mb-4">
              Màn hình sẽ hiển thị các màu cơ bản (Đen, Trắng, Đỏ, Xanh lá, Xanh dương) toàn màn hình.
              Vui lòng nhìn kỹ xem có chấm sáng bất thường (điểm sáng) hoặc chấm đen (điểm chết) nào không.
            </p>
            {/* Hướng dẫn nằm ở đây vì lúc fullscreen chỉ hiện màu thuần, không có chữ */}
            <div className="mb-6 max-w-md rounded-lg border border-zinc-200 bg-white px-4 py-3 text-left text-xs text-zinc-600">
              <p className="mb-1.5 font-semibold text-zinc-900">Cách dùng khi vào toàn màn hình:</p>
              <p className="mb-1">
                <span className="font-medium text-zinc-900">Click chuột</span> hoặc{" "}
                <span className="font-medium text-zinc-900">Space</span> /{" "}
                <span className="font-medium text-zinc-900">→</span> để sang màu kế tiếp
              </p>
              <p className="mb-1">
                <span className="font-medium text-zinc-900">←</span> để về màu trước
              </p>
              <p>
                <span className="font-medium text-zinc-900">Esc</span> để thoát
              </p>
            </div>
            <Button
              size="lg"
              className="bg-zinc-900 text-white hover:bg-zinc-700 px-8"
              onClick={enterFullscreen}
            >
              Bắt đầu Fullscreen (Toàn màn hình)
            </Button>
          </div>

          <div className="space-y-3">
            <h4 className="text-sm font-semibold">Các màu sẽ hiển thị:</h4>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {colors.map((c, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border p-2 text-xs font-medium">
                  <div className={`h-6 w-6 rounded border border-zinc-200 ${c.color}`} />
                  <span className="truncate">{c.name.split(" ")[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
