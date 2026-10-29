"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Menu,
  Search,
  ShoppingCart,
  X,
  Laptop,
  Gamepad2,
  Apple,
  Feather,
  Briefcase,
  Monitor,
  Cpu,
  CircuitBoard,
  MemoryStick,
  MonitorPlay,
  Zap,
  Server,
  HardDrive,
  Thermometer,
  Disc,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCartStore } from "@/stores/cart-store";
import { useBrandName } from "@/lib/hooks/use-brand";
import { HeaderUserMenu } from "@/components/client/layout/header-user-menu";
import { CartBadge } from "@/components/client/layout/cart-badge";
import { cn } from "@/lib/utils";

function catIconFor(label: string): LucideIcon {
  const s = label.toLowerCase();
  if (s.includes("macbook") || s.includes("apple")) return Apple;
  if (s.includes("gaming")) return Gamepad2;
  if (s.includes("ultrabook")) return Feather;
  if (s.includes("văn phòng") || s.includes("office")) return Briefcase;
  if (s.includes("màn")) return Monitor;
  if (s === "cpu" || s.includes("vi xử lý")) return Cpu;
  if (s.includes("bo mạch") || s === "mainboard") return CircuitBoard;
  if (s === "ram" || s.includes("bộ nhớ")) return MemoryStick;
  if (s.includes("vga") || s.includes("card màn hình") || s === "gpu") return MonitorPlay;
  if (s.includes("nguồn")) return Zap;
  if (s.includes("vỏ case") || s === "case") return Server;
  if (s === "ssd" || s.includes("ổ cứng ssd") || s.includes("ổ ssd")) return HardDrive;
  if (s.includes("tản nhiệt")) return Thermometer;
  if (s === "hdd" || s.includes("ổ cứng hdd") || s === "ổ cứng") return Disc;
  return Laptop;
}

const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/so-sanh", label: "So sánh" },
  { href: "/pc-builder", label: "Xây PC" },
  { href: "/test-laptop", label: "Test Laptop" },
  { href: "/dich-vu-sua-chua", label: "Dịch vụ sửa chữa" },
  { href: "/tra-cuu-bao-hanh", label: "Tra cứu bảo hành" },
  { href: "/about", label: "Giới thiệu" },
  { href: "/contact", label: "Liên hệ" },
];

type CategoryOption = {
  value: string;
  label: string;
  count: number;
  slug?: string | null;
  parentId?: string | null;
  parentSlug?: string | null;
};

