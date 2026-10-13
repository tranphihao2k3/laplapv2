"use client";

/**
 * LegalSettings — UI chỉnh thông tin pháp lý + Bộ Công Thương.
 *
 * Theo Nghị định 52/2013 (sửa đổi bởi 85/2021) Điều 29, website TMĐT bán hàng
 * có chức năng đặt hàng trực tuyến BẮT BUỘC công khai:
 *   - Tên thương nhân / tên doanh nghiệp
 *   - Địa chỉ, SĐT, email
 *   - MST, Số GCN ĐKDN, ngày cấp, nơi cấp
 *   - Họ tên người chịu trách nhiệm nội dung
 *   - Logo "Đã thông báo/đăng ký với Bộ Công Thương" trỏ về online.gov.vn
 *
 * Lưu vào bảng `settings` với group_name = "legal" và key = "legal.<field>".
 * Đọc bởi `getStoreInfo()` (lib/store-info.ts) → truyền xuống footer + contact page.
 *
 * Sau khi lưu:
 *   - Server: revalidateTag("store-legal")  (cần gọi qua server action / api)
 *   - Client: invalidateBrandCache() để các tab đang mở refresh ngay
 */

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Save, ShieldCheck, Building2, FileText, User } from "lucide-react";
import { httpGet, httpPatch, httpPost } from "@/lib/api/http";
import { invalidateBrandCache } from "@/lib/brand-cache-invalidation";
import type { Paginated } from "@/lib/api/response";

type Setting = {
  id: string;
  organization_id: string | null;
  shop_id: string | null;
  group_name: string | null;
  key: string | null;
  value: unknown;
};

type LegalForm = {
  business_name: string;
  tax_id: string;
  business_registration_number: string;
  business_registration_issued_by: string;
  business_registration_issued_date: string;
  legal_representative: string;
  legal_representative_title: string;
  content_manager_phone: string;
  content_manager_email: string;
  bo_cong_thuong_url: string;
  bo_cong_thuong_notified_at: string;
};

const DEFAULTS: LegalForm = {
  business_name: "",
  tax_id: "",
  business_registration_number: "",
  business_registration_issued_by: "",
  business_registration_issued_date: "",
  legal_representative: "",
  legal_representative_title: "Giám đốc",
  content_manager_phone: "",
  content_manager_email: "",
  bo_cong_thuong_url: "",
  bo_cong_thuong_notified_at: "",
};

function asString(v: unknown): string {
  if (typeof v === "string") return v;
  if (typeof v === "number") return String(v);
  return "";
}

