"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  ChevronDown,
  Menu,
  Search,
  ShoppingCart,
  User,
  X,
  Laptop,
  Gamepad2,
  Apple,
  Feather,
  Briefcase,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

function catIconFor(label: string): LucideIcon {
  const s = label.toLowerCase();
  if (s.includes("macbook") || s.includes("apple")) return Apple;
  if (s.includes("gaming")) return Gamepad2;
  if (s.includes("ultrabook")) return Feather;
  if (s.includes("văn phòng") || s.includes("office")) return Briefcase;
  if (s.includes("màn")) return Monitor;
  return Laptop;
}

const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/test-laptop", label: "Test Laptop" },
  { href: "/dich-vu-sua-chua", label: "Dịch vụ sửa chữa" },
  { href: "/tra-cuu-bao-hanh", label: "Tra cứu bảo hành" },
  { href: "/about", label: "Giới thiệu" },
  { href: "/contact", label: "Liên hệ" },
];

type CategoryOption = { value: string; label: string; count: number };

export function ClientHeader() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<{ id: string; name: string; slug: string; price: number; image?: string | null }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const cartCount = 0;
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mobileSearchRef = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dùng React Query để cache danh mục — chỉ fetch 1 lần, navigate qua lại không fetch lại
  const { data: categoriesData } = useQuery({
    queryKey: ["public-product-filters"],
    queryFn: async () => {
      const res = await fetch("/api/public/products/filters");
      if (!res.ok) return { categories: [] as CategoryOption[] };
      return res.json() as Promise<{ categories: CategoryOption[] }>;
    },
    staleTime: 5 * 60 * 1000,   // 5 phút
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const categories = categoriesData?.categories ?? [];

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
      if (
        rootRef.current && rootRef.current.contains(target)
      ) {
        return;
      }
      if (
        mobileSearchRef.current && mobileSearchRef.current.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  useEffect(() => {
    if (!debounced) {
      setResults([]);
      return;
    }

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
    return () => {
      active = false;
    };
  }, [debounced]);

  const handleSelect = (slug: string) => {
    setQuery("");
    setDebounced("");
    setResults([]);
    setOpen(false);
    router.push(`/products/${slug}`);
  };

  return (
    <>
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between gap-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 font-bold text-xl tracking-tight shrink-0">
          <span className="text-primary">Lap</span>
          <span>Lap</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          {NAV_LINKS.map((link) =>
            link.href === "/products" ? (
              <div
                key={link.href}
                className="relative"
                onMouseEnter={openCat}
                onMouseLeave={closeCat}
              >
                <Link
                  href={link.href}
                  className="flex items-center gap-1 transition-colors hover:text-primary"
                >
                  {link.label}
                  <ChevronDown
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${catOpen ? "rotate-180" : ""}`}
                  />
                </Link>

                {/* Dropdown danh mục — hiện khi hover */}
                {catOpen && categories.length > 0 && (
                  <div
                    className="absolute left-1/2 -translate-x-1/2 top-full z-50 pt-3"
                    onMouseEnter={openCat}
                    onMouseLeave={closeCat}
                  >
                    {/* Bridge area to prevent gap between nav and dropdown */}
                    <div className="absolute -top-3 left-0 right-0 h-3" />
                    <div className="w-[420px] animate-fade-in-down rounded-2xl border border-border/60 bg-popover p-3 text-popover-foreground shadow-2xl">
                      {/* Header */}
                      <div className="mb-2 flex items-center justify-between px-1">
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Danh mục sản phẩm</p>
                        <Link
                          href="/products"
                          className="text-xs font-medium text-primary hover:underline"
                        >
                          Xem tất cả →
                        </Link>
                      </div>
                      <div className="mb-2 h-px bg-border" />
                      {/* Grid 2 cols */}
                      <div className="grid grid-cols-2 gap-1">
                        {categories.map((cat) => {
                          const CatIcon = catIconFor(cat.label);
                          return (
                            <Link
                              key={cat.value}
                              href={`/products?category=${encodeURIComponent(cat.value)}`}
                              className="group flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition-all duration-150 hover:bg-accent hover:text-primary"
                            >
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/50 transition-all duration-150 group-hover:border-primary/20 group-hover:bg-primary/5">
                                <CatIcon className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium leading-tight">{cat.label}</p>
                                <p className="text-[11px] text-muted-foreground">{cat.count} sản phẩm</p>
                              </div>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="transition-colors hover:text-primary"
              >
                {link.label}
              </Link>
            ),
          )}
        </nav>

        {/* Desktop search */}
        <div ref={rootRef} className="hidden md:flex relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Tìm kiếm laptop..."
            className="pl-9 h-9"
            aria-label="Tìm kiếm laptop"
          />

          {(open || query) && (
            <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-b-lg border border-border bg-popover text-popover-foreground shadow-lg">
              {isLoading ? (
                <div className="space-y-2 p-3">
                  {[1, 2, 3].map((item) => (
                    <div key={item} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted p-3 animate-pulse">
                      <div className="h-12 w-12 rounded-lg bg-muted" />
                      <div className="min-w-0 flex-1 space-y-2">
                        <div className="h-3 w-3/4 rounded bg-muted" />
                        <div className="h-3 w-1/3 rounded bg-muted" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : results.length > 0 ? (
                <ul className="py-1">
                  {results.map((product) => (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => handleSelect(product.slug)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                      >
                        {product.image ? (
                          <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                            <Image
                              src={product.image}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          </div>
                        ) : (
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-[10px] text-muted-foreground">
                            No img
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-medium text-sm text-foreground">{product.name}</div>
                          <div className="text-xs text-muted-foreground">{product.price.toLocaleString("vi-VN")} đ</div>
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="px-3 py-2 text-sm text-muted-foreground">
                  {query ? `Không tìm thấy sản phẩm phù hợp với "${query}"` : "Gõ tên sản phẩm để tìm"}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setSearchOpen(!searchOpen)}
          >
            <Search className="h-5 w-5" />
          </Button>

          <Link href="/cart">
            <Button variant="ghost" size="icon" className="relative">
              <ShoppingCart className="h-5 w-5" />
              {cartCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px]">
                  {cartCount}
                </Badge>
              )}
            </Button>
          </Link>

          <Link href="/account">
            <Button variant="ghost" size="icon">
              <User className="h-5 w-5" />
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Mobile search */}
      {searchOpen && (
        <div className="container pb-3 md:hidden" ref={mobileSearchRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              placeholder="Tìm kiếm laptop..."
              className="pl-9 h-9"
              aria-label="Tìm kiếm laptop"
            />
            {open && (
              <div className="absolute inset-x-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-b-lg border border-border bg-popover text-popover-foreground shadow-lg">
                {isLoading ? (
                  <div className="space-y-2 p-3">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="flex items-center gap-3 rounded-xl border border-border/50 bg-muted p-3 animate-pulse">
                        <div className="h-10 w-10 rounded-lg bg-muted" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <div className="h-3 w-3/4 rounded bg-muted" />
                          <div className="h-3 w-1/3 rounded bg-muted" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : results.length > 0 ? (
                  <ul className="py-1">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onClick={() => handleSelect(product.slug)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-muted/50"
                        >
                          {product.image ? (
                            <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
                              <Image
                                src={product.image}
                                alt={product.name}
                                fill
                                className="object-cover"
                              />
                            </div>
                          ) : (
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-border bg-muted text-xs text-muted-foreground">
                              Ảnh
                            </div>
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="truncate font-medium">{product.name}</div>
                            <div className="text-xs text-muted-foreground">{product.price.toLocaleString("vi-VN")} đ</div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="px-3 py-2 text-sm text-muted-foreground">
                    {query ? `Không tìm thấy sản phẩm phù hợp với "${query}"` : "Gõ tên sản phẩm để tìm"}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </header>

    {/* Mobile overlay — đặt NGOÀI <header> vì header có backdrop-blur tạo containing block,
        khiến phần tử fixed con bị giới hạn trong vùng header thay vì phủ toàn màn hình. */}
    {mobileOpen && (
      <div className="fixed inset-0 z-[60] md:hidden">
        <div className="fixed inset-0 animate-fade-in bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
        <div className="fixed right-0 top-0 bottom-0 z-[61] w-72 max-w-[80vw] animate-in slide-in-from-right duration-300 overflow-y-auto border-l bg-white p-6 shadow-xl dark:bg-neutral-950">
          <div className="flex items-center justify-between mb-8">
            <span className="font-bold text-lg">Menu</span>
            <Button variant="ghost" size="icon" onClick={() => setMobileOpen(false)}>
              <X className="h-5 w-5" />
            </Button>
          </div>
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link, i) =>
              link.href === "/products" ? (
                <div key={link.href} style={{ animationDelay: `${i * 40}ms` }} className="animate-fade-in-up">
                  <div className="flex items-center">
                    <Link
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="flex-1 rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-primary"
                    >
                      {link.label}
                    </Link>
                    {categories.length > 0 && (
                      <button
                        type="button"
                        aria-label="Mở danh mục"
                        onClick={() => setMobileCatOpen((v) => !v)}
                        className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent"
                      >
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${mobileCatOpen ? "rotate-180" : ""}`}
                        />
                      </button>
                    )}
                  </div>
                  {mobileCatOpen && categories.length > 0 && (
                    <div className="mt-1 flex flex-col gap-0.5 border-l pl-3">
                      {categories.map((cat) => (
                        <Link
                          key={cat.value}
                          href={`/products?category=${encodeURIComponent(cat.value)}`}
                          onClick={() => setMobileOpen(false)}
                          className="flex items-center justify-between gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors hover:bg-accent hover:text-primary"
                        >
                          <span className="truncate">{cat.label}</span>
                          <span className="shrink-0 text-xs text-muted-foreground">{cat.count}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className="animate-fade-in-up rounded-lg px-3 py-2 text-base font-medium transition-colors hover:bg-accent hover:text-primary"
                >
                  {link.label}
                </Link>
              ),
            )}
          </nav>
        </div>
      </div>
    )}
    </>
  );
}
