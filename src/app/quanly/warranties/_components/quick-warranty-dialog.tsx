"use client";

/**
 * Dialog "Tạo nhanh bảo hành" — dùng cho máy ĐÃ BÁN (hoặc đã sửa) nhưng KHÔNG
 * có trong catalog web (không có `product_variants` row).
 *
 * Vì sao làm được: `serial_numbers.product_variant_id` NULLABLE và các FK của
 * `warranties` (customer_id / serial_number_id / order_id / repair_ticket_id)
 * cũng NULLABLE → tạo được bảo hành độc lập, chỉ gắn khách + serial.
 * Xem thêm giải thích ở `src/lib/warranties/quick-warranty.ts`.
 *
 * 2 chế độ trong CÙNG 1 dialog:
 *   1. "1 máy"      → nhập tay 1 bảo hành.
 *   2. "Nhiều dòng" → dán cả list (1 dòng = 1 máy) — đúng nhu cầu "tôi có 1
 *      list cần lưu bảo hành". Gửi 1 request duy nhất dạng array.
 *
 * UI viết theo hướng mobile-first vì admin dùng máy (dialog full-width,
 * field 1 cột trên mobile, 2 cột từ breakpoint `sm`).
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ChevronDown,
  Copy,
  Download,
  FileSpreadsheet,
  Loader2,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OptionsSelect, type SelectOption } from "@/components/ui/options-select";
import { httpPost } from "@/lib/api/http";
import { useCrudList } from "@/lib/api/admin-crud";
import { useStoreSettings } from "@/components/client/layout/use-store-settings";
import {
  addMonthsIso,
  diffMonthsIso,
  parseQuickBulkText,
  QUICK_BULK_TEMPLATE_EXAMPLE,
  QUICK_BULK_TEMPLATE_HEADER,
  todayIso,
} from "@/lib/warranties/quick-warranty";

type WarrantyType = "sold" | "repair" | "extension";

type ProductVariant = {
  id: string;
  sku: string | null;
  name: string | null;
  product_id: string | null;
};

type Product = {
  id: string;
  name: string | null;
};

type RepairTicket = {
  id: string;
  ticket_code: string | null;
  device_name: string | null;
  serial_number: string | null;
  status: string | null;
};

type QuickResponse = {
  mode: "single" | "bulk";
  succeeded: number;
  failed: number;
  results: Array<{ ok: boolean; warranty_id?: string; error?: string }>;
};

const TYPE_LABEL: Record<WarrantyType, string> = {
  sold: "Bán máy",
  repair: "Sửa chữa",
  extension: "Gia hạn",
};

/** Bảng lỗi field → message tiếng Việt (hiển thị inline ngay dưới field). */
type FieldErrors = Record<string, string>;

function getErrorMessage(error: unknown): string {
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const payload = error as {
      error?: { message?: string; fields?: Record<string, string[] | undefined> };
    };
    const msg = payload.error?.message;
    const fieldMsg = Object.values(payload.error?.fields ?? {})
      .flat()
      .filter(Boolean)
      .join(" · ");
    if (msg || fieldMsg) return [msg, fieldMsg].filter(Boolean).join(" | ");
  }
  return "Đã xảy ra lỗi";
}

