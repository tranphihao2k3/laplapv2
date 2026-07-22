"use client";

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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { httpGet, httpPatch, httpPost, httpDelete } from "@/lib/api/http";
import { buildHeroSlide, HERO_TEMPLATES, type HomepageHeroSetting } from "@/lib/homepage-hero";
import type { Paginated } from "@/lib/api/response";

// ====== Types ======
type Shop = {
  id: string;
  organization_id: string | null;
  name: string;
  code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
  is_active: boolean | null;
};

type Organization = {
  id: string;
  name: string;
  code: string | null;
  tax_code: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  website: string | null;
  is_active: boolean | null;
  parent_id: string | null;
};

type Setting = {
  id: string;
  organization_id: string | null;
  shop_id: string | null;
  group_name: string | null;
  key: string | null;
  value: unknown;
  created_at?: string | null;
};

// ====== Helpers ======
function getApiErrorMsg(e: unknown) {
  const err = e as { error?: { message?: string } };
  return err?.error?.message ?? "Có lỗi xảy ra";
}

// ====== Page ======
export default function SettingsPage() {
  return (
    <Tabs defaultValue="shop" className="space-y-4">
      <div className="overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <TabsList className="w-max">
          <TabsTrigger value="shop">Thông tin cửa hàng</TabsTrigger>
          <TabsTrigger value="org">Tổ chức</TabsTrigger>
          <TabsTrigger value="config">Cấu hình hệ thống</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="shop">
        <ShopSettings />
      </TabsContent>
      <TabsContent value="org">
        <OrgSettings />
      </TabsContent>
      <TabsContent value="config">
        <SystemSettings />
      </TabsContent>
    </Tabs>
  );
}

