import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Wrench, MapPin, Phone, Calendar, Hash, CheckCircle2, XCircle, AlertCircle, Package, Receipt } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatCurrency } from "@/lib/utils";
import { requireCustomer } from "@/lib/account/customer";
import { createClient } from "@/lib/supabase/server";

const STATUS_FLOW = [
  { key: "open", label: "Tiếp nhận", icon: Wrench },
  { key: "in_progress", label: "Đang sửa", icon: AlertCircle },
  { key: "awaiting_parts", label: "Chờ linh kiện", icon: Package },
  { key: "ready", label: "Sẵn sàng trả", icon: CheckCircle2 },
  { key: "completed", label: "Đã trả", icon: CheckCircle2 },
];

const STATUS_LABEL: Record<string, { label: string; bg: string; text: string }> = {
  open: { label: "Vừa tiếp nhận", bg: "bg-blue-50", text: "text-blue-700" },
  in_progress: { label: "Đang sửa", bg: "bg-amber-50", text: "text-amber-700" },
  awaiting_parts: { label: "Chờ linh kiện", bg: "bg-violet-50", text: "text-violet-700" },
  ready: { label: "Sẵn sàng trả", bg: "bg-emerald-50", text: "text-emerald-700" },
  completed: { label: "Đã trả", bg: "bg-emerald-50", text: "text-emerald-700" },
  cancelled: { label: "Đã huỷ", bg: "bg-rose-50", text: "text-rose-700" },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  return { title: `Phiếu sửa ${id.slice(0, 8)}` };
}

export default async function RepairTicketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const me = await requireCustomer();

  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any;
  const { data, error } = await db
    .from("repair_tickets")
    .select(
      "id, ticket_code, device_name, issue_description, condition_description, serial_number, status, created_at, completed_at, delivered_at, estimated_cost, actual_cost, repair_solution, images, shop:shops(id, name, phone, address)",
    )
    .eq("id", id)
    .eq("customer_id", me.customerId ?? "")
    .maybeSingle();

  if (error || !data) notFound();

  const status = STATUS_LABEL[data.status ?? ""] ?? {
    label: data.status ?? "—",
    bg: "bg-muted",
    text: "text-muted-foreground",
  };

  // Current step index
  const currentIdx = STATUS_FLOW.findIndex((s) => s.key === data.status);
  const isCancelled = data.status === "cancelled";

  return (
    <div className="space-y-5">
      <Button asChild variant="ghost" size="sm" className="-ml-2 w-fit text-muted-foreground">
        <Link href="/account/repair-tickets">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Quay lại danh sách phiếu
        </Link>
      </Button>

      {/* Header */}
      <Card className="rounded-2xl border-border/60">
        <CardContent className="p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="font-mono text-lg font-bold">
                  #{data.ticket_code}
                </h1>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-medium",
                    status.bg,
                    status.text,
                  )}
                >
                  {status.label}
                </span>
              </div>
              <p className="mt-1 text-sm font-medium">{data.device_name}</p>
              <p className="text-xs text-muted-foreground">
                Gửi lúc{" "}
                {new Date(data.created_at).toLocaleString("vi-VN")}
              </p>
            </div>
            {data.actual_cost && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Chi phí thực tế</p>
                <p className="text-2xl font-bold text-primary">
                  {formatCurrency(data.actual_cost)}
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Status timeline */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Tiến độ sửa chữa</CardTitle>
            </CardHeader>
            <CardContent>
              {isCancelled ? (
                <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50/50 p-4 text-rose-700">
                  <XCircle className="h-5 w-5" />
                  <p className="text-sm font-medium">Phiếu sửa đã bị huỷ.</p>
                </div>
              ) : (
                <ol className="relative space-y-3">
                  {STATUS_FLOW.map((step, idx) => {
                    const active = idx <= currentIdx;
                    const isCurrent = idx === currentIdx;
                    return (
                      <li key={step.key} className="flex items-start gap-3">
                        <div
                          className={cn(
                            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2",
                            active
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-muted bg-background text-muted-foreground",
                            isCurrent && "ring-4 ring-primary/20",
                          )}
                        >
                          <step.icon className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0 flex-1 pt-1">
                          <p
                            className={cn(
                              "text-sm font-medium",
                              active ? "text-foreground" : "text-muted-foreground",
                            )}
                          >
                            {step.label}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              )}
            </CardContent>
          </Card>

          {/* Issue + Condition */}
          <Card className="rounded-2xl border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Mô tả</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                  Vấn đề
                </p>
                <p className="whitespace-pre-line">{data.issue_description}</p>
              </div>
              {data.condition_description && (
                <div>
                  <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                    Tình trạng máy
                  </p>
                  <p className="whitespace-pre-line text-muted-foreground">
                    {data.condition_description}
                  </p>
                </div>
              )}
              {data.repair_solution && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">
                    Phương án sửa chữa
                  </p>
                  <p className="whitespace-pre-line text-emerald-900">
                    {data.repair_solution}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Images */}
          {Array.isArray(data.images) && data.images.length > 0 && (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Hình ảnh</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {data.images.map((src: string, i: number) => (
                    <a
                      key={i}
                      href={src}
                      target="_blank"
                      rel="noreferrer"
                      className="aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={src}
                        alt={`Hình ${i + 1}`}
                        className="h-full w-full object-cover transition-transform hover:scale-105"
                      />
                    </a>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-5">
          {/* Details */}
          <Card className="rounded-2xl border-border/60">
            <CardContent className="divide-y divide-border/60 p-0">
              {data.serial_number && (
                <Row icon={Hash} label="Serial" value={data.serial_number} />
              )}
              {data.estimated_cost && (
                <Row
                  icon={Receipt}
                  label="Phí dự kiến"
                  value={formatCurrency(data.estimated_cost)}
                />
              )}
              {data.completed_at && (
                <Row
                  icon={CheckCircle2}
                  label="Hoàn tất"
                  value={new Date(data.completed_at).toLocaleString("vi-VN")}
                />
              )}
              {data.delivered_at && (
                <Row
                  icon={CheckCircle2}
                  label="Đã trả khách"
                  value={new Date(data.delivered_at).toLocaleString("vi-VN")}
                />
              )}
            </CardContent>
          </Card>

          {/* Shop */}
          {data.shop && (
            <Card className="rounded-2xl border-border/60">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Cửa hàng xử lý</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold">{data.shop.name}</p>
                {data.shop.address && (
                  <p className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-4 w-4" />
                    {data.shop.address}
                  </p>
                )}
                {data.shop.phone && (
                  <a
                    href={`tel:${data.shop.phone}`}
                    className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
                  >
                    <Phone className="h-4 w-4" />
                    {data.shop.phone}
                  </a>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3 text-sm">
      <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="font-medium">{value}</p>
      </div>
    </div>
  );
}
