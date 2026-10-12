"use client";

/**
 * CommandPalette + CommandPaletteTrigger.
 * Ctrl+K / Cmd+K mở dialog tìm kiếm nhanh các trang admin + actions.
 * Có recent items (localStorage) và keyboard navigation.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  SearchIcon,
  ArrowRightIcon,
  CornerDownLeftIcon,
  CommandIcon,
  BarChart3Icon,
  PackageIcon,
  ShoppingCartIcon,
  UsersIcon,
  WarehouseIcon,
  ShieldCheckIcon,
  ShieldIcon,
  WrenchIcon,
  FileTextIcon,
  CalculatorIcon,
  TagIcon,
  SparklesIcon,
  TruckIcon,
  ClipboardListIcon,
  ReceiptIcon,
  FileClockIcon,
  BanknoteIcon,
  TicketIcon,
  SettingsIcon,
  MailIcon,
  UserCogIcon,
  UserPlusIcon,
  Building2Icon,
  Music2Icon,
  CpuIcon,
  LayersIcon,
  PlusIcon,
  XIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type Item = {
  id: string;
  title: string;
  group: string;
  href: string;
  icon: React.ElementType;
  keywords?: string[];
};

const ADMIN_ITEMS: Item[] = [
  { id: "dashboard", title: "Tổng quan", group: "Chính", href: "/quanly", icon: BarChart3Icon, keywords: ["dashboard", "home"] },
  { id: "reports-revenue", title: "Báo cáo doanh thu", group: "Báo cáo", href: "/quanly/bao-cao/doanh-thu", icon: BanknoteIcon, keywords: ["revenue", "doanh thu"] },
  { id: "reports-product", title: "Báo cáo sản phẩm", group: "Báo cáo", href: "/quanly/bao-cao/san-pham", icon: PackageIcon },
  { id: "reports-customer", title: "Báo cáo khách hàng", group: "Báo cáo", href: "/quanly/bao-cao/khach-hang", icon: UsersIcon },
  { id: "reports-stock", title: "Báo cáo kho", group: "Báo cáo", href: "/quanly/bao-cao/kho", icon: WarehouseIcon },
  { id: "reports-staff", title: "Báo cáo nhân viên", group: "Báo cáo", href: "/quanly/bao-cao/nhan-vien", icon: UserCogIcon },
  { id: "reports-repair", title: "Báo cáo sửa chữa", group: "Báo cáo", href: "/quanly/bao-cao/sua-chua", icon: WrenchIcon },
  { id: "reports-warranty", title: "Báo cáo bảo hành", group: "Báo cáo", href: "/quanly/bao-cao/bao-hanh", icon: ShieldCheckIcon },
  { id: "reports-voucher", title: "Báo cáo voucher", group: "Báo cáo", href: "/quanly/bao-cao/voucher", icon: TicketIcon },

  { id: "products", title: "Sản phẩm", group: "Sản phẩm", href: "/quanly/products", icon: PackageIcon },
  { id: "variants", title: "Biến thể sản phẩm", group: "Sản phẩm", href: "/quanly/product-variants", icon: LayersIcon, keywords: ["variant"] },
  { id: "categories", title: "Danh mục", group: "Sản phẩm", href: "/quanly/categories", icon: TagIcon },
  { id: "brands", title: "Thương hiệu", group: "Sản phẩm", href: "/quanly/brands", icon: TagIcon, keywords: ["brand"] },
  { id: "gifts", title: "Quà tặng kèm", group: "Sản phẩm", href: "/quanly/product-gifts", icon: SparklesIcon },
  { id: "spec-templates", title: "Mẫu thông số", group: "Sản phẩm", href: "/quanly/spec-templates", icon: FileTextIcon },
  { id: "pc-builds", title: "Cấu hình PC đã lưu", group: "Sản phẩm", href: "/quanly/pc-builds", icon: FileTextIcon },
  { id: "pc-components", title: "Specs linh kiện PC", group: "Sản phẩm", href: "/quanly/pc-components-specs", icon: FileTextIcon },

  { id: "orders", title: "Đơn hàng", group: "Bán hàng", href: "/quanly/orders", icon: ShoppingCartIcon },
  { id: "pos", title: "POS bán hàng", group: "Bán hàng", href: "/quanly/pos", icon: CalculatorIcon, keywords: ["bán", "sell", "point of sale"] },
  { id: "pos-sessions", title: "Ca POS", group: "Bán hàng", href: "/quanly/pos-sessions", icon: CalculatorIcon },
  { id: "payments", title: "Thanh toán", group: "Bán hàng", href: "/quanly/payments", icon: ReceiptIcon },
  { id: "return-orders", title: "Đơn trả hàng", group: "Bán hàng", href: "/quanly/return-orders", icon: ShoppingCartIcon, keywords: ["return", "refund"] },

  { id: "warehouses", title: "Kho hàng", group: "Kho & Tồn", href: "/quanly/warehouses", icon: WarehouseIcon },
  { id: "stock-levels", title: "Tồn kho", group: "Kho & Tồn", href: "/quanly/stock-levels", icon: ClipboardListIcon },
  { id: "inventory-transfer", title: "Chuyển kho", group: "Kho & Tồn", href: "/quanly/inventory/transfer", icon: TruckIcon, keywords: ["transfer"] },
  { id: "inventory-tx", title: "Giao dịch kho", group: "Kho & Tồn", href: "/quanly/inventory-transactions", icon: FileClockIcon },
  { id: "serial-numbers", title: "Serial / IMEI", group: "Kho & Tồn", href: "/quanly/serial-numbers", icon: ReceiptIcon },
  { id: "purchase-orders", title: "Phiếu nhập", group: "Kho & Tồn", href: "/quanly/purchase-orders", icon: TruckIcon, keywords: ["po", "purchase"] },
  { id: "suppliers", title: "Nhà cung cấp", group: "Kho & Tồn", href: "/quanly/suppliers", icon: TruckIcon, keywords: ["ncc"] },

  { id: "customers", title: "Khách hàng", group: "Khách hàng", href: "/quanly/customers", icon: UsersIcon, keywords: ["customer"] },
  { id: "tradein", title: "Yêu cầu thu cũ", group: "Khách hàng", href: "/quanly/trade-in-requests", icon: FileTextIcon, keywords: ["tradein"] },

  { id: "warranties", title: "Bảo hành", group: "Hậu mãi", href: "/quanly/warranties", icon: ShieldCheckIcon, keywords: ["warranty"] },
  { id: "repair-tickets", title: "Phiếu sửa chữa", group: "Hậu mãi", href: "/quanly/repair-tickets", icon: ShieldIcon, keywords: ["repair", "sửa"] },
  { id: "repair-services", title: "Bảng giá sửa chữa", group: "Hậu mãi", href: "/quanly/repair-services", icon: WrenchIcon },
  { id: "speaker-songs", title: "Nhạc test loa", group: "Hậu mãi", href: "/quanly/speaker-songs", icon: Music2Icon },
  { id: "tools", title: "Công cụ kiểm tra", group: "Hậu mãi", href: "/quanly/tools", icon: CpuIcon },

  { id: "organizations", title: "Tổ chức", group: "Hệ thống", href: "/quanly/organizations", icon: Building2Icon },
  { id: "shops", title: "Cửa hàng", group: "Hệ thống", href: "/quanly/shops", icon: Building2Icon },
  { id: "roles", title: "Vai trò", group: "Hệ thống", href: "/quanly/roles", icon: UserCogIcon },
  { id: "shop-staff", title: "Nhân sự shop", group: "Hệ thống", href: "/quanly/shop-staff", icon: UsersIcon },
  { id: "admin-users", title: "Tạo tài khoản", group: "Hệ thống", href: "/quanly/admin/users", icon: UserPlusIcon },
  { id: "newsletter", title: "Newsletter", group: "Hệ thống", href: "/quanly/newsletter", icon: MailIcon },
  { id: "settings", title: "Cài đặt", group: "Hệ thống", href: "/quanly/settings", icon: SettingsIcon },
  { id: "about-page", title: "Trang About", group: "Hệ thống", href: "/quanly/about-page", icon: FileTextIcon },
  { id: "audit-logs", title: "Audit logs", group: "Hệ thống", href: "/quanly/audit-logs", icon: FileClockIcon, keywords: ["log", "nhật ký"] },
];

const RECENT_KEY = "admin-cmd-recent";
const MAX_RECENT = 5;

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span className="font-bold text-primary">{text.slice(idx, idx + query.length)}</span>
      {text.slice(idx + query.length)}
    </>
  );
}

function scoreItem(item: Item, query: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  let score = 0;
  const title = item.title.toLowerCase();
  if (title === q) score += 1000;
  if (title.startsWith(q)) score += 500;
  if (title.includes(q)) score += 200;
  if (item.keywords?.some((k) => k.toLowerCase().includes(q))) score += 100;
  if (item.group.toLowerCase().includes(q)) score += 50;
  return score;
}

function PaletteRow({
  item,
  active,
  onClick,
  idx,
  query,
}: {
  item: Item;
  active: boolean;
  onClick: () => void;
  idx: number;
  query: string;
}) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      data-idx={idx}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm transition-colors",
        active ? "bg-accent text-accent-foreground" : "hover:bg-muted/60",
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate">{highlight(item.title, query)}</p>
        <p className="truncate text-[10px] text-muted-foreground">{item.group}</p>
      </div>
      <ArrowRightIcon className={cn("h-3.5 w-3.5 shrink-0 transition-opacity", active ? "opacity-100" : "opacity-0")} />
    </button>
  );
}

function PaletteBody({
  query,
  setQuery,
  activeIndex,
  setActiveIndex,
  recentIds,
  onSelect,
  inputRef,
  listRef,
}: {
  query: string;
  setQuery: (v: string) => void;
  activeIndex: number;
  setActiveIndex: (updater: (i: number) => number) => void;
  recentIds: string[];
  onSelect: (item: Item) => void;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
}) {
  const router = useRouter();

  const recentItems = useMemo(
    () => recentIds.map((id) => ADMIN_ITEMS.find((i) => i.id === id)).filter((x): x is Item => !!x),
    [recentIds],
  );

  const results = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return ADMIN_ITEMS;
    return [...ADMIN_ITEMS]
      .map((i) => ({ item: i, score: scoreItem(i, trimmed) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item);
  }, [query]);

  // Auto-scroll active row into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${activeIndex}"]`) as HTMLElement | null;
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [activeIndex, listRef]);

  // Reset active khi results đổi
  useEffect(() => {
    setActiveIndex(() => 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = results[activeIndex];
      if (item) onSelect(item);
    }
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of results) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    return Array.from(map.entries());
  }, [results]);

  return (
    <>
      <div className="flex items-center gap-2 border-b px-3">
        <SearchIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Tìm trang hoặc gõ lệnh (VD: đơn, kho, sửa, voucher)..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          className="flex h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground sm:inline">
          ESC
        </kbd>
      </div>

      <div ref={listRef} className="max-h-[60vh] overflow-y-auto p-1.5">
        {!query.trim() && recentItems.length > 0 && (
          <div className="mb-2">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Gần đây
            </p>
            {recentItems.map((item) => {
              const idx = recentItems.indexOf(item);
              return (
                <PaletteRow
                  key={`recent-${item.id}`}
                  item={item}
                  active={idx === activeIndex}
                  onClick={() => onSelect(item)}
                  idx={idx}
                  query=""
                />
              );
            })}
          </div>
        )}

        {query.trim() && results.length === 0 && (
          <div className="flex flex-col items-center gap-1 py-12 text-center text-muted-foreground">
            <SearchIcon className="h-7 w-7 opacity-40" />
            <p className="text-sm">Không tìm thấy kết quả cho &ldquo;{query}&rdquo;</p>
          </div>
        )}

        {grouped.map(([group, items]) => (
          <div key={group} className="mb-1 last:mb-0">
            <p className="sticky top-0 z-10 bg-popover px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group}
            </p>
            {items.map((item) => {
              const idx = results.indexOf(item);
              return (
                <PaletteRow
                  key={item.id}
                  item={item}
                  active={idx === activeIndex}
                  onClick={() => onSelect(item)}
                  idx={idx}
                  query={query.trim()}
                />
              );
            })}
          </div>
        ))}

        {!query.trim() && recentItems.length === 0 && (
          <div>
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Tất cả trang
            </p>
            {ADMIN_ITEMS.slice(0, 8).map((item, idx) => (
              <PaletteRow
                key={item.id}
                item={item}
                active={idx === activeIndex}
                onClick={() => onSelect(item)}
                idx={idx}
                query=""
              />
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-2 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">↑↓</kbd>
          Di chuyển
        </span>
        <span className="flex items-center gap-1">
          <CornerDownLeftIcon className="h-3 w-3" />
          Chọn
        </span>
        <span className="ml-auto flex items-center gap-1">
          <CommandIcon className="h-3 w-3" />
          <kbd className="rounded border bg-muted px-1.5 py-0.5 font-mono">Ctrl K</kbd>
        </span>
      </div>
    </>
  );
}

/** Standalone palette — controlled open/close từ prop. */
export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      try {
        const raw = localStorage.getItem(RECENT_KEY);
        if (raw) setRecentIds(JSON.parse(raw));
      } catch {}
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  function selectItem(item: Item) {
    try {
      const next = [item.id, ...recentIds.filter((id) => id !== item.id)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {}
    onOpenChange(false);
    router.push(item.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="!w-[calc(100vw-1.5rem)] !max-w-[640px] !gap-0 !p-0 sm:!w-full"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Command Palette</DialogTitle>
        <DialogDescription className="sr-only">Tìm nhanh trang quản lý</DialogDescription>
        <PaletteBody
          query={query}
          setQuery={setQuery}
          activeIndex={activeIndex}
          setActiveIndex={setActiveIndex}
          recentIds={recentIds}
          onSelect={selectItem}
          inputRef={inputRef}
          listRef={listRef}
        />
      </DialogContent>
    </Dialog>
  );
}

/** Trigger — nút search bar + button ở SiteHeader. Quản lý state mở/đóng. */
export function CommandPaletteTrigger() {
  const [isMac, setIsMac] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setIsMac(/mac/i.test(navigator.platform));
    }
  }, []);

  // Mở bằng Ctrl+K toàn cục (ngoài header)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden h-8 items-center gap-1.5 rounded-md border bg-muted/50 px-2.5 text-xs text-muted-foreground transition hover:bg-muted md:flex"
        aria-label="Mở command palette"
      >
        <SearchIcon className="h-3.5 w-3.5" />
        <span>Tìm nhanh...</span>
        <kbd className="ml-1 rounded border bg-background px-1.5 py-0.5 font-mono text-[10px]">
          {isMac ? "⌘" : "Ctrl"} K
        </kbd>
      </button>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition hover:bg-accent md:hidden"
        aria-label="Mở command palette"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
      <CommandPalette open={open} onOpenChange={setOpen} />
    </>
  );
}

// Re-export icons used externally to keep tree-shake aware
export { PlusIcon, XIcon };
