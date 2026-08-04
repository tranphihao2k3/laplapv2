/**
 * Catalog page — CAT-002: search/filter, list product từ cache.
 *
 * Layout: page header (title + search + sync) → grid card → modal chi tiết.
 *
 * Card design:
 *  - Ảnh 1:1 ở top (skeleton khi load).
 *  - Tên + mã máy (2 dòng clamp).
 *  - 2-3 dòng cấu hình gọn (từ previewSpecs).
 *  - Badge "N phiên bản" + "Hết hàng" overlay.
 *  - Nút "Xem chi tiết" + click bất kỳ đâu trên card mở modal.
 *
 * Modal detail:
 *  - Gallery ảnh (1 ảnh chính + thumbnails).
 *  - Bảng cấu hình.
 *  - Bảng variants (SKU + giá + kho).
 */
import { useEffect, useState } from "react";
import type { ProductDetail, ProductSummary, SyncResult } from "../../../shared/catalog";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Spinner,
} from "../components/ui";
import {
  IconExternal,
  IconInbox,
  IconPackage,
  IconRefresh,
  IconSearch,
  IconSync,
} from "../components/ui/icons";

/**
 * Label tiếng Việt cho các key spec phổ biến của laptop. Khi key không
 * nằm trong bảng này sẽ fallback về dạng Title Case ("screenSize" →
 * "Screen Size"). Dùng trong ProductCard và SpecsTable để user không
 * phải đọc key raw (snake_case / camelCase).
 */
const SPEC_LABEL: Record<string, string> = {
  cpu: "Vi xử lý (CPU)",
  cpuModel: "Vi xử lý (CPU)",
  processor: "Vi xử lý (CPU)",
  ram: "RAM",
  ramSize: "RAM",
  memory: "RAM",
  storage: "Ổ cứng",
  ssd: "Ổ cứng (SSD)",
  hdd: "Ổ cứng (HDD)",
  screenSize: "Màn hình",
  display: "Màn hình",
  resolution: "Độ phân giải",
  gpu: "Card đồ hoạ (GPU)",
  graphics: "Card đồ hoạ (GPU)",
  vga: "Card đồ hoạ (GPU)",
  battery: "Pin",
  weight: "Trọng lượng",
  color: "Màu sắc",
  os: "Hệ điều hành",
  ports: "Cổng kết nối",
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  webcam: "Webcam",
  keyboard: "Bàn phím",
  warranty: "Bảo hành",
  brand: "Thương hiệu",
  model: "Mẫu máy",
  year: "Năm sản xuất",
  dimensions: "Kích thước",
  material: "Chất liệu",
};

