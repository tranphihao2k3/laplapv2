"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useCrudCreate, useCrudDelete, useCrudList, useCrudUpdate } from "@/lib/api/admin-crud";

type FieldConfig = {
  key: string;
  label: string;
  placeholder?: string;
};

type CrudEntityPageProps = {
  title: string;
  subtitle: string;
  entity: string;
  fields: FieldConfig[];
  autoSlugFromName?: boolean;
};

type ApiErrorShape = {
  error?: {
    message?: string;
    requestId?: string;
    fields?: Record<string, string[] | undefined>;
  };
};

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function showApiError(payload: unknown) {
  if (typeof payload === "string") {
    toast.error(payload);
    return;
  }
  const api = payload as ApiErrorShape;
  const msg = api?.error?.message ?? "Có lỗi xảy ra";
  const requestId = api?.error?.requestId;
  const fieldMessages = Object.values(api?.error?.fields ?? {})
    .flat()
    .filter(Boolean)
    .join(" · ");
  toast.error(fieldMessages ? `${msg}: ${fieldMessages}` : msg, {
    description: requestId ? `Mã lỗi: ${requestId}` : undefined,
  });
}

export function CrudEntityPage({
  title,
  subtitle,
  entity,
  fields,
  autoSlugFromName = false,
}: CrudEntityPageProps) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>(() =>
    fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}),
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [slugTouched, setSlugTouched] = useState(false);

  const list = useCrudList<Record<string, unknown>>(entity, { search, page: 1, pageSize: 20 });
  const createMutation = useCrudCreate<Record<string, unknown>, Record<string, unknown>>(entity);
  const updateMutation = useCrudUpdate<Record<string, unknown>, Record<string, unknown>>(entity);
  const deleteMutation = useCrudDelete(entity);

  const rows = list.data?.items ?? [];
  const displayFields = fields.slice(0, 4);
  const hasSlugAndName = useMemo(
    () => fields.some((f) => f.key === "name") && fields.some((f) => f.key === "slug"),
    [fields],
  );

  function normalizeInput(input: Record<string, string>) {
    const payload: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(input)) {
      const value = raw.trim();
      if (value === "") {
        payload[key] = undefined;
        continue;
      }
      if (key === "tags") {
        payload[key] = value.split(",").map((v) => v.trim()).filter(Boolean);
        continue;
      }
      if (["cost_price", "selling_price", "weight", "quantity", "unit_cost", "line_total"].includes(key)) {
        payload[key] = Number(value);
        continue;
      }
      if (["is_active"].includes(key)) {
        payload[key] = value === "true";
        continue;
      }
      if (["attributes", "specs", "fields"].includes(key)) {
        try {
          payload[key] = JSON.parse(value);
        } catch {
          payload[key] = value;
        }
        continue;
      }
      payload[key] = value;
    }
    return payload;
  }

  async function onSubmit() {
    try {
      setFieldErrors({});
      const payload = normalizeInput(form);
      if (editingId) {
        await updateMutation.mutateAsync({ id: editingId, input: payload });
        toast.success("Đã cập nhật");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Đã tạo mới");
      }
      setOpen(false);
      setEditingId(null);
      setSlugTouched(false);
      setForm(fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}));
    } catch (e) {
      const api = e as ApiErrorShape;
      const nextErrors = Object.fromEntries(
        Object.entries(api?.error?.fields ?? {}).map(([key, value]) => [key, (value ?? []).filter(Boolean)]),
      ) as Record<string, string[]>;
      setFieldErrors(nextErrors);
      showApiError(e);
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="space-y-1">
            <CardTitle>{title}</CardTitle>
            <CardDescription>{subtitle}</CardDescription>
          </div>
          <div className="flex gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-56"
            />
            <Button
              onClick={() => {
                setEditingId(null);
                setSlugTouched(false);
                setFieldErrors({});
                setForm(fields.reduce((acc, f) => ({ ...acc, [f.key]: "" }), {}));
                setOpen(true);
              }}
            >
              Thêm mới
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                {displayFields.map((f) => (
                  <TableHead key={f.key}>{f.label}</TableHead>
                ))}
                <TableHead className="text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={displayFields.length + 1}
                    className="text-center text-muted-foreground"
                  >
                    {list.isLoading ? "Đang tải..." : "Không có dữ liệu"}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row, idx) => (
                  <TableRow key={String(row.id ?? idx)}>
                    {displayFields.map((f) => (
                      <TableCell key={f.key}>{String(row[f.key] ?? "")}</TableCell>
                    ))}
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingId(String(row.id ?? ""));
                            setSlugTouched(true);
                            setFieldErrors({});
                            setForm((prev) => {
                              const next = { ...prev };
                              for (const f of fields) next[f.key] = String(row[f.key] ?? "");
                              return next;
                            });
                            setOpen(true);
                          }}
                        >
                          Sửa
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={async () => {
                            try {
                              await deleteMutation.mutateAsync(String(row.id));
                              toast.success("Đã xoá bản ghi");
                            } catch (e) {
                              showApiError(e);
                            }
                          }}
                        >
                          Xoá
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingId ? "Cập nhật" : "Tạo mới"}</DialogTitle>
            <DialogDescription>
              {title} — {entity}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => {
              const messages = fieldErrors[f.key] ?? [];
              return (
                <div key={f.key} className="space-y-2">
                  <Label htmlFor={`crud-${f.key}`}>{f.label}</Label>
                  <Input
                    id={`crud-${f.key}`}
                    value={form[f.key] ?? ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      setForm((prev) => {
                        const next = { ...prev, [f.key]: value };
                        if (autoSlugFromName && hasSlugAndName && f.key === "name" && !slugTouched) {
                          next.slug = slugify(value);
                        }
                        return next;
                      });
                      if (f.key === "slug") {
                        setSlugTouched(true);
                      }
                      setFieldErrors((prev) => {
                        if (!prev[f.key]) return prev;
                        const next = { ...prev };
                        delete next[f.key];
                        return next;
                      });
                    }}
                    placeholder={f.placeholder}
                  />
                  {messages.length > 0 ? (
                    <div className="space-y-1 text-sm text-destructive">
                      {messages.map((msg) => (
                        <p key={msg}>{msg}</p>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Huỷ
            </Button>
            <Button
              onClick={onSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {editingId ? "Lưu thay đổi" : "Tạo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
