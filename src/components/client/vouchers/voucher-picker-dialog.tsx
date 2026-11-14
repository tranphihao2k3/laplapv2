"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  Check,
  Copy,
  Loader2,
  Percent,
  Plus,
  Tag,
  Truck,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import type { VoucherType } from "@/types/voucher";

export type PublicVoucher = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  type: VoucherType;
  value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  start_date: string;
  end_date: string;
  quantity_total: number | null;
  quantity_remaining: number | null;
  is_active: boolean;
};

export function voucherValueLabel(v: PublicVoucher): string {
  if (v.type === "percent") return `Giảm ${v.value}%`;
  if (v.type === "fixed_amount") return `Giảm ${formatCurrency(v.value)}`;
  return "Miễn phí ship";
}

function VoucherTypeIcon({ type }: { type: VoucherType }) {
  if (type === "percent") return <Percent className="h-4 w-4" />;
  if (type === "fixed_amount") return <Tag className="h-4 w-4" />;
  return <Truck className="h-4 w-4" />;
}

export function usePublicVouchers(enabled = true) {
  const [vouchers, setVouchers] = useState<PublicVoucher[]>([]);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/public/vouchers", { cache: "no-store" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message ?? "Không tải được voucher");
      }
      setVouchers((json.data?.items ?? []) as PublicVoucher[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được voucher");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) void load();
  }, [enabled, load]);

  return { vouchers, loading, error, reload: load };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Gọi khi khách chọn "Dùng mã". Không truyền → chỉ hiển thị/copy/lưu. */
  onSelect?: (code: string) => void;
  selectedCode?: string | null;
};

export function VoucherPickerDialog({
  open,
  onOpenChange,
  onSelect,
  selectedCode,
}: Props) {
  const { vouchers, loading, error, reload } = usePublicVouchers(open);
  const [claimedIds, setClaimedIds] = useState<Set<string>>(new Set());
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  async function handleCopy(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      toast.success(`Đã copy mã ${code}`);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      toast.error("Không copy được mã, vui lòng nhập tay.");
    }
  }

  async function handleClaim(voucher: PublicVoucher) {
    setClaimingId(voucher.id);
    try {
      const res = await fetch("/api/v1/account/vouchers/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voucher_id: voucher.id }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) {
        if (res.status === 401) {
          toast.error("Bạn cần đăng nhập để lưu voucher");
          return;
        }
        throw new Error(json?.error?.message ?? "Lưu voucher thất bại");
      }
      setClaimedIds((prev) => new Set(prev).add(voucher.id));
      toast.success("Đã lưu voucher vào ví");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lưu voucher thất bại");
    } finally {
      setClaimingId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            Voucher đang có
          </DialogTitle>
          <DialogDescription>
            Lưu mã hoặc dùng ngay khi thanh toán. Số lượng có hạn.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] space-y-3 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Đang tải ưu đãi...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              <p>{error}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={reload}>
                Thử lại
              </Button>
            </div>
          ) : vouchers.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
              <Tag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/60" />
              Hiện chưa có voucher khả dụng. Quay lại sau nhé!
            </div>
          ) : (
            vouchers.map((v) => {
              const claimed = claimedIds.has(v.id);
              const selected = selectedCode === v.code;
              return (
                <div
                  key={v.id}
                  className={cn(
                    "flex overflow-hidden rounded-xl border bg-card",
                    selected && "border-primary ring-1 ring-primary/30",
                  )}
                >
                  <div className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 bg-gradient-to-br from-primary/15 to-primary/5 px-2 py-3 text-center text-primary">
                    <VoucherTypeIcon type={v.type} />
                    <span className="text-[11px] font-bold leading-tight">
                      {voucherValueLabel(v)}
                    </span>
                  </div>

                  <div className="min-w-0 flex-1 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="line-clamp-1 text-sm font-semibold">
                          {v.name}
                        </p>
                        {v.description ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                            {v.description}
                          </p>
                        ) : null}
                      </div>
                      {v.quantity_remaining != null ? (
                        <Badge
                          variant={v.quantity_remaining <= 5 ? "destructive" : "secondary"}
                          className="shrink-0 text-[10px]"
                        >
                          Còn {v.quantity_remaining}
                        </Badge>
                      ) : null}
                    </div>

                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                      {v.min_order_amount > 0 ? (
                        <span>Đơn từ {formatCurrency(v.min_order_amount)}</span>
                      ) : (
                        <span>Không yêu cầu đơn tối thiểu</span>
                      )}
                      {v.max_discount_amount ? (
                        <span>Tối đa {formatCurrency(v.max_discount_amount)}</span>
                      ) : null}
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Đến {new Date(v.end_date).toLocaleDateString("vi-VN")}
                      </span>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <code className="rounded-md bg-muted px-2 py-1 font-mono text-xs font-semibold">
                        {v.code}
                      </code>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        onClick={() => handleCopy(v.code)}
                      >
                        {copiedCode === v.code ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <Copy className="mr-1 h-3 w-3" />
                        )}
                        Copy
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-7 px-2 text-xs"
                        disabled={claimed || claimingId === v.id}
                        onClick={() => handleClaim(v)}
                      >
                        {claimingId === v.id ? (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        ) : claimed ? (
                          <Check className="mr-1 h-3 w-3" />
                        ) : (
                          <Plus className="mr-1 h-3 w-3" />
                        )}
                        {claimed ? "Đã lưu" : "Lưu"}
                      </Button>
                      {onSelect ? (
                        <Button
                          type="button"
                          size="sm"
                          className="ml-auto h-7 px-3 text-xs"
                          onClick={() => {
                            onSelect(v.code);
                            onOpenChange(false);
                          }}
                        >
                          Dùng mã
                          <ArrowRight className="ml-1 h-3 w-3" />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="border-t px-5 py-3 sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Đã lưu voucher? Xem tại ví voucher của bạn.
          </p>
          <Button asChild variant="outline" size="sm">
            <Link href="/account/vouchers">Ví voucher</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