// ====== Shop tab ======
function ShopSettings() {
  const qc = useQueryClient();
  const shopsQ = useQuery({
    queryKey: ["settings-shops"],
    queryFn: () => httpGet<Paginated<Shop>>("/v1/shops", { page: 1, pageSize: 50 }),
  });

  const shops = shopsQ.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = shops.find((s) => s.id === selectedId) ?? shops[0] ?? null;

  useEffect(() => {
    if (!selectedId && shops[0]) setSelectedId(shops[0].id);
  }, [shops, selectedId]);

  const [form, setForm] = useState<Partial<Shop>>({});
  useEffect(() => {
    if (selected) setForm({ ...selected });
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Shop> }) =>
      httpPatch<Shop>(`/v1/shops/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-shops"] });
      toast.success("Đã lưu thông tin cửa hàng");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const create = useMutation({
    mutationFn: (body: Partial<Shop>) => httpPost<Shop>("/v1/shops", body),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["settings-shops"] });
      setSelectedId(data.id);
      toast.success("Đã thêm cửa hàng");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const [newOpen, setNewOpen] = useState(false);
  const [newForm, setNewForm] = useState<Partial<Shop>>({ is_active: true });

  function set<K extends keyof Shop>(k: K, v: Shop[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">Cửa hàng</CardTitle>
          <Button size="sm" onClick={() => setNewOpen(true)}>
            + Thêm
          </Button>
        </CardHeader>
        <CardContent className="space-y-1 p-2">
          {shopsQ.isLoading ? (
            <div className="p-3 text-sm text-muted-foreground">Đang tải...</div>
          ) : shops.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Chưa có cửa hàng nào
            </div>
          ) : (
            shops.map((s) => (
              <button
                key={s.id}
                onClick={() => setSelectedId(s.id)}
                className={`flex w-full flex-col items-start rounded-md px-3 py-2 text-left text-sm hover:bg-muted ${
                  s.id === selected?.id ? "bg-muted font-medium" : ""
                }`}
              >
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.code ?? "—"} · {s.is_active ? "Hoạt động" : "Tạm ngưng"}
                </span>
              </button>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Thông tin cửa hàng</CardTitle>
          <CardDescription>
            Cập nhật tên, liên hệ, địa chỉ hiển thị trên hoá đơn và phiếu bảo hành.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selected ? (
            <p className="text-sm text-muted-foreground">
              Chọn một cửa hàng để chỉnh sửa.
            </p>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Tên cửa hàng" required>
                <Input
                  value={form.name ?? ""}
                  onChange={(e) => set("name", e.target.value)}
                />
              </Field>
              <Field label="Mã cửa hàng">
                <Input
                  value={form.code ?? ""}
                  onChange={(e) => set("code", e.target.value || null)}
                  placeholder="LPL-CT01"
                />
              </Field>
              <Field label="Số điện thoại">
                <Input
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value || null)}
                  placeholder="0123 456 789"
                />
              </Field>
              <Field label="Email">
                <Input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value || null)}
                />
              </Field>
              <Field label="Địa chỉ" className="sm:col-span-2">
                <Input
                  value={form.address ?? ""}
                  onChange={(e) => set("address", e.target.value || null)}
                  placeholder="123 đường ABC, Quận 1, TP.HCM"
                />
              </Field>
              <Field label="Múi giờ">
                <Input
                  value={form.timezone ?? ""}
                  onChange={(e) => set("timezone", e.target.value || null)}
                  placeholder="Asia/Ho_Chi_Minh"
                />
              </Field>
              <Field label="Trạng thái">
                <Select
                  value={String(form.is_active ?? true)}
                  onValueChange={(v) => set("is_active", v === "true")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Hoạt động</SelectItem>
                    <SelectItem value="false">Tạm ngưng</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <div className="sm:col-span-2 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => selected && setForm({ ...selected })}
                >
                  Hoàn tác
                </Button>
                <Button
                  disabled={update.isPending}
                  onClick={() =>
                    selected &&
                    update.mutate({
                      id: selected.id,
                      body: {
                        name: form.name,
                        code: form.code ?? null,
                        phone: form.phone ?? null,
                        email: form.email ?? null,
                        address: form.address ?? null,
                        timezone: form.timezone ?? null,
                        is_active: form.is_active ?? true,
                      },
                    })
                  }
                >
                  {update.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={newOpen} onOpenChange={setNewOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Thêm cửa hàng</DialogTitle>
            <DialogDescription>
              Mã cửa hàng phải duy nhất trong hệ thống.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Tên cửa hàng" required>
              <Input
                value={newForm.name ?? ""}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Mã" required>
              <Input
                value={newForm.code ?? ""}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, code: e.target.value }))
                }
                placeholder="LPL-CT02"
              />
            </Field>
            <Field label="SĐT">
              <Input
                value={newForm.phone ?? ""}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, phone: e.target.value || null }))
                }
              />
            </Field>
            <Field label="Email">
              <Input
                value={newForm.email ?? ""}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, email: e.target.value || null }))
                }
              />
            </Field>
            <Field label="Địa chỉ" className="sm:col-span-2">
              <Input
                value={newForm.address ?? ""}
                onChange={(e) =>
                  setNewForm((p) => ({ ...p, address: e.target.value || null }))
                }
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewOpen(false)}>
              Huỷ
            </Button>
            <Button
              disabled={create.isPending || !newForm.name || !newForm.code}
              onClick={() => {
                create.mutate(newForm, {
                  onSuccess: () => {
                    setNewOpen(false);
                    setNewForm({ is_active: true });
                  },
                });
              }}
            >
              Tạo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====== Organization tab ======
function OrgSettings() {
  const qc = useQueryClient();
  const orgsQ = useQuery({
    queryKey: ["settings-orgs"],
    queryFn: () =>
      httpGet<Paginated<Organization>>("/v1/organizations", { page: 1, pageSize: 50 }),
  });
  const orgs = orgsQ.data?.items ?? [];
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const org = orgs.find((o) => o.id === selectedId) ?? orgs[0] ?? null;

  useEffect(() => {
    if (!selectedId && orgs[0]) setSelectedId(orgs[0].id);
  }, [orgs, selectedId]);

  const [form, setForm] = useState<Partial<Organization>>({});
  useEffect(() => {
    if (org) setForm({ ...org });
  }, [org?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Partial<Organization> }) =>
      httpPatch<Organization>(`/v1/organizations/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-orgs"] });
      toast.success("Đã cập nhật tổ chức");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  function set<K extends keyof Organization>(k: K, v: Organization[K]) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Thông tin tổ chức</CardTitle>
        <CardDescription>
          Chọn tổ chức để chỉnh sửa. Thông tin này xuất hiện trên hoá đơn cấp doanh nghiệp.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {orgsQ.isLoading ? (
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        ) : orgs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có tổ chức nào được tạo.</p>
        ) : (
          <div className="space-y-6">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Label className="shrink-0">Chọn tổ chức:</Label>
              <Select value={org?.id ?? ""} onValueChange={setSelectedId}>
                <SelectTrigger className="w-full sm:w-72">
                  <SelectValue placeholder="Chọn tổ chức" />
                </SelectTrigger>
                <SelectContent>
                  {orgs.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name} ({o.code ?? "—"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {org && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Tên tổ chức" required>
                  <Input value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} />
                </Field>
                <Field label="Mã tổ chức">
                  <Input value={form.code ?? ""} onChange={(e) => set("code", e.target.value || null)} />
                </Field>
                <Field label="Mã số thuế">
                  <Input value={form.tax_code ?? ""} onChange={(e) => set("tax_code", e.target.value || null)} />
                </Field>
                <Field label="Tax ID">
                  <Input value={form.tax_id ?? ""} onChange={(e) => set("tax_id", e.target.value || null)} />
                </Field>
                <Field label="Số điện thoại">
                  <Input value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value || null)} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value || null)} />
                </Field>
                <Field label="Website" className="sm:col-span-2">
                  <Input value={form.website ?? ""} onChange={(e) => set("website", e.target.value || null)} placeholder="https://example.com" />
                </Field>
                <Field label="Địa chỉ" className="sm:col-span-2">
                  <textarea
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    value={form.address ?? ""}
                    onChange={(e) => set("address", e.target.value || null)}
                    placeholder="123 đường ABC, Quận 1, TP.HCM"
                  />
                </Field>
                <Field label="Trạng thái">
                  <Select value={String(form.is_active ?? true)} onValueChange={(v) => set("is_active", v === "true")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="true">Hoạt động</SelectItem>
                      <SelectItem value="false">Tạm ngưng</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <div className="sm:col-span-2 flex justify-end gap-2">
                  <Button variant="outline" onClick={() => org && setForm({ ...org })}>
                    Hoàn tác
                  </Button>
                  <Button
                    disabled={update.isPending}
                    onClick={() => {
                      if (!org) return;
                      update.mutate({
                        id: org.id,
                        body: {
                          name: form.name,
                          code: form.code ?? null,
                          tax_code: form.tax_code ?? null,
                          tax_id: form.tax_id ?? null,
                          phone: form.phone ?? null,
                          email: form.email ?? null,
                          website: form.website ?? null,
                          address: form.address ?? null,
                          is_active: form.is_active ?? true,
                        },
                      });
                    }}
                  >
                    {update.isPending ? "Đang lưu..." : "Lưu thay đổi"}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ====== System settings tab ======
const COMMON_KEYS: Array<{ key: string; label: string; group: string; hint?: string; multiline?: boolean }> = [
  { key: "default_warranty_months", label: "Bảo hành mặc định (tháng)", group: "warranty", hint: "Số tháng áp dụng khi sản phẩm không khai báo bảo hành riêng" },
  { key: "receipt.shop_name", label: "Tên hiển thị hoá đơn", group: "receipt" },
  { key: "receipt.stamp_text", label: "Chữ trong dấu mộc", group: "receipt", hint: "Chữ hiển thị bên trong con dấu tròn (VD tên viết tắt cửa hàng)" },
  { key: "receipt.footer", label: "Lời cảm ơn cuối hoá đơn", group: "receipt" },
  { key: "receipt.policy", label: "Chính sách bảo hành / đổi trả", group: "receipt", hint: "Mỗi dòng 1 mục. Bỏ trống sẽ dùng chính sách mặc định.", multiline: true },
  { key: "loyalty.points_per_vnd", label: "Số VND đổi 1 điểm", group: "loyalty", hint: "Mặc định 10000" },
];

function SystemSettings() {
  const qc = useQueryClient();
  const [scope, setScope] = useState<"org" | "shop">("org");
  const [scopeShopId, setScopeShopId] = useState<string | null>(null);

  const shopsQ = useQuery({
    queryKey: ["settings-shops"],
    queryFn: () => httpGet<Paginated<Shop>>("/v1/shops", { page: 1, pageSize: 50 }),
  });
  const shops = shopsQ.data?.items ?? [];

  function handleScopeChange(v: string) {
    setScope(v as "org" | "shop");
    if (v === "shop" && shops.length > 0) {
      setScopeShopId(shops[0].id);
    } else {
      setScopeShopId(null);
    }
  }

  const settingsFilter = scope === "shop" && scopeShopId ? { shop_id: scopeShopId } : {};

  const settingsQ = useQuery({
    queryKey: ["settings-config", scope, scopeShopId],
    queryFn: () =>
      httpGet<Paginated<Setting>>("/v1/settings", { page: 1, pageSize: 100, ...settingsFilter }),
  });
  const items = settingsQ.data?.items ?? [];

  const byKey = useMemo(() => {
    const m = new Map<string, Setting>();
    for (const s of items) if (s.key) m.set(s.key, s);
    return m;
  }, [items]);

  const heroSetting = useMemo<HomepageHeroSetting | undefined>(() => {
    const raw = byKey.get("homepage.hero")?.value;
    if (!raw) return undefined;
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw) as HomepageHeroSetting;
      } catch {
        return undefined;
      }
    }
    if (typeof raw === "object" && raw !== null) {
      return raw as HomepageHeroSetting;
    }
    return undefined;
  }, [byKey]);

  const defaultHero = useMemo<HomepageHeroSetting>(() => {
    const slide = buildHeroSlide();
    return {
      template: slide.id,
      eyebrow: slide.eyebrow,
      title: slide.title,
      sub: slide.sub,
      cta: slide.cta,
      href: slide.href,
      image: slide.image,
    };
  }, []);

  const [heroForm, setHeroForm] = useState<HomepageHeroSetting>(heroSetting ?? defaultHero);
  useEffect(() => {
    setHeroForm(heroSetting ?? defaultHero);
  }, [heroSetting, defaultHero]);

  const heroSettingId = byKey.get("homepage.hero")?.id;

  function setHeroField<K extends keyof HomepageHeroSetting>(key: K, value: HomepageHeroSetting[K]) {
    setHeroForm((prev) => ({ ...prev, [key]: value }));
  }

  const upsert = useMutation({
    mutationFn: async (input: { key: string; group: string; value: unknown }) => {
      const payload: Record<string, unknown> = {
        value: input.value,
        group_name: input.group,
      };
      if (scope === "shop" && scopeShopId) payload.shop_id = scopeShopId;
      const existing = byKey.get(input.key);
      if (existing) {
        return httpPatch<Setting>(`/v1/settings/${existing.id}`, payload);
      }
      return httpPost<Setting>("/v1/settings", {
        key: input.key,
        value: input.value,
        group_name: input.group,
        ...payload,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-config"] });
      toast.success("Đã lưu cấu hình");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  const del = useMutation({
    mutationFn: (id: string) => httpDelete(`/v1/settings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["settings-config"] });
      toast.success("Đã xoá");
    },
    onError: (e) => toast.error(getApiErrorMsg(e)),
  });

  // Track only user-modified values; fall back to server data otherwise.
  // No useEffect here — avoids re-render cascade that triggers Radix Select ref loop.
  const [dirtyValues, setDirtyValues] = useState<Record<string, string>>({});
  function getDisplayValue(key: string): string {
    if (key in dirtyValues) return dirtyValues[key];
    const v = byKey.get(key)?.value;
    return v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
  }

  // Custom new entry
  const [customOpen, setCustomOpen] = useState(false);
  const [customForm, setCustomForm] = useState({ key: "", value: "", group: "" });

  function saveCommon(k: { key: string; group: string }) {
    const raw = getDisplayValue(k.key).trim();
    let parsed: unknown = raw;
    if (k.key === "default_warranty_months" || k.key === "loyalty.points_per_vnd") {
      const n = Number(raw);
      if (Number.isFinite(n)) parsed = n;
    } else {
      if (raw.startsWith("{") || raw.startsWith("[")) {
        try {
          parsed = JSON.parse(raw);
        } catch {
          /* keep string */
        }
      }
    }
    upsert.mutate({ key: k.key, group: k.group, value: parsed });
  }

  const heroTemplate = HERO_TEMPLATES.find((t) => t.id === (heroForm.template ?? 0)) ?? HERO_TEMPLATES[0];
  const customItems = items.filter(
    (s) => s.key && !COMMON_KEYS.some((c) => c.key === s.key),
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Banner trang chủ</CardTitle>
          <CardDescription>
            Chọn mẫu banner, chỉnh tiêu đề, mô tả và ảnh. Lưu để cập nhật ngay trang chủ.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
            <div className="space-y-4">
              <div>
                <Label>Chọn mẫu banner</Label>
                <Select
                  value={String(heroForm.template ?? 0)}
                  onValueChange={(value) => setHeroField("template", Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Chọn mẫu banner" />
                  </SelectTrigger>
                  <SelectContent>
                    {HERO_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={String(template.id)}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Eyebrow">
                  <Input
                    value={heroForm.eyebrow ?? heroTemplate.defaults.eyebrow}
                    onChange={(e) => setHeroField("eyebrow", e.target.value)}
                    placeholder={heroTemplate.defaults.eyebrow}
                  />
                </Field>
                <Field label="Button text">
                  <Input
                    value={heroForm.cta ?? heroTemplate.defaults.cta}
                    onChange={(e) => setHeroField("cta", e.target.value)}
                    placeholder={heroTemplate.defaults.cta}
                  />
                </Field>
                <Field label="URL nút" className="sm:col-span-2">
                  <Input
                    value={heroForm.href ?? heroTemplate.defaults.href}
                    onChange={(e) => setHeroField("href", e.target.value)}
                    placeholder={heroTemplate.defaults.href}
                  />
                </Field>
                <Field label="Tiêu đề dòng 1" className="sm:col-span-2">
                  <Input
                    value={heroForm.title?.[0] ?? heroTemplate.defaults.title[0]}
                    onChange={(e) => setHeroField("title", [e.target.value, heroForm.title?.[1] ?? heroTemplate.defaults.title[1]])}
                    placeholder={heroTemplate.defaults.title[0]}
                  />
                </Field>
                <Field label="Tiêu đề dòng 2" className="sm:col-span-2">
                  <Input
                    value={heroForm.title?.[1] ?? heroTemplate.defaults.title[1]}
                    onChange={(e) => setHeroField("title", [heroForm.title?.[0] ?? heroTemplate.defaults.title[0], e.target.value])}
                    placeholder={heroTemplate.defaults.title[1]}
                  />
                </Field>
                <Field label="Mô tả" className="sm:col-span-2">
                  <Input
                    value={heroForm.sub ?? heroTemplate.defaults.sub}
                    onChange={(e) => setHeroField("sub", e.target.value)}
                    placeholder={heroTemplate.defaults.sub}
                  />
                </Field>
                <Field label="Ảnh" className="sm:col-span-2">
                  <Input
                    value={heroForm.image ?? ""}
                    onChange={(e) => setHeroField("image", e.target.value || undefined)}
                    placeholder="https://..."
                  />
                </Field>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 text-sm font-semibold">Xem trước</div>
              <div className="rounded-3xl bg-slate-50 p-4">
                <div className={"rounded-3xl p-5 " + heroTemplate.bg}>
                  <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-600">
                    {heroForm.eyebrow ?? heroTemplate.defaults.eyebrow}
                  </div>
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-slate-900">{heroForm.title?.[0] ?? heroTemplate.defaults.title[0]}</div>
                    <div className="text-lg font-bold text-slate-900">{heroForm.title?.[1] ?? heroTemplate.defaults.title[1]}</div>
                  </div>
                  <div className="mt-3 text-sm text-slate-600">{heroForm.sub ?? heroTemplate.defaults.sub}</div>
                  <div className="mt-4 inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                    {heroForm.cta ?? heroTemplate.defaults.cta}
                  </div>
                  {heroForm.image ? (
                    <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
                      <img src={heroForm.image} alt="Hero preview" className="h-40 w-full object-cover" />
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" onClick={() => setHeroForm(heroSetting ?? defaultHero)}>
              Hoàn tác
            </Button>
            <Button
              onClick={() =>
                upsert.mutate({
                  key: "homepage.hero",
                  group: "homepage",
                  value: heroForm,
                })
              }
              disabled={upsert.isPending}
            >
              {upsert.isPending ? "Đang lưu..." : "Lưu banner"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cấu hình hệ thống</CardTitle>
          <CardDescription>
            Thiết lập tham số cho POS, hoá đơn, bảo hành và loyalty.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex items-center gap-2">
              <Label className="shrink-0">Phạm vi:</Label>
              <Select value={scope} onValueChange={handleScopeChange}>
                <SelectTrigger className="w-full sm:w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="org">Toàn tổ chức</SelectItem>
                  <SelectItem value="shop">Theo cửa hàng</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scope === "shop" && (
              <div className="flex items-center gap-2">
                <Label className="shrink-0">Cửa hàng:</Label>
                <Select value={scopeShopId ?? ""} onValueChange={setScopeShopId}>
                  <SelectTrigger className="w-full sm:w-56">
                    <SelectValue placeholder="Chọn cửa hàng" />
                  </SelectTrigger>
                  <SelectContent>
                    {shops.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} ({s.code ?? "—"})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {COMMON_KEYS.map((k) => (
              <div key={k.key} className="space-y-2 rounded-md border p-3">
                <Label>{k.label}</Label>
                {k.multiline ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={4}
                      value={getDisplayValue(k.key)}
                      onChange={(e) => setDirtyValues((p) => ({ ...p, [k.key]: e.target.value }))}
                      placeholder={k.hint}
                    />
                    <Button size="sm" onClick={() => saveCommon(k)} disabled={upsert.isPending || (scope === "shop" && !scopeShopId)}>
                      Lưu
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <Input
                      value={getDisplayValue(k.key)}
                      onChange={(e) => setDirtyValues((p) => ({ ...p, [k.key]: e.target.value }))}
                      placeholder={k.hint}
                    />
                    <Button size="sm" onClick={() => saveCommon(k)} disabled={upsert.isPending || (scope === "shop" && !scopeShopId)}>
                      Lưu
                    </Button>
                  </div>
                )}
                <div className="text-xs text-muted-foreground">
                  Mã: <code className="rounded bg-muted px-1">{k.key}</code>
                  {scope === "shop" && scopeShopId && (
                    <span> · Áp dụng cho cửa hàng</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Cấu hình tuỳ chỉnh</CardTitle>
            <CardDescription>
              Các key/value khác. Giá trị JSON hợp lệ sẽ được parse tự động.
            </CardDescription>
          </div>
          <Button className="w-full sm:w-auto" onClick={() => setCustomOpen(true)} disabled={scope === "shop" && !scopeShopId}>
            + Thêm cấu hình
          </Button>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nhóm</TableHead>
                <TableHead>Mã</TableHead>
                <TableHead>Giá trị</TableHead>
                <TableHead>Phạm vi</TableHead>
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    {settingsQ.isLoading ? "Đang tải..." : "Chưa có cấu hình tuỳ chỉnh nào"}
                  </TableCell>
                </TableRow>
              ) : (
                customItems.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>{s.group_name ?? "—"}</TableCell>
                    <TableCell className="font-mono text-sm">{s.key}</TableCell>
                    <TableCell className="max-w-md truncate font-mono text-xs">
                      {typeof s.value === "object" ? JSON.stringify(s.value) : String(s.value ?? "")}
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {s.shop_id ? "Cửa hàng" : "Tổ chức"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="destructive" onClick={() => del.mutate(s.id)}>
                        Xoá
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Thêm cấu hình tuỳ chỉnh</DialogTitle>
            <DialogDescription>
              Key duy nhất, value có thể là số / chuỗi / JSON.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <Field label="Nhóm">
              <Input
                value={customForm.group}
                onChange={(e) => setCustomForm((p) => ({ ...p, group: e.target.value }))}
                placeholder="receipt / pos / loyalty..."
              />
            </Field>
            <Field label="Mã (key)" required>
              <Input
                value={customForm.key}
                onChange={(e) => setCustomForm((p) => ({ ...p, key: e.target.value }))}
                placeholder="receipt.footer"
              />
            </Field>
            <Field label="Giá trị" required>
              <Input
                value={customForm.value}
                onChange={(e) => setCustomForm((p) => ({ ...p, value: e.target.value }))}
                placeholder='Ví dụ: "LapLap Cần Thơ" hoặc 12 hoặc {"a":1}'
              />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCustomOpen(false)}>Huỷ</Button>
            <Button
              disabled={!customForm.key || upsert.isPending}
              onClick={() => {
                let val: unknown = customForm.value;
                if (customForm.value.trim().startsWith("{") || customForm.value.trim().startsWith("[")) {
                  try { val = JSON.parse(customForm.value); } catch { /* keep string */ }
                } else if (!Number.isNaN(Number(customForm.value)) && customForm.value.trim() !== "") {
                  val = Number(customForm.value);
                }
                upsert.mutate(
                  { key: customForm.key, group: customForm.group, value: val },
                  {
                    onSuccess: () => {
                      setCustomOpen(false);
                      setCustomForm({ key: "", value: "", group: "" });
                    },
                  },
                );
              }}
            >
              Lưu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====== Field component ======
function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-2 ${className ?? ""}`}>
      <Label>
        {label} {required ? <span className="text-destructive">*</span> : null}
      </Label>
      {children}
    </div>
  );
}
