"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Monitor, X, ArrowLeft } from "lucide-react";

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
    return (
      <>
        {/* Ẩn tất cả header sticky khi fullscreen bằng global style */}
        <style>{`
          body.display-fullscreen header {
            visibility: hidden !important;
            pointer-events: none !important;
          }
        `}</style>
        <div
          className={`fixed inset-0 z-[9999] flex flex-col items-center justify-between cursor-pointer ${colors[currentColorIdx].color}`}
          onClick={handleScreenClick}
        >
        <div className="w-full flex items-center justify-between p-4 bg-black/40 text-white select-none">
          <p className="text-sm font-semibold">
            {colors[currentColorIdx].name} ({currentColorIdx + 1}/{colors.length})
          </p>
          <div className="flex gap-2">
            <span className="text-xs text-white/70 hidden sm:inline">
              Click hoặc dùng phím Space/Mũi tên để chuyển màu
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-7 border-white/20 bg-white/10 hover:bg-white/20 text-white"
              onClick={(e) => {
                e.stopPropagation();
                exitFullscreen();
              }}
            >
              <X className="h-4 w-4 mr-1" /> Thoát (Esc)
            </Button>
          </div>
        </div>

        {/* Empty flex spacer to push labels to edges */}
        <div />

        {currentColorIdx === 5 && (
          <div className="w-full max-w-lg p-6 bg-black/50 text-white rounded-xl mx-4 mb-20 text-center pointer-events-none">
            <p className="text-sm font-semibold mb-2">Kiểm tra Gradient (Dải màu)</p>
            <div className="h-8 w-full bg-gradient-to-r from-black via-zinc-500 to-white rounded border border-white/20 mb-2" />
            <p className="text-xs text-white/70">
              Đảm bảo dải màu chuyển đều mịn màng, không bị sọc ngang dọc
            </p>
          </div>
        )}

        <div />
      </div>
    </>
    );
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
            <p className="max-w-md text-sm text-zinc-500 mb-6">
              Màn hình sẽ hiển thị các màu cơ bản (Đen, Trắng, Đỏ, Xanh lá, Xanh dương) toàn màn hình. 
              Vui lòng nhìn kỹ xem có chấm sáng bất thường (điểm sáng) hoặc chấm đen (điểm chết) nào không.
            </p>
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
