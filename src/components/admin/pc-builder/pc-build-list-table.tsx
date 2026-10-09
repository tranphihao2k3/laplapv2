"use client";

/**
 * Bảng danh sách PC Builds cho admin.
 *
 * Tính năng:
 * - Search theo tên build / share_slug
 * - Lọc theo khoảng ngày tạo
 * - Lọc theo user (lookup user_profiles.full_name, fallback "Khách" nếu null)
 * - Phân trang đơn giản 20 dòng/trang
 * - Hành động: Xem (→ /quanly/pc-builds/[id]), Xóa (confirm dialog)
 *
 * Data flow: Server component fetch initial → truyền xuống. Client component
 * dùng useState + createClient (Supabase browser) để refetch khi filter đổi
 * (TanStack Query xung quanh để cache + loading state).
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, formatVnd, type PcBuildRow } from "./helpers";

type UserLite = { id: string; full_name: string | null; email?: string | null };

/** Shape trả về từ query — build + info user (join). */
export type BuildListItem = PcBuildRow & {
  user: UserLite | null;
  items_count: number;
};

export type InitialPayload = {
  builds: BuildListItem[];
  users: UserLite[];
  total: number;
};

type Filters = {
  search: string;
  userId: string;
  fromDate: string;
  toDate: string;
  page: number;
};

const PAGE_SIZE = 20;

/** Query key ổn định — đổi filter → key đổi → useQuery refetch. */
function buildQueryKey(filters: Filters) {
  return [
    "admin-pc-builds",
    filters.search,
    filters.userId,
    filters.fromDate,
    filters.toDate,
    filters.page,
  ] as const;
}

