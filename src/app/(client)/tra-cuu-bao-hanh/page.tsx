"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Shield,
  Phone,
  Package,
  AlertCircle,
  CheckCircle2,
  Clock,
  MapPin,
  Headphones,
  ScanLine,
} from "lucide-react";

type WarrantyItem = {
  id: string;
  product_name: string;
  product_sku: string | null;
  serial_number: string | null;
  order_number: string | null;
  purchase_date: string;
  warranty_start: string;
  warranty_end: string;
  warranty_months: number;
  status: string;
  days_left: number | null;
};

type WarrantyResponse = {
  customer: { full_name: string | null; phone: string | null } | null;
  warranties: WarrantyItem[];
  total: number;
};

function fmtDate(d: string) {
  try {
    return new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

type StatusInfo = {
  label: string;
  bar: string;
  badge: string;
  text: string;
};

function statusInfo(status: string, daysLeft: number | null): StatusInfo {
  if (status === "voided")
    return { label: "Đã hủy bảo hành", bar: "bg-red-500", badge: "bg-red-100 text-red-700 ring-1 ring-red-200", text: "text-red-600" };
  if (status === "claimed")
    return { label: "Đang xử lý bảo hành", bar: "bg-amber-500", badge: "bg-amber-100 text-amber-700 ring-1 ring-amber-200", text: "text-amber-600" };
  if (status === "expired" || (daysLeft !== null && daysLeft < 0))
    return { label: "Đã hết hạn", bar: "bg-zinc-300", badge: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200", text: "text-zinc-500" };
  if (daysLeft !== null && daysLeft <= 30)
    return { label: "Sắp hết hạn", bar: "bg-orange-500", badge: "bg-orange-100 text-orange-700 ring-1 ring-orange-200", text: "text-orange-600" };
  return { label: "Còn hiệu lực", bar: "bg-emerald-500", badge: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200", text: "text-emerald-600" };
}

function elapsedPct(w: WarrantyItem): number {
  try {
    const start = new Date(w.warranty_start).getTime();
    const end = new Date(w.warranty_end).getTime();
    const now = Date.now();
    if (end <= start) return 0;
    const pct = ((now - start) / (end - start)) * 100;
    return Math.max(0, Math.min(100, pct));
  } catch {
    return 0;
  }
}

export default function WarrantyLookupPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<WarrantyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!searchTerm.trim()) {
      setError("Vui lòng nhập số serial/IMEI hoặc số điện thoại");
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setSearched(true);

    try {
      const res = await fetch(`/api/warranty-lookup?q=${encodeURIComponent(searchTerm.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Không tìm thấy thông tin bảo hành");
        return;
      }

      setResult(data);
    } catch {
      setError("Lỗi kết nối. Vui lòng thử lại sau.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="relative overflow-hidden border-b bg-zinc-950 text-white">
        <div
          className="pointer-events-none absolute inset-0 opacity-10"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 20%, white 1px, transparent 1px), radial-gradient(circle at 80% 60%, white 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        <div className="container relative mx-auto max-w-3xl px-4 pb-20 pt-12 text-center sm:pb-24 sm:pt-16">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/20">
            <Shield className="h-8 w-8" />
          </div>
          <Badge className="mb-3 border-white/20 bg-white/10 text-white hover:bg-white/15">
            Miễn phí · Tức thì
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Tra cứu bảo hành</h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-white/70 sm:text-base">
            Nhập số serial/IMEI hoặc số điện thoại đã đăng ký để kiểm tra tình trạng bảo hành sản phẩm của bạn.
          </p>
        </div>
      </section>

      <div className="container mx-auto max-w-3xl px-4 pb-16">
        {/* Search box */}
        <div className="relative z-10 -mt-14 rounded-2xl border border-zinc-200 bg-white p-4 shadow-xl sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <ScanLine className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
              <Input
                placeholder="VD: SN12345678 hoặc 0901234567"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="h-11 pl-10 text-base border-zinc-200 focus-visible:ring-zinc-900"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading}
              size="lg"
              className="h-11 bg-zinc-900 px-6 text-white hover:bg-zinc-700"
            >
              <Search className="mr-2 h-5 w-5" />
              {loading ? "Đang tìm..." : "Tra cứu"}
            </Button>
          </div>
          <p className="mt-2 px-1 text-xs text-zinc-400">
            Hỗ trợ tra cứu bằng số serial, IMEI hoặc số điện thoại mua hàng.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
            <div>
              <p className="font-medium text-zinc-900">Không tìm thấy</p>
              <p className="text-sm text-zinc-500">{error}</p>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="mt-6 space-y-4">
            {result.customer && (
              <div className="flex flex-wrap items-center gap-4 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-200 text-zinc-700">
                  <Phone className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-zinc-900">{result.customer.full_name ?? "Khách hàng"}</p>
                  <p className="text-sm text-zinc-500">{result.customer.phone}</p>
                </div>
                <div className="ml-auto flex items-center gap-2 rounded-lg bg-zinc-200 px-3 py-1.5 text-sm">
                  <Package className="h-4 w-4 text-zinc-500" />
                  <span className="font-semibold text-zinc-900">{result.total}</span>
                  <span className="text-zinc-500">sản phẩm</span>
                </div>
              </div>
            )}

            {result.warranties.length === 0 ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-10 text-center text-zinc-400">
                Không có sản phẩm bảo hành nào gắn với thông tin này.
              </div>
            ) : (
              result.warranties.map((w) => {
                const s = statusInfo(w.status, w.days_left);
                const pct = elapsedPct(w);
                return (
                  <div
                    key={w.id}
                    className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md"
                  >
                    <div className={`absolute inset-y-0 left-0 w-1.5 ${s.bar}`} />
                    <div className="p-5 pl-6">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-50 ring-1 ring-zinc-100">
                            <Package className="h-6 w-6 text-zinc-400" />
                          </div>
                          <div className="min-w-0 pt-0.5">
                            <p className="font-bold leading-tight text-zinc-900 sm:text-lg">{w.product_name}</p>
                            <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
                              {w.product_sku && <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded">SKU: {w.product_sku}</span>}
                              {w.serial_number && <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded">S/N: {w.serial_number}</span>}
                            </div>
                          </div>
                        </div>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${s.badge}`}>
                          {s.label}
                        </span>
                      </div>

                      {/* Visual Timeline */}
                      <div className="mt-6 rounded-xl bg-zinc-50/80 p-5 ring-1 ring-zinc-100">
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Kích hoạt</p>
                            <p className="mt-0.5 font-semibold text-zinc-900">{fmtDate(w.warranty_start)}</p>
                          </div>
                          
                          {w.days_left !== null && w.days_left >= 0 && (
                            <div className="text-center animate-in fade-in zoom-in duration-500">
                              <div className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-bold shadow-sm ${s.badge}`}>
                                <Clock className="h-4 w-4" />
                                Còn {w.days_left} ngày
                              </div>
                            </div>
                          )}
                          
                          {w.days_left !== null && w.days_left < 0 && (
                            <div className="text-center">
                              <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-200 px-3 py-1 text-sm font-bold text-zinc-600 shadow-sm">
                                <AlertCircle className="h-4 w-4" />
                                Hết hạn {Math.abs(w.days_left)} ngày
                              </div>
                            </div>
                          )}

                          <div className="text-right">
                            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Hết hạn</p>
                            <p className="mt-0.5 font-semibold text-zinc-900">{fmtDate(w.warranty_end)}</p>
                          </div>
                        </div>
                        
                        <div className="relative pt-3 pb-1">
                          {/* Track */}
                          <div className="flex h-3 w-full overflow-hidden rounded-full bg-zinc-200/80 inset-shadow-sm">
                            {/* Fill */}
                            <div
                              className={`h-full ${s.bar} transition-all duration-1000 ease-out`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          
                          {/* Current Date Marker */}
                          {w.days_left !== null && w.days_left >= 0 && (
                            <div 
                              className="absolute top-0 -ml-1.5 flex flex-col items-center"
                              style={{ left: `${pct}%` }}
                            >
                              <div className="h-4 w-3 rounded-t-sm bg-zinc-800" />
                              <div className="h-1 w-1 mt-0.5 rounded-full bg-zinc-800" />
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Info grid */}
                      <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-100 pt-4 text-sm sm:grid-cols-3">
                        <div>
                          <p className="text-xs text-zinc-400">Số hóa đơn</p>
                          <p className="font-medium font-mono text-zinc-900">{w.order_number || "—"}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">Ngày mua</p>
                          <p className="font-medium text-zinc-900">{fmtDate(w.purchase_date)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-zinc-400">Thời hạn</p>
                          <p className="font-medium text-zinc-900">{w.warranty_months} tháng</p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Note */}
            <div className="flex items-start gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-zinc-500" />
              <p className="text-sm text-zinc-600">
                Để được bảo hành, vui lòng mang theo hóa đơn mua hàng và sản phẩm đến cửa hàng gần nhất.
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !error && !searched && (
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {[
              { icon: ScanLine, title: "Nhập mã", desc: "Số serial/IMEI hoặc SĐT mua hàng" },
              { icon: Search, title: "Tra cứu", desc: "Hệ thống tìm trong vài giây" },
              { icon: Shield, title: "Xem kết quả", desc: "Tình trạng & thời hạn bảo hành" },
            ].map((step, i) => (
              <div key={i} className="rounded-xl border border-zinc-200 bg-white p-5 text-center">
                <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
                  <step.icon className="h-5 w-5" />
                </div>
                <p className="font-semibold text-zinc-900">{step.title}</p>
                <p className="mt-1 text-sm text-zinc-400">{step.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* Support */}
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Hotline hỗ trợ</p>
              <p className="font-semibold text-zinc-900">1900 xxxx</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-700">
              <MapPin className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm text-zinc-400">Trung tâm bảo hành</p>
              <p className="font-semibold text-zinc-900">Mang sản phẩm đến cửa hàng gần nhất</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