export function LegalSettings() {
  const qc = useQueryClient();

  // Load toàn bộ settings thuộc group "legal"
  const settingsQ = useQuery({
    queryKey: ["settings-legal"],
    queryFn: () =>
      httpGet<Paginated<Setting>>("/v1/settings", {
        page: 1,
        pageSize: 100,
        group_name: "legal",
      }),
  });

  // items reference phải ổn định để làm dep cho useMemo bên dưới.
  const items = useMemo(
    () => settingsQ.data?.items ?? [],
    [settingsQ.data],
  );

  // Map key -> Setting để PATCH hoặc POST. Memo để tránh tạo Map mới mỗi
  // render (gây re-render cascade) và ổn định identity khi chưa có data mới.
  const byKey = useMemo(() => {
    const m = new Map<string, Setting>();
    for (const s of items) if (s.key) m.set(s.key, s);
    return m;
  }, [items]);

  // Snapshot giá trị ban đầu từ server (chỉ set 1 lần khi data load xong).
  // Dùng snapshot này làm baseline cho so sánh "field có thay đổi không"
  // thay vì so với DEFAULTS rỗng — tránh bỏ sót trường hợp admin xoá nội
  // dung đã lưu trước đó về rỗng (vì rỗng === DEFAULTS).
  const [initial, setInitial] = useState<LegalForm | null>(null);
  const [form, setForm] = useState<LegalForm>(DEFAULTS);

  useEffect(() => {
    if (!settingsQ.data) return;
    const next: LegalForm = { ...DEFAULTS };
    for (const s of items) {
      if (!s.key || !s.key.startsWith("legal.")) continue;
      const field = s.key.replace(/^legal\./, "") as keyof LegalForm;
      if (field in next) {
        next[field] = asString(s.value);
      }
    }
    setInitial((prev) => prev ?? next);
    setForm((prev) => {
      // Chỉ sync từ server khi form chưa bị user edit. Nếu user đã gõ và
      // ta vừa lưu xong, server data sẽ giống form rồi → không cần ghi đè.
      if (prev === DEFAULTS || prev === initial) {
        return next;
      }
      return prev;
    });
  }, [settingsQ.data, items]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof LegalForm>(key: K, value: LegalForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Mutation lưu 1 field. Sau khi lưu xong tất cả fields, gọi brand cache invalidation.
  const upsert = useMutation({
    mutationFn: async (input: {
      key: keyof LegalForm;
      value: string;
      byKey: Map<string, Setting>;
    }) => {
      const fullKey = `legal.${String(input.key)}`;
      const payload = { value: input.value, group_name: "legal" };
      const existing = input.byKey.get(fullKey);
      if (existing) {
        return httpPatch<Setting>(`/v1/settings/${existing.id}`, payload);
      }
      return httpPost<Setting>("/v1/settings", { ...payload, key: fullKey });
    },
  });

  // Gọi /api/admin/revalidate-legal để revalidate server cache (footer + trade badge)
  const revalidateServer = useMutation({
    mutationFn: async () => {
      // best-effort: nếu endpoint chưa có thì bỏ qua — vẫn OK vì cache tự expire 1h
      try {
        await fetch("/api/admin/revalidate-legal", { method: "POST" });
      } catch {
        // ignore
      }
    },
  });

  const isSaving = upsert.isPending || revalidateServer.isPending;
  // Disable Save cho đến khi initial snapshot từ server sẵn sàng — tránh
  // trường hợp user save ngay khi mở form sẽ skip nhầm field vì baseline
  // còn là DEFAULTS rỗng.
  const canSave = !settingsQ.isLoading && initial !== null;

  async function handleSave() {
    try {
      // Lưu từng field. So sánh với `initial` (snapshot từ server) thay vì
      // `DEFAULTS` rỗng — nếu admin sửa field rồi lưu, sau đó xoá về rỗng,
      // ta vẫn phải PATCH để đồng bộ server. Nếu chưa load xong initial,
      // fallback về DEFAULTS để tránh skip nhầm.
      const baseline = initial ?? DEFAULTS;
      // Dùng byKey hiện tại cho field đầu tiên; các field sau sẽ dùng byKey
      // đã được rebuild bằng cách invalidate query trước mỗi mutation.
      let currentByKey = byKey;
      for (const key of Object.keys(DEFAULTS) as Array<keyof LegalForm>) {
        const value = form[key];
        if (value === baseline[key]) continue; // unchanged so skip
        await upsert.mutateAsync({ key, value, byKey: currentByKey });
        // Refresh cache để byKey mới nhất (id của row vừa tạo nếu là POST).
        await qc.invalidateQueries({ queryKey: ["settings-legal"] });
        // Sau khi invalidate, lần render tiếp theo mới có items mới — nhưng
        // chúng ta đang ở trong cùng tick. Lấy snapshot mới từ cache ngay:
        const fresh = qc.getQueryData<Paginated<Setting>>(["settings-legal"]);
        if (fresh) {
          currentByKey = new Map<string, Setting>();
          for (const s of fresh.items) if (s.key) currentByKey.set(s.key, s);
        }
      }
      // Cập nhật initial thành form hiện tại để tránh save lặp lại với
      // giá trị đã lưu.
      setInitial(form);
      // Refresh client cache + clear localStorage
      invalidateBrandCache();
      // Gọi server revalidate để xoá cache footer/store-info ngay
      await revalidateServer.mutateAsync();
      // Refresh query
      qc.invalidateQueries({ queryKey: ["settings-legal"] });
      toast.success("Đã lưu thông tin pháp lý. Footer & trang Liên hệ đã cập nhật.");
    } catch (e) {
      const err = e as { error?: { message?: string } };
      toast.error(err?.error?.message ?? "Lưu thất bại");
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Thông tin pháp lý & Bộ Công Thương</CardTitle>
              <CardDescription>
                Cập nhật tên pháp nhân, MST, người đại diện và link đã thông báo
                Bộ Công Thương. Hiển thị ở footer và trang Liên hệ / Điều khoản.
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleSave} disabled={isSaving || !canSave}>
              <Save className="mr-1 h-4 w-4" />
              {!canSave
                ? "Đang tải..."
                : isSaving
                  ? "Đang lưu..."
                  : "Lưu tất cả"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {settingsQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Đang tải...</p>
          ) : (
            <>
              {/* Doanh nghiệp */}
              <Section
                title="Doanh nghiệp"
                icon={Building2}
                hint="Tên pháp nhân trên hóa đơn, hợp đồng và trang pháp lý."
              >
                <Field label="Tên doanh nghiệp" required full>
                  <Input
                    value={form.business_name}
                    onChange={(e) => set("business_name", e.target.value)}
                    placeholder="CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ ..."
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Mã số thuế" required>
                    <Input
                      value={form.tax_id}
                      onChange={(e) => set("tax_id", e.target.value)}
                      placeholder="0123456789"
                    />
                  </Field>
                  <Field label="Số Giấy CN ĐKDN">
                    <Input
                      value={form.business_registration_number}
                      onChange={(e) =>
                        set("business_registration_number", e.target.value)
                      }
                      placeholder="0123456789"
                    />
                  </Field>
                  <Field label="Nơi cấp">
                    <Input
                      value={form.business_registration_issued_by}
                      onChange={(e) =>
                        set("business_registration_issued_by", e.target.value)
                      }
                      placeholder="Sở Kế hoạch và Đầu tư ..."
                    />
                  </Field>
                  <Field label="Ngày cấp">
                    <Input
                      type="date"
                      value={form.business_registration_issued_date}
                      onChange={(e) =>
                        set("business_registration_issued_date", e.target.value)
                      }
                    />
                  </Field>
                </div>
              </Section>

              {/* Người đại diện */}
              <Section
                title="Người đại diện pháp luật"
                icon={User}
                hint="Hiển thị trên trang Liên hệ và trang pháp lý."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Họ và tên" required>
                    <Input
                      value={form.legal_representative}
                      onChange={(e) => set("legal_representative", e.target.value)}
                      placeholder="Nguyễn Văn A"
                    />
                  </Field>
                  <Field label="Chức vụ">
                    <Input
                      value={form.legal_representative_title}
                      onChange={(e) =>
                        set("legal_representative_title", e.target.value)
                      }
                      placeholder="Giám đốc"
                    />
                  </Field>
                </div>
              </Section>

              {/* Người chịu trách nhiệm nội dung */}
              <Section
                title="Người chịu trách nhiệm nội dung (NN 52/2013 Điều 29)"
                icon={FileText}
                hint="SĐT & email dùng để khách hàng/BCĐT liên hệ về nội dung website."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Số điện thoại" required>
                    <Input
                      value={form.content_manager_phone}
                      onChange={(e) =>
                        set("content_manager_phone", e.target.value)
                      }
                      placeholder="0123 456 789"
                    />
                  </Field>
                  <Field label="Email" required>
                    <Input
                      type="email"
                      value={form.content_manager_email}
                      onChange={(e) =>
                        set("content_manager_email", e.target.value)
                      }
                      placeholder="contact@example.com"
                    />
                  </Field>
                </div>
              </Section>

              {/* Bộ Công Thương */}
              <Section
                title="Đã thông báo / Đăng ký Bộ Công Thương"
                icon={ShieldCheck}
                hint="Logo và link trong footer. URL lấy từ trang tra cứu trên online.gov.vn."
              >
                <Field
                  label="URL trang tra cứu BCT"
                  required
                  full
                  hint="Dán link chi tiết từ online.gov.vn (vd: https://online.gov.vn/Home/App/Details/12345)"
                >
                  <Input
                    value={form.bo_cong_thuong_url}
                    onChange={(e) => set("bo_cong_thuong_url", e.target.value)}
                    placeholder="https://online.gov.vn/Home/App/Details/..."
                  />
                </Field>
                <Field
                  label="Ngày thông báo / đăng ký"
                  hint="Hiển thị phụ trên badge."
                >
                  <Input
                    type="date"
                    value={form.bo_cong_thuong_notified_at}
                    onChange={(e) =>
                      set("bo_cong_thuong_notified_at", e.target.value)
                    }
                  />
                </Field>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                  <p className="font-semibold mb-1">Cách lấy URL:</p>
                  <ol className="list-decimal pl-4 space-y-1">
                    <li>Truy cập https://online.gov.vn → tra cứu doanh nghiệp.</li>
                    <li>Tìm trang chi tiết website đã đăng ký.</li>
                    <li>Copy URL thanh địa chỉ (chứa mã số) → dán vào ô trên.</li>
                  </ol>
                </div>
              </Section>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===== Sub components =====

function Section({
  title,
  hint,
  icon: Icon,
  children,
}: {
  title: string;
  hint?: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 border-b pb-2">
        <Icon className="mt-0.5 h-4 w-4 text-muted-foreground" />
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  children,
  full,
  hint,
  required,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  hint?: string;
  required?: boolean;
}) {
  return (
    <div className={full ? "space-y-2" : "space-y-2"}>
      <Label className="text-sm">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
