"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2, User, UserPlus, X, Search, Phone, Award } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCrudCreate, useCrudList } from "@/lib/api/admin-crud";
import type { Customer } from "./types";

type Props = {
  value: Customer | null;
  onChange: (next: Customer | null) => void;
};

const TIER_VARIANT: Record<string, "default" | "secondary" | "outline"> = {
  gold: "default",
  silver: "secondary",
  bronze: "outline",
};

const TIER_LABEL: Record<string, string> = {
  gold: "Vàng",
  silver: "Bạc",
  bronze: "Đồng",
};

function formatLoyaltyPoints(n: number | null | undefined): string {
  if (!n || n <= 0) return "0";
  return new Intl.NumberFormat("vi-VN").format(n);
}

export function CustomerPicker({ value, onChange }: Props) {
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", phone: "" });
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 250);
    return () => clearTimeout(t);
  }, [query]);

  const list = useCrudList<Customer>(
    "customers",
    { search: debounced || undefined, page: 1, pageSize: 10 },
    open,
  );
  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const createMutation = useCrudCreate<Customer, { full_name: string; phone: string }>("customers");

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  if (value) {
    const tier = (value.tier ?? "bronze").toLowerCase();
    const tierLabel = TIER_LABEL[tier] ?? tier;
    return (
      <div className="flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 shadow-sm">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
          <User className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 truncate text-sm font-medium">
            <span className="truncate">{value.full_name || "Khách"}</span>
            <Badge variant={TIER_VARIANT[tier] ?? "outline"} className="text-[10px]">
              <Award className="mr-0.5 h-2.5 w-2.5" />
              {tierLabel}
            </Badge>
          </div>
          <div className="flex items-center gap-2 truncate text-xs text-muted-foreground">
            {value.phone && (
              <span className="flex items-center gap-0.5">
                <Phone className="h-3 w-3" />
                {value.phone}
              </span>
            )}
            {(value.loyalty_points ?? 0) > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                · {formatLoyaltyPoints(value.loyalty_points)} điểm
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          aria-label="Bỏ chọn khách"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  async function onCreateCustomer() {
    try {
      const phone = form.phone.trim();
      if (!phone) {
        toast.error("Nhập số điện thoại");
        return;
      }
      const created = await createMutation.mutateAsync({
        full_name: form.full_name.trim() || phone,
        phone,
      });
      toast.success("Đã tạo khách mới");
      onChange(created);
      setCreateOpen(false);
      setForm({ full_name: "", phone: "" });
      setOpen(false);
    } catch (e) {
      const msg =
        (e as { error?: { message?: string } })?.error?.message ?? "Không thể tạo khách";
      toast.error(msg);
    }
  }

  return (
    <>
      <div ref={rootRef} className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Khách lẻ — nhập SĐT/tên để chọn khách"
          className="h-10 pl-9"
        />
        {list.isFetching && (
          <Loader2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}

        {open && (
          <div className="absolute left-0 right-0 z-50 mt-1 max-h-80 overflow-y-auto rounded-lg border bg-popover shadow-xl">
            <button
              type="button"
              onClick={() => {
                setCreateOpen(true);
                setForm({
                  full_name: query.replace(/[0-9+\s]/g, "").trim(),
                  phone: query.replace(/\D/g, ""),
                });
              }}
              className="flex w-full items-center gap-2 border-b bg-muted/30 px-3 py-2.5 text-left text-sm font-semibold text-primary transition-colors hover:bg-accent"
            >
              <UserPlus className="h-4 w-4" />
              Thêm khách mới
              {query && (
                <span className="text-xs font-normal text-muted-foreground">
                  — &ldquo;{query}&rdquo;
                </span>
              )}
            </button>
            {list.isFetching && items.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">Đang tìm...</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-3 text-xs text-muted-foreground">
                {debounced ? "Không tìm thấy khách phù hợp" : "Gõ SĐT hoặc tên để tìm"}
              </div>
            ) : (
              <ul className="py-1">
                {items.map((c) => {
                  const tier = (c.tier ?? "bronze").toLowerCase();
                  return (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => {
                          onChange(c);
                          setOpen(false);
                        }}
                        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate font-medium">
                              {c.full_name || "(không tên)"}
                            </span>
                            {(c.loyalty_points ?? 0) > 0 && (
                              <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
                                {formatLoyaltyPoints(c.loyalty_points)}đ
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted-foreground">
                            {c.phone ?? "—"}
                          </div>
                        </div>
                        <Badge variant={TIER_VARIANT[tier] ?? "outline"} className="text-[10px]">
                          {TIER_LABEL[tier] ?? tier}
                        </Badge>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm khách mới</DialogTitle>
            <DialogDescription>Tạo nhanh khách hàng để gắn vào hóa đơn.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="cust-phone">Số điện thoại</Label>
              <Input
                id="cust-phone"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                placeholder="0901..."
                inputMode="tel"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="cust-name">Tên khách</Label>
              <Input
                id="cust-name"
                value={form.full_name}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                placeholder="Nguyễn Văn A"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Huỷ
            </Button>
            <Button onClick={onCreateCustomer} disabled={createMutation.isPending}>
              {createMutation.isPending ? "Đang tạo..." : "Tạo & chọn"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}