function formatSpecKey(raw: string): string {
  // Exact match (case-insensitive) trước — nhanh và chính xác nhất.
  const exact = SPEC_LABEL[raw] ?? SPEC_LABEL[raw.toLowerCase()];
  if (exact) return exact;
  // Fallback: tách snake/camel case rồi Title Case.
  //   "screenSize" → "Screen Size"
  //   "screen_size" → "Screen Size"
  //   "ram_gb"      → "Ram Gb"
  const spaced = raw
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  return spaced
    .split(" ")
    .map((w) =>
      w.length <= 2 && w.toUpperCase() === w
        ? w.toUpperCase() // RAM, SSD, OS, GPU giữ nguyên
        : w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
    )
    .join(" ");
}

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
  const [detail, setDetail] = useState<ProductDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [errorDismissed, setErrorDismissed] = useState(false);

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
    setErrorDismissed(false);
    const r = await api.catalogSyncAll({ q: q || undefined, pageSize: 50 });
    if (r.ok) {
      setSync({ kind: "idle" });
      setLastSync(r.data.lastSyncAt);
      void loadList(q);
    } else {
      setSync({ kind: "error", message: `${r.error.code}: ${r.error.message}` });
    }
  }

  async function openDetail(productId: string) {
    const api = window.publisherApi;
    if (!api) return;
    setDetail(null);
    setDetailLoading(true);
    const r = await api.catalogGet(productId);
    if (r.ok) {
      setDetail(r.data);
    } else {
      setDetail(null);
      setSync({ kind: "error", message: `${r.error.code}: ${r.error.message}` });
    }
    setDetailLoading(false);
  }

  function closeDetail() {
    setDetail(null);
    setDetailLoading(false);
  }

  useEffect(() => {
    void loadList("");
    void loadLastSync();
  }, []);

  const stale =
    lastSync !== null && Date.now() - new Date(lastSync).getTime() > 5 * 60 * 1000;

  return (
    <section className="space-y-5">
      <PageHeader
        title="Sản phẩm"
        subtitle={
          lastSync
            ? `Đồng bộ lần cuối: ${new Date(lastSync).toLocaleString("vi-VN")}`
            : "Chưa đồng bộ"
        }
        badge={
          stale ? (
            <Badge variant="warning" size="sm" dot>
              Cache cũ
            </Badge>
          ) : null
        }
        actions={
          <>
            <Input
              placeholder="Tìm theo tên hoặc slug…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void loadList(q);
              }}
              iconLeft={<IconSearch size={16} />}
              className="w-64"
            />
            <Button
              variant="secondary"
              size="md"
              icon={<IconRefresh size={14} />}
              onClick={() => {
                void loadList(q);
                void loadLastSync();
              }}
            >
              Tải lại
            </Button>
            <Button
              variant="primary"
              size="md"
              icon={<IconSync size={14} />}
              loading={sync.kind === "syncing"}
              onClick={handleSync}
            >
              Đồng bộ ngay
            </Button>
          </>
        }
      />

      {sync.kind === "error" && !errorDismissed && (
        <Alert
          variant="danger"
          title="Đồng bộ thất bại"
          onClose={() => setErrorDismissed(true)}
        >
          {sync.message}
        </Alert>
      )}

      {items.length === 0 ? (
        <Card padding="none">
          <EmptyState
            icon={<IconInbox size={22} />}
            title={lastSync ? "Không có sản phẩm nào khớp bộ lọc" : "Chưa có dữ liệu"}
            description={
              lastSync
                ? "Thử đổi từ khoá tìm kiếm hoặc tải lại danh sách."
                : "Bấm \"Đồng bộ ngay\" để tải sản phẩm từ LapLap API."
            }
            action={
              !lastSync ? (
                <Button variant="primary" icon={<IconSync size={14} />} onClick={handleSync}>
                  Đồng bộ ngay
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <ProductCard key={item.productId} product={item} onOpenDetail={openDetail} />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-500">
        {total} sản phẩm active
      </p>

      {(detail !== null || detailLoading) && (
        <ProductDetailModal
          detail={detail}
          loading={detailLoading}
          onClose={closeDetail}
        />
      )}
    </section>
  );
}

/**
 * Card hiển thị gọn: ảnh + tên + mã máy + 2-3 dòng cấu hình + nút.
 */
function ProductCard({
  product,
  onOpenDetail,
}: {
  product: ProductSummary;
  onOpenDetail: (id: string) => void;
}) {
  const localFirst = product.localImagePaths[0];
  const remoteFirst = product.imageUrls[0] ?? product.thumbnailUrl;
  const imgSrc = localFirst ? pathToFileUrl(localFirst) : remoteFirst;

  const codeLine = product.slug ?? product.productId.slice(0, 8);
  const specsEntries = Object.entries(product.previewSpecs ?? {}).slice(0, 3);
  const outOfStock = !product.inStock;

  return (
    <Card padding="none" interactive className="flex flex-col overflow-hidden">
      <button
        type="button"
        onClick={() => onOpenDetail(product.productId)}
        className="group relative aspect-square w-full overflow-hidden bg-muted-50 text-left focus-visible:outline-none focus-visible:shadow-ring"
      >
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition duration-slow ease-out group-hover:scale-[1.04]"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              const fallback = product.imageUrls[0] ?? product.thumbnailUrl;
              if (fallback && el.src !== fallback) el.src = fallback;
              else el.style.display = "none";
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-muted-500">
            <IconPackage size={28} className="text-muted-300" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {product.variantsCount > 1 && (
            <Badge variant="neutral" size="sm" className="bg-muted-900/70 text-white">
              {product.variantsCount} phiên bản
            </Badge>
          )}
          {outOfStock && (
            <Badge variant="danger" size="sm" dot>
              Hết hàng
            </Badge>
          )}
        </div>
      </button>

      <div className="flex flex-1 flex-col gap-2 p-3.5">
        <div>
          <h3
            className="line-clamp-2 text-sm font-semibold text-muted-900"
            title={product.name}
          >
            {product.name}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] text-muted-500" title={product.productId}>
            Mã máy: {codeLine}
          </p>
        </div>

        {specsEntries.length > 0 && (
          <ul className="space-y-0.5 text-xs text-muted-700">
            {specsEntries.map(([k, v]) => (
              <li key={k} className="flex items-baseline gap-1.5">
                <span className="shrink-0 text-muted-500">{formatSpecKey(k)}:</span>
                <span className="truncate" title={v}>
                  {v}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-auto pt-2">
          <Button
            variant="secondary"
            size="sm"
            block
            onClick={() => onOpenDetail(product.productId)}
          >
            Xem chi tiết
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Modal chi tiết: gallery + bảng cấu hình + variants + URL.
 */
function ProductDetailModal({
  detail,
  loading,
  onClose,
}: {
  detail: ProductDetail | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <Modal
      open
      onClose={onClose}
      size="xl"
      title={detail?.name ?? "Đang tải…"}
      description={
        detail
          ? `Mã máy: ${detail.slug ?? detail.productId}`
          : "Đang tải chi tiết sản phẩm"
      }
    >
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Spinner size="md" />
          <span className="ml-3 text-sm text-muted-500">Đang tải chi tiết…</span>
        </div>
      )}

      {!loading && detail && (
        <div className="space-y-5">
          <ImageGallery
            localPaths={detail.localImagePaths}
            remoteUrls={detail.imageUrls}
            thumbnailUrl={detail.thumbnailUrl}
            alt={detail.name}
          />

          {detail.shortDescription && (
            <p className="text-sm text-muted-700">{detail.shortDescription}</p>
          )}

          <SpecsTable variants={detail.variants} />

          {detail.variants.length > 1 && (
            <section>
              <h3 className="mb-2 text-sm font-semibold text-muted-900">
                Phiên bản ({detail.variants.length})
              </h3>
              <div className="overflow-hidden rounded-md border border-muted-100">
                <table className="w-full text-xs">
                  <thead className="bg-muted-50 text-left text-[11px] uppercase text-muted-500">
                    <tr>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Tên</th>
                      <th className="px-3 py-2 font-medium">Giá</th>
                      <th className="px-3 py-2 font-medium">Kho</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.variants.map((v) => (
                      <tr key={v.variantId} className="border-t border-muted-100">
                        <td className="px-3 py-2 font-mono text-muted-700">{v.sku}</td>
                        <td className="px-3 py-2">{v.name ?? "—"}</td>
                        <td className="px-3 py-2 tabular-nums">
                          {v.sellingPrice != null
                            ? v.sellingPrice.toLocaleString("vi-VN") + " ₫"
                            : "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums">{v.availableQty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {detail.productUrl && (
            <a
              href={detail.productUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700"
            >
              <IconExternal size={12} />
              <span className="break-all">{detail.productUrl}</span>
            </a>
          )}
        </div>
      )}
    </Modal>
  );
}

/**
 * Gallery ảnh — ảnh chính + thumbnails.
 */
function ImageGallery({
  localPaths,
  remoteUrls,
  thumbnailUrl,
  alt,
}: {
  localPaths: string[];
  remoteUrls: string[];
  thumbnailUrl: string | null;
  alt: string;
}) {
  const allSources: { src: string; isLocal: boolean }[] = [];
  for (const p of localPaths) allSources.push({ src: pathToFileUrl(p), isLocal: true });
  for (const u of remoteUrls) {
    if (!allSources.some((s) => s.src === u)) allSources.push({ src: u, isLocal: false });
  }
  if (thumbnailUrl && !allSources.some((s) => s.src === thumbnailUrl)) {
    allSources.push({ src: thumbnailUrl, isLocal: false });
  }

  const [activeIdx, setActiveIdx] = useState(0);
  const active = allSources[activeIdx] ?? allSources[0];

  if (allSources.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-muted-200 bg-muted-50 text-xs text-muted-500">
        Chưa có ảnh
      </div>
    );
  }

  return (
    <div>
      <div className="aspect-video w-full overflow-hidden rounded-lg border border-muted-100 bg-muted-50">
        {active && (
          <img
            src={active.src}
            alt={alt}
            className="h-full w-full object-contain"
            onError={(e) => {
              const el = e.currentTarget as HTMLImageElement;
              if (activeIdx < allSources.length - 1) {
                setActiveIdx(activeIdx + 1);
              } else {
                el.style.display = "none";
              }
            }}
          />
        )}
      </div>
      {allSources.length > 1 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {allSources.map((s, idx) => (
            <button
              key={`${s.src}-${idx}`}
              type="button"
              onClick={() => setActiveIdx(idx)}
              className={[
                "h-14 w-14 overflow-hidden rounded-md border transition",
                idx === activeIdx
                  ? "border-primary-600 ring-2 ring-primary-600/30"
                  : "border-muted-200 hover:border-muted-300",
              ].join(" ")}
              aria-label={`Ảnh ${idx + 1}`}
            >
              <img
                src={s.src}
                alt=""
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.opacity = "0.3";
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Bảng cấu hình — gộp specs của variant đầu.
 */
function SpecsTable({ variants }: { variants: ProductDetail["variants"] }) {
  const primary = variants.find((v) => v.specs && typeof v.specs === "object");
  const specs = primary?.specs;

  let rows: { key: string; value: string }[] = [];
  if (specs && typeof specs === "object") {
    if (!Array.isArray(specs)) {
      rows = Object.entries(specs as Record<string, unknown>)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => ({ key: k, value: String(v) }));
    } else {
      rows = (specs as unknown[])
        .filter(
          (item): item is { key: unknown; value: unknown } =>
            !!item &&
            typeof item === "object" &&
            "key" in item &&
            "value" in item,
        )
        .map((item) => ({ key: String(item.key), value: String(item.value) }));
    }
  }

  if (rows.length === 0) {
    return (
      <section>
        <h3 className="mb-2 text-sm font-semibold text-muted-900">Cấu hình</h3>
        <div className="rounded-lg border border-dashed border-muted-200 bg-muted-50 p-4 text-xs text-muted-500">
          Chưa có thông tin cấu hình.
        </div>
      </section>
    );
  }

  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-muted-900">
        Cấu hình{" "}
        <span className="font-normal text-muted-500">
          ({primary?.sku ?? "—"})
        </span>
      </h3>
      <div className="overflow-hidden rounded-lg border border-muted-100">
        <table className="w-full text-xs">
          <tbody>
            {rows.map((r, idx) => (
              <tr
                key={r.key}
                className={idx % 2 === 0 ? "bg-white" : "bg-muted-50/50"}
              >
                <td className="w-1/3 px-3 py-1.5 text-muted-500">{formatSpecKey(r.key)}</td>
                <td className="px-3 py-1.5 text-muted-900">{r.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Convert Windows path → file:// URL an toàn cho <img src>. */
function pathToFileUrl(p: string): string {
  const normalized = p.replace(/\\/g, "/");
  const isWindows = /^[A-Za-z]:\//.test(normalized);
  const prefixed = isWindows ? `/${normalized}` : normalized;
  return `file://${prefixed
    .split("/")
    .map((seg, i) => (i === 0 && seg === "" ? "" : encodeURIComponent(seg)))
    .join("/")}`;
}