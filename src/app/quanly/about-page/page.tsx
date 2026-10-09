/**
 * Admin: Quản lý các khối nội dung trang /about.
 *
 * Tính năng:
 *  - Kéo thả (drag-drop) sắp xếp lại vị trí các block.
 *  - Bật/tắt nhanh từng block (ẩn không xoá).
 *  - Thêm block mới với picker theo loại.
 *  - Sửa block qua modal form theo từng loại.
 *  - Xoá block (có xác nhận).
 *
 * Kiến trúc tương tự WordPress Gutenberg: server chỉ quản lý data,
 * mỗi block_type có form riêng, public render tương ứng ở /about.
 */

"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Loader2,
  Save,
  X,
  FileText,
  Type,
  ExternalLink,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  BLOCK_TYPES,
  type PageBlock,
  type BlockType,
} from "@/lib/page-blocks";

const SLUG = "about";

type BlockListItem = PageBlock;

export default function AboutPageAdmin() {
  const qc = useQueryClient();
  const [editId, setEditId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const list = useQuery({
    queryKey: ["admin", "page-blocks", SLUG],
    queryFn: async () => {
      const r = await fetch(`/api/admin/page-blocks?slug=${SLUG}`);
      if (!r.ok) throw new Error("load failed");
      const data = (await r.json()) as { blocks: BlockListItem[] };
      return data.blocks;
    },
  });

  const reorder = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const r = await fetch("/api/admin/page-blocks/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: SLUG, orderedIds }),
      });
      if (!r.ok) throw new Error("reorder failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "page-blocks", SLUG] });
      toast.success("Đã lưu thứ tự");
    },
    onError: () => toast.error("Lỗi khi sắp xếp lại"),
  });

  const toggle = useMutation({
    mutationFn: async (vars: { id: string; enabled: boolean }) => {
      const r = await fetch(`/api/admin/page-blocks/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: vars.enabled }),
      });
      if (!r.ok) throw new Error("toggle failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "page-blocks", SLUG] });
    },
    onError: () => toast.error("Lỗi khi đổi trạng thái"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/page-blocks/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("delete failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "page-blocks", SLUG] });
      toast.success("Đã xoá khối");
    },
    onError: () => toast.error("Lỗi khi xoá"),
  });

  const create = useMutation({
    mutationFn: async (vars: { blockType: BlockType }) => {
      // Khởi tạo data mặc định theo từng loại
      const defaultData = defaultDataFor(vars.blockType);
      const r = await fetch("/api/admin/page-blocks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: SLUG,
          blockType: vars.blockType,
          data: defaultData,
        }),
      });
      if (!r.ok) throw new Error("create failed");
      const data = (await r.json()) as { block: BlockListItem };
      return data.block;
    },
    onSuccess: (block) => {
      qc.invalidateQueries({ queryKey: ["admin", "page-blocks", SLUG] });
      setPickerOpen(false);
      // Mở form edit luôn cho tiện
      setEditId(block.id);
      toast.success("Đã thêm khối — sửa nội dung bên phải");
    },
    onError: () => toast.error("Lỗi khi tạo khối"),
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragEnd = useCallback(
    (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const items = list.data ?? [];
      const oldIdx = items.findIndex((it) => it.id === active.id);
      const newIdx = items.findIndex((it) => it.id === over.id);
      if (oldIdx < 0 || newIdx < 0) return;
      const next = arrayMove(items, oldIdx, newIdx);
      reorder.mutate(next.map((it) => it.id));
    },
    [list.data, reorder],
  );

  const items = list.data ?? [];
  const editing = useMemo(
    () => items.find((it) => it.id === editId) ?? null,
    [items, editId],
  );

  return (
    <div className="container max-w-6xl py-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Trang About</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kéo thả để sắp xếp lại các khối nội dung hiển thị trên trang{" "}
            <a
              href="/about"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
            >
              /about <ExternalLink className="h-3 w-3" />
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <a href="/about" target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4" /> Xem trang
            </a>
          </Button>
          <Button onClick={() => setPickerOpen(true)}>
            <Plus className="h-4 w-4" /> Thêm khối
          </Button>
        </div>
      </header>

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : list.isError ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-6 text-sm text-destructive">
            <AlertCircle className="h-4 w-4" />
            Không tải được danh sách khối.
          </CardContent>
        </Card>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 text-sm text-muted-foreground">
              Chưa có khối nào. Bấm <strong>Thêm khối</strong> để bắt đầu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={items.map((it) => it.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {items.map((it) => (
                <SortableBlock
                  key={it.id}
                  block={it}
                  onEdit={() => setEditId(it.id)}
                  onToggle={(enabled) => toggle.mutate({ id: it.id, enabled })}
                  onDelete={() => {
                    if (confirm(`Xoá khối "${blockLabel(it)}"?`)) {
                      remove.mutate(it.id);
                    }
                  }}
                  isEditing={editId === it.id}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Edit modal */}
      <BlockEditDialog
        block={editing}
        open={!!editing}
        onOpenChange={(o) => {
          if (!o) setEditId(null);
        }}
      />

      {/* Picker modal */}
      <BlockPickerDialog
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onPick={(t) => create.mutate({ blockType: t })}
        isCreating={create.isPending}
      />
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function defaultDataFor(type: BlockType): Record<string, unknown> {
  switch (type) {
    case "hero":
      return {
        badge: "Về chúng tôi",
        title: "Tiêu đề mới",
        subtitle: "Phụ đề (tuỳ chọn)",
        description: "Mô tả ngắn về doanh nghiệp.",
        theme: "dark",
      };
    case "richtext":
      return {
        heading: "Tiêu đề mục",
        alignment: "center",
        paragraphs: ["Nội dung đoạn văn thứ nhất."],
      };
  }
}

function blockLabel(b: PageBlock): string {
  const meta = BLOCK_TYPES.find((bt) => bt.type === b.blockType);
  return meta?.label ?? b.blockType;
}

function blockIcon(type: BlockType) {
  switch (type) {
    case "hero":
      return Type;
    case "richtext":
      return FileText;
  }
}

// ============================================================================
// SortableBlock — 1 dòng trong danh sách, có handle kéo thả
// ============================================================================

function SortableBlock({
  block,
  onEdit,
  onToggle,
  onDelete,
  isEditing,
}: {
  block: BlockListItem;
  onEdit: () => void;
  onToggle: (enabled: boolean) => void;
  onDelete: () => void;
  isEditing: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: block.id });
  const Icon = blockIcon(block.blockType);
  const meta = BLOCK_TYPES.find((bt) => bt.type === block.blockType);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
      }}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-card p-3 transition-shadow",
        isEditing && "border-primary/50 shadow-sm",
        !block.enabled && "opacity-60",
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none rounded p-1.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
        aria-label="Kéo để sắp xếp"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>

      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
        <Icon className="h-4 w-4" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold">
            {meta?.label ?? block.blockType}
          </span>
          <Badge variant="secondary" className="text-[10px]">
            #{block.position + 1}
          </Badge>
          {!block.enabled ? (
            <Badge variant="outline" className="text-[10px]">
              Đã ẩn
            </Badge>
          ) : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {summarize(block)}
        </p>
      </div>

      <div className="flex items-center gap-1">
        <Switch
          checked={block.enabled}
          onCheckedChange={onToggle}
          aria-label="Bật/tắt khối"
        />
        <Button variant="ghost" size="icon" onClick={onEdit} aria-label="Sửa">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={onDelete}
          aria-label="Xoá"
          className="text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function summarize(b: PageBlock): string {
  const d = (b.data ?? {}) as Record<string, unknown>;
  if (b.blockType === "hero") {
    return (d.title as string) || "(chưa có tiêu đề)";
  }
  if (b.blockType === "richtext") {
    const heading = (d.heading as string) || "(không tiêu đề)";
    const paras = Array.isArray(d.paragraphs) ? d.paragraphs.length : 0;
    return `${heading} · ${paras} đoạn`;
  }
  return JSON.stringify(d);
}

// ============================================================================
// BlockPickerDialog — chọn loại block để thêm
// ============================================================================

function BlockPickerDialog({
  open,
  onOpenChange,
  onPick,
  isCreating,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onPick: (t: BlockType) => void;
  isCreating: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thêm khối mới</DialogTitle>
          <DialogDescription>Chọn loại khối muốn thêm vào trang.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {BLOCK_TYPES.map((bt) => {
            const Icon = blockIcon(bt.type);
            return (
              <button
                key={bt.type}
                type="button"
                onClick={() => onPick(bt.type)}
                disabled={isCreating}
                className="flex items-start gap-3 rounded-lg border bg-card p-4 text-left transition-all hover:border-primary/50 hover:shadow-sm disabled:opacity-50"
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold">{bt.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {bt.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
        {isCreating ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Đang tạo...
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// BlockEditDialog — form sửa theo từng loại block
// ============================================================================

function BlockEditDialog({
  block,
  open,
  onOpenChange,
}: {
  block: PageBlock | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const qc = useQueryClient();
  const [data, setData] = useState<Record<string, unknown>>({});
  const [paragraphsText, setParagraphsText] = useState("");

  // Khi mở 1 block, parse data vào form
  useEffect(() => {
    if (!block) return;
    const d = (block.data ?? {}) as Record<string, unknown>;
    if (block.blockType === "richtext") {
      const paras = Array.isArray(d.paragraphs) ? (d.paragraphs as string[]) : [];
      setParagraphsText(paras.join("\n\n"));
    }
    setData(d);
  }, [block]);

  const save = useMutation({
    mutationFn: async (vars: { id: string; data: Record<string, unknown> }) => {
      const r = await fetch(`/api/admin/page-blocks/${vars.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: vars.data }),
      });
      if (!r.ok) throw new Error("save failed");
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "page-blocks", SLUG] });
      toast.success("Đã lưu khối");
      onOpenChange(false);
    },
    onError: () => toast.error("Lỗi khi lưu"),
  });

  if (!block) return null;

  const handleSave = () => {
    if (block.blockType === "richtext") {
      const paragraphs = paragraphsText
        .split(/\n\s*\n/)
        .map((s) => s.trim())
        .filter(Boolean);
      save.mutate({ id: block.id, data: { ...data, paragraphs } });
    } else {
      save.mutate({ id: block.id, data });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Sửa khối: {blockLabel(block)}</DialogTitle>
          <DialogDescription>
            Thay đổi nội dung sẽ áp dụng ngay cho trang /about sau khi lưu.
          </DialogDescription>
        </DialogHeader>

        {block.blockType === "hero" ? (
          <HeroForm data={data} onChange={setData} />
        ) : null}

        {block.blockType === "richtext" ? (
          <RichTextForm
            data={data}
            onChange={setData}
            paragraphsText={paragraphsText}
            onParagraphsChange={setParagraphsText}
          />
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" /> Huỷ
          </Button>
          <Button onClick={handleSave} disabled={save.isPending}>
            {save.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================================
// Form: Hero
// ============================================================================

function HeroForm({
  data,
  onChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Badge (chữ nhỏ phía trên tiêu đề)">
        <Input
          value={(data.badge as string) ?? ""}
          onChange={(e) => onChange({ ...data, badge: e.target.value })}
          placeholder='VD: "Về chúng tôi"'
        />
      </Field>
      <Field label="Tiêu đề chính" required>
        <Input
          value={(data.title as string) ?? ""}
          onChange={(e) => onChange({ ...data, title: e.target.value })}
          placeholder='VD: "LapLap"'
        />
      </Field>
      <Field label="Phụ đề (xuống dòng, chữ mờ)">
        <Input
          value={(data.subtitle as string) ?? ""}
          onChange={(e) => onChange({ ...data, subtitle: e.target.value })}
          placeholder='VD: "Laptop Cần Thơ."'
        />
      </Field>
      <Field label="Mô tả ngắn">
        <Textarea
          value={(data.description as string) ?? ""}
          onChange={(e) => onChange({ ...data, description: e.target.value })}
          rows={3}
          placeholder="Mô tả 1-2 câu"
        />
      </Field>
      <Field label="Theme">
        <Select
          value={(data.theme as string) ?? "dark"}
          onValueChange={(v) => onChange({ ...data, theme: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Tối (gradient slate)</SelectItem>
            <SelectItem value="light">Sáng (nền card)</SelectItem>
          </SelectContent>
        </Select>
      </Field>
    </div>
  );
}

// ============================================================================
// Form: RichText
// ============================================================================

function RichTextForm({
  data,
  onChange,
  paragraphsText,
  onParagraphsChange,
}: {
  data: Record<string, unknown>;
  onChange: (d: Record<string, unknown>) => void;
  paragraphsText: string;
  onParagraphsChange: (s: string) => void;
}) {
  return (
    <div className="space-y-4">
      <Field label="Tiêu đề mục">
        <Input
          value={(data.heading as string) ?? ""}
          onChange={(e) => onChange({ ...data, heading: e.target.value })}
          placeholder='VD: "Câu chuyện của LapLap"'
        />
      </Field>
      <Field label="Căn chỉnh">
        <Select
          value={(data.alignment as string) ?? "center"}
          onValueChange={(v) => onChange({ ...data, alignment: v })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="center">Giữa</SelectItem>
            <SelectItem value="left">Trái</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field
        label="Nội dung (mỗi đoạn cách nhau 1 dòng trống)"
        hint="Xuống dòng 2 lần liên tiếp để tách đoạn mới"
      >
        <Textarea
          value={paragraphsText}
          onChange={(e) => onParagraphsChange(e.target.value)}
          rows={8}
          placeholder={"Đoạn văn thứ nhất...\n\nĐoạn văn thứ hai..."}
        />
      </Field>
    </div>
  );
}

// ============================================================================
// UI atoms
// ============================================================================

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm">
        {label}
        {required ? <span className="text-destructive"> *</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
