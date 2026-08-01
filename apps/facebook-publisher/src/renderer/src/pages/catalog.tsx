/**
 * Catalog page — CAT-002: search/filter, list product từ cache, click để
 * chọn variant. Stock se refetch o MED-001 + QUE-004.
 *
 * Trang thái (UI conventions §15):
 *  - Loading ban dau + spinner.
 *  - Empty: neu API tra 0 product.
 *  - Stale: cache co nhung lastSyncAt cu (>5 phut) -> indicator "Đồ bộ
 *    cu" + nút refresh.
 *  - Error: network/401/403 typed qua SyncResult.status.
 */
import { useEffect, useState } from "react";
import type { ProductSummary, SyncResult } from "../../shared/catalog";

type SyncState =
  | { kind: "idle" }
  | { kind: "syncing"; last: SyncResult | null }
  | { kind: "error"; message: string };

export function CatalogPage() {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sync, setSync] = useState<SyncState>({ kind: "idle" });

  async function loadList(query: string) {
    const api = window.publisherApi;
    if (!api) return;
    const result = await api.catalogList({ q: query || undefined, page: 1, pageSize: 50 });
    if (result.ok) {
      setItems(result.data.items);
      setTotal(result.data.total);
    }
  }

  async function loadLastSync() {
    const api = window.publisherApi;
    if (!api) return;
    const r = await api.catalogLastSync();
    if (r.ok) setLastSync(r.data);
  }

  async function handleSync() {
    const api = window.publisherApi;
    if (!api) return;
    setSync({ kind: "syncing", last: null });
    const r = await api.catalogSyncAll({ q: q || undefined, pageSize: 50 });
    if (r.ok) {
      setSync({ kind: "idle" });
      setLastSync(r.data.lastSyncAt);
      void loadList(q);
    } else {
      setSync({ kind: "error", message: `${r.error.code}: ${r.error.message}` });
    }
  }

  useEffect(() => {
    void loadList("");
    void loadLastSync();
  }, []);

  const stale = lastSync && Date.now() - new Date(lastSync).getTime() > 5 * 60 * 1000;

  return (
    <section>
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Sản phẩm</h1>
          <p className="text-xs text-muted-500">
            {lastSync
              ? `Đồng bộ lần cuối: ${new Date(lastSync).toLocaleString("vi-VN")}${stale ? " · cũ" : ""}`
              : "Chưa đồng bộ"}
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Tìm theo tên hoặc slug…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void loadList(q);
            }}
            className="rounded border border-muted-100 px-2 py-1 text-sm"
          />
          <button
            type="button"
            onClick={() => {
              void loadList(q);
              void loadLastSync();
            }}
            className="rounded border border-muted-100 px-3 py-1 text-sm hover:bg-muted-50"
          >
            Tải lại
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={sync.kind === "syncing"}
            className="rounded bg-primary-600 px-3 py-1 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60"
          >
            {sync.kind === "syncing" ? "Đang đồng bộ…" : "Đồng bộ ngay"}
          </button>
        </div>
      </header>

      {sync.kind === "error" && (
        <p role="alert" className="mt-3 rounded border border-danger-500 bg-danger-50 p-2 text-sm text-danger-600">
          {sync.message}
        </p>
      )}

      <div className="mt-4 overflow-hidden rounded border border-muted-100 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-muted-50 text-left text-xs uppercase text-muted-500">
            <tr>
              <th className="px-3 py-2">Sản phẩm</th>
              <th className="px-3 py-2">Mô tả ngắn</th>
              <th className="px-3 py-2">Slug</th>
              <th className="px-3 py-2">Cập nhật</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-muted-500">
                  {lastSync
                    ? "Không có sản phẩm nào khớp bộ lọc."
                    : "Chưa có dữ liệu. Bấm \"Đồng bộ ngay\" để tải từ LapLap API."}
                </td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={item.productId} className="border-t border-muted-100">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    {item.thumbnailUrl && (
                      <img
                        src={item.thumbnailUrl}
                        alt=""
                        className="h-8 w-8 rounded object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-500">{item.productId}</p>
                    </div>
                  </div>
                </td>
                <td className="px-3 py-2 text-muted-500">{item.shortDescription ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-500">{item.slug ?? "—"}</td>
                <td className="px-3 py-2 text-xs text-muted-500">
                  {item.updatedAt ? new Date(item.updatedAt).toLocaleString("vi-VN") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="border-t border-muted-100 bg-muted-50 px-3 py-2 text-xs text-muted-500">
          {total} sản phẩm active
        </div>
      </div>
    </section>
  );
}