export function ClientHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{
    id: string; name: string; slug: string; price: number; image?: string | null;
  }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cartBounceAt = useCartStore((s) => s.cartBounceAt);
  const [bounceKey, setBounceKey] = useState(0);
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (cartBounceAt) setBounceKey((k) => k + 1);
  }, [cartBounceAt]);

  const { data: categoriesData } = useQuery({
    queryKey: ["public-product-filters"],
    queryFn: async () => {
      const res = await fetch("/api/public/products/filters");
      if (!res.ok) return { categories: [] as CategoryOption[] };
      return res.json() as Promise<{ categories: CategoryOption[] }>;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const categories = categoriesData?.categories ?? [];
  const catHref = (cat: CategoryOption) =>
    cat.slug
      ? `/products?category=${encodeURIComponent(cat.slug)}`
      : `/products?category=${encodeURIComponent(cat.value)}`;
  const pcCategories = categories.filter((c) => c.parentSlug === "pc-parts");
  const laptopCategories = categories.filter((c) => c.parentSlug !== "pc-parts");

  const openCat = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setCatOpen(true);
  };
  const closeCat = () => {
    closeTimer.current = setTimeout(() => setCatOpen(false), 150);
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current && rootRef.current.contains(target)) return;
      if (mobileSearchRef.current && mobileSearchRef.current.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!debounced) { setResults([]); return; }
    let active = true;
    setIsLoading(true);

    const fetchResults = async () => {
      try {
        const queryString = new URLSearchParams({ q: debounced, limit: "5" }).toString();
        const res = await fetch(`/api/public/products?${queryString}`);
        if (!active) return;
        if (!res.ok) throw new Error("Không tải được kết quả");
        const data = await res.json();
        setResults(data.items ?? []);
      } catch {
        if (active) setResults([]);
      } finally {
        if (active) setIsLoading(false);
      }
    };

    fetchResults();
    return () => { active = false; };
  }, [debounced]);

  const handleSelect = (slug: string) => {
    setQuery(""); setDebounced(""); setResults([]); setOpen(false);
    router.push(`/products/${slug}`);
  };

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between gap-4">
          {/* Logo - brand name lấy động từ settings (localStorage cache). */}
          <Logo />

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-1">
            {NAV_LINKS.map((link) =>
              link.href === "/products" ? (
                <div
                  key={link.href}
                  className="relative"
                  onMouseEnter={openCat}
                  onMouseLeave={closeCat}
                >
                  <button
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      catOpen 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted"
                    )}
                  >
                    {link.label}
                    <ChevronDown className={cn("h-4 w-4 transition-transform", catOpen && "rotate-180")} />
                  </button>

                  {catOpen && (categories.length > 0 || pcCategories.length > 0) && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 top-full z-50 pt-2"
                      onMouseEnter={openCat}
                      onMouseLeave={closeCat}
                    >
                      <div className="w-[600px] max-w-[95vw] rounded-xl border bg-popover shadow-lg p-4">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-semibold uppercase text-muted-foreground">Danh mục</p>
                          <Link href="/products" className="text-xs font-medium text-primary hover:underline">Xem tất cả →</Link>
                        </div>
                        <div className="h-px bg-border mb-4" />

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <Laptop className="h-4 w-4 text-muted-foreground" />
                              <p className="text-sm font-semibold">Laptop</p>
                            </div>
                            <div className="space-y-0.5">
                              {laptopCategories.slice(0, 6).map((cat) => {
                                const CatIcon = catIconFor(cat.label);
                                return (
                                  <Link
                                    key={cat.value}
                                    href={catHref(cat)}
                                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-colors"
                                  >
                                    <CatIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="flex-1 truncate">{cat.label}</span>
                                    <span className="text-xs text-muted-foreground">{cat.count}</span>
                                  </Link>
                                );
                              })}
                            </div>
                          </div>

                          <div className="border-l pl-4">
                            <div className="flex items-center gap-2 mb-2 px-1">
                              <CircuitBoard className="h-4 w-4 text-primary" />
                              <p className="text-sm font-semibold">Linh kiện PC</p>
                            </div>
                            <div className="space-y-0.5">
                              {pcCategories.slice(0, 6).map((cat) => {
                                const CatIcon = catIconFor(cat.label);
                                return (
                                  <Link
                                    key={cat.value}
                                    href={catHref(cat)}
                                    className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted transition-colors"
                                  >
                                    <CatIcon className="h-4 w-4 text-muted-foreground" />
                                    <span className="flex-1 truncate">{cat.label}</span>
                                    <span className="text-xs text-muted-foreground">{cat.count}</span>
                                  </Link>
                                );
                              })}
                            </div>
                            <Link href="/pc-builder" className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-primary px-3 py-2 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                              Xây PC ngay →
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  className="rounded-lg px-3 py-2 text-sm font-medium hover:bg-muted transition-colors"
                >
                  {link.label}
                </Link>
              )
            )}
          </nav>

          {/* Search */}
          <div ref={rootRef} className="hidden md:flex relative max-w-xs flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Tìm kiếm..."
              className="pl-9 h-9"
            />

            {open && (
              <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-lg">
                {isLoading ? (
                  <div className="p-3 space-y-2">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  <ul className="py-1">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(product.slug)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted"
                        >
                          {product.image ? (
                            <div className="relative h-10 w-10 rounded-lg overflow-hidden bg-muted">
                              <img src={product.image} alt={product.name} className="object-cover" />
                            </div>
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-muted" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.price.toLocaleString("vi-VN")} đ</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="p-3 text-sm text-muted-foreground text-center">
                    {query ? `Không tìm thấy "${query}"` : "Gõ tên sản phẩm"}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSearchOpen(!searchOpen)}>
              <Search className="h-5 w-5" />
            </Button>

            <Link href="/cart">
              <Button variant="ghost" size="icon" className="relative">
                <ShoppingCart key={bounceKey} className={cn("h-5 w-5", bounceKey > 0 && "animate-cart-bounce")} />
                <CartBadge />
              </Button>
            </Link>

            <HeaderUserMenu />

            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Mobile Search */}
        {searchOpen && (
          <div className="container pb-3 md:hidden" ref={mobileSearchRef}>
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
              onFocus={() => setOpen(true)}
              placeholder="Tìm kiếm..."
              className="h-10"
            />
          </div>
        )}
      </header>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="fixed inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <div className="fixed right-0 top-0 bottom-0 z-[61] w-72 max-w-[85vw] bg-background p-6 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="font-bold text-lg">Menu</span>
              <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            <nav className="space-y-1">
              {NAV_LINKS.map((link, i) =>
                link.href === "/products" ? (
                  <div key={link.href}>
                    <div className="flex items-center">
                      <Link href={link.href} onClick={() => setMobileOpen(false)} className="flex-1 rounded-lg px-3 py-2 text-base font-medium hover:bg-muted">
                        {link.label}
                      </Link>
                      {categories.length > 0 && (
                        <button type="button" onClick={() => setMobileCatOpen((v) => !v)} className="rounded-lg p-2 hover:bg-muted">
                          <ChevronDown className={cn("h-4 w-4", mobileCatOpen && "rotate-180")} />
                        </button>
                      )}
                    </div>
                    {mobileCatOpen && (
                      <div className="ml-4 mt-2 space-y-4 border-l pl-4">
                        {laptopCategories.length > 0 && (
                          <div>
                            <p className="px-2 py-1 text-xs font-semibold uppercase text-muted-foreground">Laptop</p>
                            {laptopCategories.map((cat) => (
                              <Link key={cat.value} href={catHref(cat)} onClick={() => setMobileOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-muted">
                                <span>{cat.label}</span>
                                <span className="text-xs text-muted-foreground">{cat.count}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                        {pcCategories.length > 0 && (
                          <div>
                            <p className="px-2 py-1 text-xs font-semibold uppercase text-primary">Linh kiện PC</p>
                            {pcCategories.map((cat) => (
                              <Link key={cat.value} href={catHref(cat)} onClick={() => setMobileOpen(false)} className="flex items-center justify-between rounded-lg px-3 py-1.5 text-sm hover:bg-muted">
                                <span>{cat.label}</span>
                                <span className="text-xs text-muted-foreground">{cat.count}</span>
                              </Link>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-3 py-2 text-base font-medium hover:bg-muted">
                    {link.label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

/** Logo: render brand name lấy từ settings, highlight từ đầu (primary) + phần còn lại. */
function Logo() {
  const brand = useBrandName();
  // Tách theo từ để "Laptop Thành Võ" → highlight "Laptop", phần còn lại " Thành Võ".
  const firstSpace = brand.indexOf(" ");
  const highlight = firstSpace === -1 ? brand || "Web" : brand.slice(0, firstSpace);
  const rest = firstSpace === -1 ? "" : brand.slice(firstSpace);
  return (
    <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight">
      <span className="text-primary">{highlight}</span>
      {rest && <span>{rest}</span>}
    </Link>
  );
}
