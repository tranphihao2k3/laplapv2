"use client";

import { useCallback, useRef, useState } from "react";
import {
  Music2,
  Plus,
  Trash2,
  Upload,
  Edit,
  Search,
  Loader2,
  GripVertical,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { httpDelete, httpPatch, httpPost } from "@/lib/api/http";
import type { Paginated } from "@/lib/api/response";

// ── Types ─────────────────────────────────────────────────────────────────────
type SpeakerSong = {
  id: string;
  title: string;
  artist: string | null;
  file_url: string;
  file_key: string;
  file_size_bytes: number | null;
  duration_seconds: number | null;
  position: number;
  is_active: boolean;
  created_at: string;
};

type UploadForm = {
  title: string;
  artist: string;
  file: File | null;
};

const emptyUploadForm: UploadForm = { title: "", artist: "", file: null };

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatBytes(bytes: number | null | undefined) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(sec: number | null | undefined) {
  if (!sec) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function getErrorMessage(err: unknown): string {
  if (typeof err === "string") return err;
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const p = err as { error?: { message?: string } };
    if (p.error?.message) return p.error.message;
  }
  return "Có lỗi xảy ra";
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function SpeakerSongsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [editing, setEditing] = useState<SpeakerSong | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [form, setForm] = useState<UploadForm>(emptyUploadForm);
  const [editForm, setEditForm] = useState({ title: "", artist: "", position: "0", is_active: true });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ── Queries ──────────────────────────────────────────────────────────────────
  const songsQuery = useQuery({
    queryKey: ["speaker-songs", search],
    queryFn: () =>
      fetch(
        `/api/v1/speaker-songs?active_only=false&pageSize=50${search ? `&search=${encodeURIComponent(search)}` : ""}`,
      )
        .then((r) => r.json())
        .then((j) => (j?.data as Paginated<SpeakerSong>) ?? { items: [], total: 0 }),
    staleTime: 30_000,
  });

  const songs = songsQuery.data?.items ?? [];

  // ── Mutations ─────────────────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, input }: { id: string; input: Record<string, unknown> }) =>
      httpPatch<SpeakerSong>(`/v1/speaker-songs/${id}`, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaker-songs"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => httpDelete<{ id: string }>(`/v1/speaker-songs/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["speaker-songs"] }),
  });

  // ── File selection ────────────────────────────────────────────────────────────
  const handleFile = useCallback((file: File) => {
    setForm((prev) => ({
      ...prev,
      file,
      title: prev.title || file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "),
    }));
  }, []);

  const onFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) handleFile(f);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) {
      handleFile(f);
      setUploadOpen(true);
    }
  };

  // ── Upload ─────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!form.file || !form.title.trim()) {
      toast.error("Vui lòng chọn file và nhập tên bài hát");
      return;
    }

    setUploading(true);
    try {
      // 1. Upload file to R2
      const fd = new FormData();
      fd.append("file", form.file);
      fd.append("title", form.title.trim());
      if (form.artist.trim()) fd.append("artist", form.artist.trim());

      const uploadRes = await fetch("/api/v1/speaker-songs/upload", {
        method: "POST",
        body: fd,
      });
      const uploadJson = await uploadRes.json();
      if (!uploadRes.ok || !uploadJson.ok) {
        throw new Error(uploadJson?.error?.message ?? "Upload thất bại");
      }
      const { file_url, file_key, file_size_bytes } = uploadJson.data;

      // 2. Create DB record
      await httpPost("/v1/speaker-songs", {
        title: form.title.trim(),
        artist: form.artist.trim() || null,
        file_url,
        file_key,
        file_size_bytes,
        position: songs.length,
        is_active: true,
      });

      toast.success(`Đã thêm "${form.title.trim()}"`);
      setUploadOpen(false);
      setForm(emptyUploadForm);
      qc.invalidateQueries({ queryKey: ["speaker-songs"] });
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  // ── Edit ──────────────────────────────────────────────────────────────────
  function openEdit(song: SpeakerSong) {
    setEditing(song);
    setEditForm({
      title: song.title,
      artist: song.artist ?? "",
      position: String(song.position),
      is_active: song.is_active,
    });
    setEditOpen(true);
  }

  async function handleEdit() {
    if (!editing || !editForm.title.trim()) {
      toast.error("Tên bài hát không được để trống");
      return;
    }
    try {
      await updateMutation.mutateAsync({
        id: editing.id,
        input: {
          title: editForm.title.trim(),
          artist: editForm.artist.trim() || null,
          position: Number(editForm.position) || 0,
          is_active: editForm.is_active,
        },
      });
      toast.success("Đã cập nhật");
      setEditOpen(false);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  // ── Toggle active ─────────────────────────────────────────────────────────
  async function toggleActive(song: SpeakerSong) {
    try {
      await updateMutation.mutateAsync({ id: song.id, input: { is_active: !song.is_active } });
      toast.success(song.is_active ? "Đã ẩn bài hát" : "Đã hiện bài hát");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deletingId) return;
    try {
      await deleteMutation.mutateAsync(deletingId);
      toast.success("Đã xoá bài hát");
      setDeleteOpen(false);
      setDeletingId(null);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-4"
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
    >
      {/* Header Card */}
      <Card className={dragOver ? "border-dashed border-2 border-zinc-400" : ""}>
        <CardHeader className="flex flex-col gap-3 space-y-0 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Music2 className="h-5 w-5 text-primary" />
              Nhạc Test Loa
            </CardTitle>
            <CardDescription>
              Quản lý bài nhạc phát ở trang{" "}
              <code className="rounded bg-muted px-1 text-xs">/test-laptop/speakers</code>.{" "}
              Kéo thả file nhạc vào đây để upload nhanh. Tổng {songs.length} bài.
            </CardDescription>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
            <div className="relative w-full sm:w-52">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm bài hát..."
                className="pl-8"
              />
            </div>
            <Button
              onClick={() => { setForm(emptyUploadForm); setUploadOpen(true); }}
              className="w-full sm:w-auto"
            >
              <Plus className="mr-1.5 size-4" />
              Thêm bài hát
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Songs list */}
      {songsQuery.isLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </CardContent>
        </Card>
      ) : songs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <Music2 className="h-12 w-12 text-zinc-200" />
            <p className="text-sm text-muted-foreground">
              {search ? "Không tìm thấy bài hát phù hợp." : "Chưa có bài hát nào. Nhấn \"Thêm bài hát\" hoặc kéo file nhạc vào đây."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0 divide-y">
            {[...songs]
              .sort((a, b) => a.position - b.position)
              .map((song) => (
                <div
                  key={song.id}
                  className="group flex items-center gap-3 px-4 py-3 hover:bg-accent/30 transition-colors"
                >
                  {/* Drag handle (visual) */}
                  <GripVertical className="h-4 w-4 shrink-0 text-zinc-300 group-hover:text-zinc-400" />

                  {/* Song icon */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100">
                    <Music2 className="h-4 w-4 text-zinc-500" />
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate text-sm font-medium ${!song.is_active ? "text-muted-foreground line-through" : ""}`}>
                        {song.title}
                      </span>
                      {!song.is_active && (
                        <span className="shrink-0 rounded-full bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-500">
                          Ẩn
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                      {song.artist && <span>{song.artist}</span>}
                      {song.artist && song.duration_seconds && <span>·</span>}
                      {song.duration_seconds && <span>{formatTime(song.duration_seconds)}</span>}
                      {song.file_size_bytes && <span className="text-zinc-300">·</span>}
                      {song.file_size_bytes && <span>{formatBytes(song.file_size_bytes)}</span>}
                    </div>
                  </div>

                  {/* Position badge */}
                  <span className="hidden shrink-0 text-xs text-zinc-400 sm:block">#{song.position + 1}</span>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      title={song.is_active ? "Ẩn bài hát" : "Hiện bài hát"}
                      onClick={() => toggleActive(song)}
                      disabled={updateMutation.isPending}
                    >
                      {song.is_active ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={() => openEdit(song)}
                    >
                      <Edit className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => { setDeletingId(song.id); setDeleteOpen(true); }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* ── Upload Dialog ── */}
      <Dialog open={uploadOpen} onOpenChange={(o) => { if (!uploading) { setUploadOpen(o); if (!o) setForm(emptyUploadForm); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm bài hát mới</DialogTitle>
            <DialogDescription>Upload file âm thanh lên R2. Hỗ trợ MP3, WAV, OGG, FLAC, AAC — tối đa 30MB.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            {/* File drop zone */}
            <div
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed py-8 px-4 text-center cursor-pointer transition-colors ${
                dragOver || form.file ? "border-zinc-400 bg-zinc-50" : "border-zinc-200 hover:border-zinc-300"
              }`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setDragOver(false);
                const f = e.dataTransfer.files[0];
                if (f) handleFile(f);
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={onFileInput}
              />
              {form.file ? (
                <>
                  <Music2 className="h-8 w-8 text-zinc-900 mb-2" />
                  <p className="text-sm font-medium">{form.file.name}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{formatBytes(form.file.size)}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2 h-7 text-xs"
                    onClick={(e) => { e.stopPropagation(); setForm((p) => ({ ...p, file: null })); }}
                  >
                    Đổi file
                  </Button>
                </>
              ) : (
                <>
                  <Upload className="h-8 w-8 text-zinc-300 mb-2" />
                  <p className="text-sm text-zinc-500">Kéo thả file hoặc nhấn để chọn</p>
                  <p className="text-xs text-zinc-400 mt-0.5">MP3, WAV, OGG, FLAC, AAC — tối đa 30MB</p>
                </>
              )}
            </div>

            <div className="space-y-2">
              <Label>
                Tên bài hát <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="VD: Hương Mùa Hè"
              />
            </div>

            <div className="space-y-2">
              <Label>Nghệ sĩ (tuỳ chọn)</Label>
              <Input
                value={form.artist}
                onChange={(e) => setForm((p) => ({ ...p, artist: e.target.value }))}
                placeholder="VD: Sơn Tùng MTP"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setUploadOpen(false); setForm(emptyUploadForm); }} disabled={uploading}>
              Huỷ
            </Button>
            <Button onClick={handleUpload} disabled={uploading || !form.file}>
              {uploading ? (
                <><Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Đang upload...</>
              ) : (
                <><Upload className="mr-1.5 h-4 w-4" /> Upload</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Chỉnh sửa bài hát</DialogTitle>
            <DialogDescription>Cập nhật thông tin metadata. File nhạc không thay đổi.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4">
            <div className="space-y-2">
              <Label>Tên bài hát <span className="text-destructive">*</span></Label>
              <Input
                value={editForm.title}
                onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Nghệ sĩ</Label>
              <Input
                value={editForm.artist}
                onChange={(e) => setEditForm((p) => ({ ...p, artist: e.target.value }))}
                placeholder="Tuỳ chọn"
              />
            </div>
            <div className="space-y-2">
              <Label>Thứ tự hiển thị</Label>
              <Input
                inputMode="numeric"
                value={editForm.position}
                onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value.replace(/\D/g, "") }))}
                placeholder="0"
              />
              <p className="text-xs text-muted-foreground">Số nhỏ hơn = hiện trước. Bắt đầu từ 0.</p>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={editForm.is_active}
                onCheckedChange={(v) => setEditForm((p) => ({ ...p, is_active: v }))}
              />
              <Label className="cursor-pointer">Hiển thị trong trang test loa</Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Huỷ</Button>
            <Button onClick={handleEdit} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "Đang lưu..." : "Lưu thay đổi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Xác nhận xoá</DialogTitle>
            <DialogDescription>
              Bài hát và file âm thanh sẽ bị xoá vĩnh viễn khỏi R2. Không thể hoàn tác.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteOpen(false); setDeletingId(null); }}>Huỷ</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "Đang xoá..." : "Xoá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