async function fetchBuilds(filters: Filters): Promise<{ items: BuildListItem[]; total: number }> {
  const supabase = createClient();
  // Đếm tổng (chỉ chạy khi cần)
  let query = supabase
    .from("pc_builds")
    .select("*, user_profiles:user_id(id, full_name)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range((filters.page - 1) * PAGE_SIZE, filters.page * PAGE_SIZE - 1);

  if (filters.search.trim()) {
    // PostgREST ilike đơn giản — search theo name hoặc share_slug
    const term = filters.search.trim().replace(/[%_]/g, (m) => `\\${m}`);
    query = query.or(`name.ilike.%${term}%,share_slug.ilike.%${term}%`);
  }
  if (filters.userId === "__guest__") {
    query = query.is("user_id", null);
  } else if (filters.userId && filters.userId !== "__all__") {
    query = query.eq("user_id", filters.userId);
  }
  if (filters.fromDate) {
    query = query.gte("created_at", `${filters.fromDate}T00:00:00`);
  }
  if (filters.toDate) {
    // Bao trùm cả ngày toDate (đến 23:59:59)
    query = query.lte("created_at", `${filters.toDate}T23:59:59`);
  }

  const { data, count, error } = await query;
  if (error) throw new Error(error.message);

  const builds = (data ?? []) as unknown as Array<
    PcBuildRow & { user_profiles: UserLite | null }
  >;

  // items_count: query thêm vào bảng pc_build_items đếm theo build_id (1 query group)
  const buildIds = builds.map((b) => b.id);
  const countsMap = new Map<string, number>();
  if (buildIds.length > 0) {
    const { data: itemRows, error: itemsErr } = await supabase
      .from("pc_build_items")
      .select("build_id, qty")
      .in("build_id", buildIds);
    if (itemsErr) throw new Error(itemsErr.message);
    for (const row of (itemRows ?? []) as Array<{ build_id: string; qty: number | null }>) {
      countsMap.set(row.build_id, (countsMap.get(row.build_id) ?? 0) + (row.qty ?? 0));
    }
  }

  const items: BuildListItem[] = builds.map((b) => ({
    ...b,
    user: b.user_profiles ?? null,
    items_count: countsMap.get(b.id) ?? 0,
  }));

  return { items, total: count ?? items.length };
}

export function PcBuildListTable({ initialData }: { initialData: InitialPayload }) {
  const qc = useQueryClient();

  const [search, setSearch] = useState("");
  const [userId, setUserId] = useState<string>("__all__");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filters: Filters = { search, userId, fromDate, toDate, page };

  const query = useQuery({
    queryKey: buildQueryKey(filters),
    queryFn: () => fetchBuilds(filters),
    // Lần đầu render: dùng initialData để SSR có nội dung ngay. Khi filter đổi → refetch.
    initialData:
      page === 1 && !search.trim() && userId === "__all__" && !fromDate && !toDate
        ? { items: initialData.builds, total: initialData.total }
        : undefined,
    placeholderData: (prev) => prev,
    staleTime: 30_000,
  });

  const items = query.data?.items ?? initialData.builds;
  const total = query.data?.total ?? initialData.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const users = initialData.users;

  // Map id → display name để hiển thị nhanh kể cả khi initialData không đầy đủ
  const userMap = useMemo(() => {
    const m = new Map<string, UserLite>();
    for (const u of users) m.set(u.id, u);
    return m;
  }, [users]);

  function resetFilters() {
    setSearch("");
    setUserId("__all__");
    setFromDate("");
    setToDate("");
    setPage(1);
  }

  async function confirmDelete() {
    if (!deletingId) return;
    const supabase = createClient();
    const { error } = await supabase.from("pc_builds").delete().eq("id", deletingId);
    if (error) {
      toast.error(`Xoá thất bại: ${error.message}`);
      return;
    }
    toast.success("Đã xoá cấu hình");
    setDeletingId(null);
    qc.invalidateQueries({ queryKey: ["admin-pc-builds"] });
  }

  function renderUserLabel(item: BuildListItem): string {
    if (!item.user_id) return "Khách";
    const u = item.user ?? userMap.get(item.user_id);
    if (!u) return "(không rõ)";
    return u.full_name || "(chưa đặt tên)";
  }

  const deletingItem = deletingId
    ? items.find((i) => i.id === deletingId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="space-y-3">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
            <div>
              <CardTitle>Cấu hình PC đã lưu</CardTitle>
              <CardDescription>
                {total > 0 ? `${total} cấu hình` : "Chưa có cấu hình nào"} — quản lý các
                build do khách hàng và nhân viên tạo.
              </CardDescription>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-1">
            <div className="sm:col-span-2 md:col-span-2 space-y-1">
              <Label className="text-xs">Tìm kiếm</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Tên build hoặc slug chia sẻ..."
                  className="pl-8 h-9"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Người tạo</Label>
              <Select
                value={userId}
                onValueChange={(v) => {
                  setUserId(v);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Tất cả</SelectItem>
                  <SelectItem value="__guest__">Khách (không đăng nhập)</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.full_name || u.id.slice(0, 8)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Từ ngày</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Đến ngày</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  setPage(1);
                }}
                className="h-9"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8"
              disabled={!search && userId === "__all__" && !fromDate && !toDate}
            >
              Đặt lại bộ lọc
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* ===== Desktop ===== */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">STT</TableHead>
                  <TableHead>Tên cấu hình</TableHead>
                  <TableHead>Người tạo</TableHead>
                  <TableHead className="text-center">Số linh kiện</TableHead>
                  <TableHead className="text-right">Tổng tiền</TableHead>
                  <TableHead>Ngày tạo</TableHead>
                  <TableHead className="text-center">Công khai</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {query.isLoading && items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Đang tải...
                    </TableCell>
                  </TableRow>
                ) : items.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      Không có cấu hình nào khớp bộ lọc
                    </TableCell>
                  </TableRow>
                ) : (
                  items.map((b, idx) => {
                    const stt = (page - 1) * PAGE_SIZE + idx + 1;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-mono text-xs text-muted-foreground">
                          {stt}
                        </TableCell>
                        <TableCell>
                          <div className="font-semibold text-sm">{b.name || "(chưa đặt tên)"}</div>
                          {b.share_slug && (
                            <div className="font-mono text-[11px] text-muted-foreground">
                              share: {b.share_slug}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          <div>{renderUserLabel(b)}</div>
                          {b.user_id && (
                            <div className="font-mono text-[10px] text-muted-foreground">
                              {b.user_id.slice(0, 8)}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-center">
                          <span className="inline-block min-w-[2rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
                            {b.items_count}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatVnd(b.total_price)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatDateTime(b.created_at)}
                        </TableCell>
                        <TableCell className="text-center">
                          {b.is_public ? (
                            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                              Công khai
                            </span>
                          ) : (
                            <span className="inline-block whitespace-nowrap px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">
                              Riêng tư
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="sm" variant="outline" className="h-7">
                              <Link href={`/quanly/pc-builds/${b.id}`}>
                                <Eye className="h-3.5 w-3.5 mr-1" /> Xem
                              </Link>
                            </Button>
                            <Button
                              size="icon"
                              variant="destructive"
                              className="h-7 w-7"
                              onClick={() => setDeletingId(b.id)}
                              aria-label="Xoá"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* ===== Mobile: card list ===== */}
          <div className="md:hidden space-y-3">
            {items.length === 0 ? (
              <p className="text-center text-muted-foreground py-6 text-sm">
                {query.isLoading ? "Đang tải..." : "Không có cấu hình nào"}
              </p>
            ) : (
              items.map((b, idx) => {
                const stt = (page - 1) * PAGE_SIZE + idx + 1;
                return (
                  <div key={b.id} className="rounded-lg border bg-card p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs text-muted-foreground font-mono">#{stt}</div>
                        <div className="font-semibold text-sm leading-tight line-clamp-2">
                          {b.name || "(chưa đặt tên)"}
                        </div>
                        {b.share_slug && (
                          <div className="font-mono text-[10px] text-muted-foreground">
                            share: {b.share_slug}
                          </div>
                        )}
                      </div>
                      {b.is_public ? (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                          Công khai
                        </span>
                      ) : (
                        <span className="shrink-0 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-gray-100 text-gray-700">
                          Riêng tư
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5">
                      <span>{renderUserLabel(b)}</span>
                      <span>·</span>
                      <span>{b.items_count} linh kiện</span>
                      <span>·</span>
                      <span>{formatDateTime(b.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-semibold tabular-nums text-sm">
                        {formatVnd(b.total_price)}
                      </span>
                      <div className="flex gap-1">
                        <Button asChild size="sm" variant="outline" className="h-7">
                          <Link href={`/quanly/pc-builds/${b.id}`}>
                            <Eye className="h-3.5 w-3.5 mr-1" /> Xem
                          </Link>
                        </Button>
                        <Button
                          size="icon"
                          variant="destructive"
                          className="h-7 w-7"
                          onClick={() => setDeletingId(b.id)}
                          aria-label="Xoá"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-4">
              <div className="text-xs text-muted-foreground">
                Trang {page}/{totalPages} · {total} cấu hình
              </div>
              <div className="flex gap-2 w-full sm:w-auto">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ← Trước
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 sm:flex-none"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Sau →
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={Boolean(deletingId)} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xoá cấu hình PC?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingItem ? (
                <>
                  Cấu hình <strong>"{deletingItem.name || "(chưa đặt tên)"}"</strong> sẽ bị xoá
                  cùng toàn bộ linh kiện trong build. Hành động không thể hoàn tác.
                </>
              ) : (
                "Hành động này không thể hoàn tác."
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Huỷ</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => void confirmDelete()}
              className="bg-destructive hover:bg-destructive/90"
            >
              Xoá
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}