/** Tải file mẫu CSV (mở bằng Excel được) cho chế độ nhập nhiều dòng. */
function downloadTemplate() {
  const content = [
    QUICK_BULK_TEMPLATE_HEADER,
    ...QUICK_BULK_TEMPLATE_EXAMPLE.split("\n"),
  ].join("\n");
  // BOM để Excel nhận đúng UTF-8 (tiếng Việt không bị lỗi font).
  const blob = new Blob(["\uFEFF" + content], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "mau-nhap-bao-hanh.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Copy mẫu vào clipboard (fallback cho trình duyệt không cho tải file). */
async function copyTemplate() {
  const content = [
    QUICK_BULK_TEMPLATE_HEADER,
    ...QUICK_BULK_TEMPLATE_EXAMPLE.split("\n"),
  ].join("\n");
  try {
    await navigator.clipboard.writeText(content);
    toast.success("Đã copy mẫu vào clipboard");
  } catch {
    toast.error("Trình duyệt không cho phép copy — hãy dùng nút Tải mẫu");
  }
}

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Gọi sau khi tạo thành công để refresh list. */
  onCreated?: () => void;
};

export function QuickWarrantyDialog({ open, onOpenChange, onCreated }: Props) {
  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  /** Lỗi từng dòng khi import nhiều dòng (để admin biết dòng nào sửa lại). */
  const [bulkErrors, setBulkErrors] = useState<string[]>([]);

  // ── Form 1 máy ──
  const [warrantyType, setWarrantyType] = useState<WarrantyType>("sold");
  const [deviceName, setDeviceName] = useState("");
  const [serial, setSerial] = useState("");
  const [imei, setImei] = useState("");
  const [productVariantId, setProductVariantId] = useState("");
  const [phone, setPhone] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [isGuest, setIsGuest] = useState(false);
  const [startDate, setStartDate] = useState(todayIso());
  const [months, setMonths] = useState(12);
  const [endDate, setEndDate] = useState("");
  const [endDateTouched, setEndDateTouched] = useState(false);
  const [repairTicketId, setRepairTicketId] = useState("");
  const [note, setNote] = useState("");
  /** Ẩn Serial/IMEI/liên kết SP/ghi chú… — chỉ hiện khi admin cần. */
  const [showAdvanced, setShowAdvanced] = useState(false);

  // ── Form nhiều dòng ──
  const [bulkText, setBulkText] = useState("");
  const [bulkType, setBulkType] = useState<WarrantyType>("sold");
  const [bulkMonths, setBulkMonths] = useState(12);
  const [bulkStartDate, setBulkStartDate] = useState(todayIso());

  // Số tháng bảo hành mặc định lấy từ Settings cửa hàng (`warranty_months`).
  const { settings } = useStoreSettings();
  const defaultMonths = settings?.warranty_months ?? 12;

  // Chỉ tải dữ liệu cần thiết khi dialog mở (tiết kiệm băng thông trên mobile).
  const variantsQ = useCrudList<ProductVariant>(
    "product-variants",
    { page: 1, pageSize: 500 },
    open,
  );
  const productsQ = useCrudList<Product>("products", { page: 1, pageSize: 500 }, open);
  const ticketsQ = useCrudList<RepairTicket>(
    "repair-tickets",
    { page: 1, pageSize: 200 },
    open,
  );

  // Reset form mỗi lần MỞ dialog (tránh dữ liệu cũ sót lại).
  // Dùng ref theo dõi lần mở trước: Settings được load bất đồng bộ, nếu reset
  // theo `defaultMonths` thì form sẽ bị xoá dữ liệu đang nhập giữa chừng.
  const wasOpen = useRef(false);
  useEffect(() => {
    if (open && !wasOpen.current) {
      setMode("single");
      setWarrantyType("sold");
      setDeviceName("");
      setSerial("");
      setImei("");
      setProductVariantId("");
      setPhone("");
      setCustomerName("");
      setIsGuest(false);
      setStartDate(todayIso());
      setMonths(defaultMonths);
      setEndDate("");
      setEndDateTouched(false);
      setRepairTicketId("");
      setNote("");
      setShowAdvanced(false);
      setBulkText("");
      setBulkType("sold");
      setBulkMonths(defaultMonths);
      setBulkStartDate(todayIso());
      setErrors({});
      setBulkErrors([]);
      monthsTouched.current = false;
    }
    wasOpen.current = open;
  }, [open, defaultMonths]);

  // Khi Settings tải xong sau khi mở dialog → cập nhật số tháng mặc định,
  // nhưng KHÔNG ghi đè nếu admin đã tự sửa.
  const monthsTouched = useRef(false);
  useEffect(() => {
    if (monthsTouched.current) return;
    setMonths(defaultMonths);
    setBulkMonths(defaultMonths);
  }, [defaultMonths]);

  // Ngày hết hạn ↔ số tháng:
  // - Sửa tháng / ngày bắt đầu (chưa đụng ngày hết hạn) → tự tính end_date.
  // - Sửa tay ngày hết hạn → tự tính lại số tháng (máy còn BH tới ngày cụ thể).
  useEffect(() => {
    if (endDateTouched) return;
    if (!startDate || months <= 0) {
      setEndDate("");
      return;
    }
    setEndDate(addMonthsIso(startDate, months));
  }, [startDate, months, endDateTouched]);

  useEffect(() => {
    if (!endDateTouched) return;
    if (!startDate || !endDate) return;
    const next = diffMonthsIso(startDate, endDate);
    setMonths(next);
    monthsTouched.current = true;
  }, [startDate, endDate, endDateTouched]);

  const productNameById = useMemo(() => {
    const m = new Map<string, string>();
    (productsQ.data?.items ?? []).forEach((p) => {
      if (p.name) m.set(p.id, p.name);
    });
    return m;
  }, [productsQ.data]);

  const variantOptions: SelectOption[] = useMemo(
    () =>
      (variantsQ.data?.items ?? []).map((v) => {
        const productName = v.product_id ? productNameById.get(v.product_id) : null;
        const label =
          [productName, v.name].filter(Boolean).join(" — ") ||
          v.sku ||
          v.id.slice(0, 8);
        return { value: v.id, label, keywords: v.sku ?? "" };
      }),
    [variantsQ.data, productNameById],
  );

  const ticketOptions: SelectOption[] = useMemo(
    () =>
      (ticketsQ.data?.items ?? []).map((t) => ({
        value: t.id,
        label: `${t.ticket_code ?? t.id.slice(0, 8)} · ${t.device_name ?? "—"}`,
        keywords: t.serial_number ?? "",
      })),
    [ticketsQ.data],
  );

  const bulkRows = useMemo(() => parseQuickBulkText(bulkText), [bulkText]);

  // ── Submit 1 máy ──
  function validateSingle(): FieldErrors {
    const e: FieldErrors = {};
    if (!deviceName.trim()) e.deviceName = "Vui lòng nhập tên máy";
    if (!isGuest && !phone.trim()) {
      e.phone = "Vui lòng nhập SĐT khách hàng hoặc tick vào ô Khách lẻ";
    }
    if (!startDate) e.startDate = "Vui lòng chọn ngày bắt đầu";
    if (months <= 0 && !endDate) {
      e.months = "Số tháng bảo hành phải lớn hơn 0 (hoặc chọn ngày hết hạn)";
    }
    return e;
  }

  async function handleSubmitSingle() {
    const e = validateSingle();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error("Vui lòng kiểm tra lại các trường được đánh dấu đỏ");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        warranty_type: warrantyType,
        customer: {
          phone: isGuest ? null : phone.trim(),
          full_name: customerName.trim() || null,
        },
        device: {
          name: deviceName.trim(),
          serial: serial.trim() || null,
          imei: imei.trim() || null,
          product_variant_id: productVariantId || null,
        },
        start_date: startDate,
        warranty_months: months,
        end_date: endDate || null,
        status: "active",
        note: note.trim() || null,
        repair_ticket_id: warrantyType === "repair" ? repairTicketId || null : null,
      };
      await httpPost<QuickResponse>("/v1/warranties/quick", body);
      toast.success(`Đã tạo bảo hành (${TYPE_LABEL[warrantyType]})`);
      onCreated?.();
      onOpenChange(false);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  // ── Submit nhiều dòng ──
  async function handleSubmitBulk() {
    if (bulkRows.length === 0) {
      toast.error("Vui lòng dán ít nhất 1 dòng dữ liệu");
      return;
    }
    if (bulkMonths <= 0) {
      toast.error("Số tháng bảo hành phải lớn hơn 0");
      return;
    }

    setSubmitting(true);
    try {
      const items = bulkRows.map((r) => {
        const start = r.startDate ?? bulkStartDate;
        const months =
          r.months ??
          (r.endDate ? diffMonthsIso(start, r.endDate) : null) ??
          bulkMonths;
        return {
          warranty_type: bulkType,
          customer: { phone: r.phone, full_name: r.customerName },
          device: {
            name: r.name,
            serial: r.serial,
            imei: r.imei,
            product_variant_id: null,
          },
          start_date: start,
          warranty_months: months > 0 ? months : bulkMonths,
          end_date: r.endDate,
          status: "active",
          note: r.note,
        };
      });

      const res = await httpPost<QuickResponse>("/v1/warranties/quick", items);
      if (res.failed > 0) {
        toast.warning(
          `Tạo được ${res.succeeded}/${res.succeeded + res.failed} bảo hành. ${res.failed} dòng lỗi (xem danh sách bên dưới).`,
        );
      } else {
        toast.success(`Đã tạo ${res.succeeded} bảo hành`);
      }
      onCreated?.();
      if (res.failed === 0) {
        setBulkText("");
        onOpenChange(false);
      } else {
        // Giữ dialog mở để admin thấy dòng nào lỗi và sửa lại.
        setBulkErrors(
          res.results
            .map((r, i) => (r.ok ? null : `Dòng ${i + 1}: ${r.error ?? "Lỗi không xác định"}`))
            .filter((x): x is string => x !== null),
        );
      }
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            Tạo nhanh bảo hành
          </DialogTitle>
          <DialogDescription>
            Dùng cho máy đã bán / đã sửa nhưng KHÔNG có trong danh mục sản phẩm.
            Hệ thống tự tạo serial (nếu chưa có) và bảo hành gắn với khách hàng.
          </DialogDescription>
        </DialogHeader>

        {/* Chọn chế độ */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "single" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => {
              setMode("single");
              setErrors({});
              setBulkErrors([]);
            }}
          >
            1 máy
          </Button>
          <Button
            type="button"
            variant={mode === "bulk" ? "default" : "outline"}
            size="sm"
            className="flex-1"
            onClick={() => {
              setMode("bulk");
              setErrors({});
              setBulkErrors([]);
            }}
          >
            <Upload className="mr-1.5 h-4 w-4" /> Nhiều dòng (dán list)
          </Button>
        </div>

        {mode === "single" ? (
          /* 1 cột — Tab đi thẳng xuống: tên máy → SĐT → tên khách → mã máy → tháng BH */
          <div className="flex flex-col gap-2.5">
            <div className="space-y-1">
              <Label htmlFor="qw-device-name">
                Tên máy <span className="text-destructive">*</span>
              </Label>
              <Input
                id="qw-device-name"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                placeholder="VD: HP 830G8"
                aria-invalid={!!errors.deviceName}
                autoFocus
              />
              {errors.deviceName ? (
                <p className="text-xs text-destructive">{errors.deviceName}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="qw-phone">SĐT</Label>
              <Input
                id="qw-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                placeholder="0901234567"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={11}
                disabled={isGuest}
                aria-invalid={!!errors.phone}
              />
              {errors.phone ? (
                <p className="text-xs text-destructive">{errors.phone}</p>
              ) : null}
            </div>

            <div className="space-y-1">
              <Label htmlFor="qw-customer-name">Tên khách</Label>
              <Input
                id="qw-customer-name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Nguyễn Văn A"
                disabled={isGuest}
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="qw-serial">Mã máy (Serial)</Label>
              <Input
                id="qw-serial"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="Tuỳ chọn"
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="qw-months">Số tháng bảo hành</Label>
              <Input
                id="qw-months"
                type="number"
                min={0}
                inputMode="numeric"
                value={months}
                onChange={(e) => {
                  monthsTouched.current = true;
                  setMonths(Number(e.target.value));
                  setEndDateTouched(false);
                }}
                aria-invalid={!!errors.months}
              />
              {errors.months ? (
                <p className="text-xs text-destructive">{errors.months}</p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1">
                <Label htmlFor="qw-start-date">Ngày bắt đầu</Label>
                <Input
                  id="qw-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  aria-invalid={!!errors.startDate}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="qw-end-date">Ngày hết hạn</Label>
                <Input
                  id="qw-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setEndDateTouched(true);
                  }}
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Tab: tên máy → SĐT → tên khách → mã máy → tháng BH. Sửa hết hạn →
              tháng tự điều chỉnh.
            </p>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                className="flex w-full items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-left text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50"
                aria-expanded={showAdvanced}
                tabIndex={-1}
              >
                <span>
                  Tuỳ chọn thêm
                  <span className="ml-1 font-normal">(IMEI, loại BH, ghi chú…)</span>
                </span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    showAdvanced && "rotate-180",
                  )}
                />
              </button>

              {showAdvanced ? (
                <div className="mt-2.5 flex flex-col gap-2.5">
                  <div className="space-y-1">
                    <Label>Loại bảo hành</Label>
                    <Select
                      value={warrantyType}
                      onValueChange={(v) => setWarrantyType(v as WarrantyType)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sold">Bán máy</SelectItem>
                        <SelectItem value="repair">Sửa chữa</SelectItem>
                        <SelectItem value="extension">Gia hạn</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="qw-imei">IMEI</Label>
                    <Input
                      id="qw-imei"
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      placeholder="Tuỳ chọn"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label>Liên kết sản phẩm (tuỳ chọn)</Label>
                    <OptionsSelect
                      options={variantOptions}
                      value={productVariantId}
                      onValueChange={setProductVariantId}
                      placeholder="Không liên kết (máy ngoài danh mục)"
                      searchable
                      searchPlaceholder="Tìm tên sản phẩm / SKU..."
                      emptyText="Không tìm thấy sản phẩm"
                    />
                  </div>

                  {warrantyType === "repair" ? (
                    <div className="space-y-1">
                      <Label>Phiếu sửa chữa (tuỳ chọn)</Label>
                      <OptionsSelect
                        options={ticketOptions}
                        value={repairTicketId}
                        onValueChange={setRepairTicketId}
                        placeholder="Không liên kết phiếu nào"
                        searchable
                        searchPlaceholder="Tìm mã phiếu / thiết bị..."
                        emptyText="Không tìm thấy phiếu"
                      />
                    </div>
                  ) : null}

                  <div className="space-y-1">
                    <Label htmlFor="qw-note">Ghi chú</Label>
                    <Textarea
                      id="qw-note"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Tuỳ chọn"
                      rows={2}
                    />
                  </div>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={isGuest}
                      onChange={(e) => {
                        setIsGuest(e.target.checked);
                        if (e.target.checked) setPhone("");
                      }}
                    />
                    Khách lẻ (không có SĐT)
                  </label>
                </div>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label>Loại bảo hành</Label>
                <Select
                  value={bulkType}
                  onValueChange={(v) => setBulkType(v as WarrantyType)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sold">Bán máy</SelectItem>
                    <SelectItem value="repair">Sửa chữa</SelectItem>
                    <SelectItem value="extension">Gia hạn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="qw-bulk-start">Ngày bắt đầu</Label>
                <Input
                  id="qw-bulk-start"
                  type="date"
                  value={bulkStartDate}
                  onChange={(e) => setBulkStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="qw-bulk-months">Số tháng (mặc định)</Label>
                <Input
                  id="qw-bulk-months"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={bulkMonths}
                  onChange={(e) => {
                    monthsTouched.current = true;
                    setBulkMonths(Number(e.target.value));
                  }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <Label>Danh sách máy</Label>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={copyTemplate}
                    className="h-8 text-xs"
                  >
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy mẫu
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={downloadTemplate}
                    className="h-8 text-xs"
                  >
                    <Download className="mr-1 h-3.5 w-3.5" /> Tải mẫu
                  </Button>
                </div>
              </div>
              <Textarea
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
                placeholder={QUICK_BULK_TEMPLATE_EXAMPLE}
                className="min-h-[180px] font-mono text-xs"
              />
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                <Badge variant="secondary" className="font-mono">
                  {QUICK_BULK_TEMPLATE_HEADER}
                </Badge>
                <span>•</span>
                <span>
                  {bulkRows.length} dòng hợp lệ
                  {bulkText && bulkRows.length === 0 ? " (kiểm tra lại định dạng)" : ""}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Có thể dán: (1){" "}
                <code>tên máy | tên khách | SĐT | tháng | ngày bắt đầu</code>,
                (2) tin Telegram 1 dòng <code>máy - tên SĐT</code>, hoặc (3) block
                3 dòng{" "}
                <code>ngày bắt đầu / mô tả máy bh2th / tên SĐT</code> copy từ
                group. Không có ngày từng dòng → dùng ô &quot;Ngày bắt đầu&quot;
                phía trên. SĐT trùng → gắn khách cũ.
              </p>
            </div>

            {bulkRows.length > 0 ? (
              <div className="max-h-40 overflow-y-auto rounded-md border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-2 py-1.5">Tên máy</th>
                      <th className="px-2 py-1.5">Tên khách</th>
                      <th className="px-2 py-1.5">SĐT</th>
                      <th className="px-2 py-1.5">Bắt đầu / tháng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bulkRows.slice(0, 50).map((r, i) => {
                      const start = r.startDate ?? bulkStartDate;
                      const startLabel = start
                        .split("-")
                        .reverse()
                        .join("/");
                      return (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1.5">{r.name}</td>
                        <td className="px-2 py-1.5">{r.customerName ?? "—"}</td>
                        <td className="px-2 py-1.5 font-mono">{r.phone ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          {`${startLabel} · ${r.months ?? bulkMonths} th`}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
                {bulkRows.length > 50 ? (
                  <p className="px-2 py-1.5 text-[11px] text-muted-foreground">
                    … và {bulkRows.length - 50} dòng nữa
                  </p>
                ) : null}
              </div>
            ) : null}

            {bulkErrors.length > 0 ? (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs">
                <p className="mb-1 font-medium text-destructive">
                  {bulkErrors.length} dòng bị lỗi, không tạo được:
                </p>
                <ul className="space-y-0.5 text-muted-foreground">
                  {bulkErrors.slice(0, 20).map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Huỷ
          </Button>
          {mode === "single" ? (
            <Button onClick={handleSubmitSingle} disabled={submitting}>
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Tạo bảo hành
            </Button>
          ) : (
            <Button
              onClick={handleSubmitBulk}
              disabled={submitting || bulkRows.length === 0}
            >
              {submitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Tạo {bulkRows.length} bảo hành
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
