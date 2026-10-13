import Link from "next/link";
import { getStoreInfoForRequest } from "@/lib/request-shop";
import { getFooterSettings } from "@/lib/footer-settings";
import { telHref } from "@/lib/shop-info";
import { TradeBadge } from "@/components/shared/trade-badge";
import {
  Facebook,
  Youtube,
  Instagram,
  MapPin,
  Phone,
  Mail,
  Clock,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const SOCIAL_ICONS: Record<string, LucideIcon> = {
  facebook: Facebook,
  youtube: Youtube,
  instagram: Instagram,
  tiktok: Facebook, // fallback, dùng Facebook icon
};

export async function ClientFooter() {
  const [store, footerSettings] = await Promise.all([
    getStoreInfoForRequest(),
    getFooterSettings(),
  ]);

  const description = footerSettings.description ?? store.description;
  const columns = footerSettings.columns ?? [];
  const opening = store.opening_hours;
  const socials = store.social_links ?? {};

  const socialEntries = Object.entries({
    facebook: socials.facebook,
    youtube: socials.youtube,
    instagram: socials.instagram,
    tiktok: socials.tiktok,
  }).filter(([, url]) => !!url) as [string, string][];

  // Gộp nhóm cột để hiển thị gọn: lấy tối đa 3 cột, mỗi cột tối đa 5 link.
  // Đồng thời resolve template `{{brandName}}` trong title/label (để mặc định
  // động theo store.name, không phải hardcode).
  const resolveTemplate = (s: string) =>
    s.replace(/\{\{\s*brandName\s*\}\}/gi, store.name ?? "");
  const visibleColumns = columns.slice(0, 3).map((c) => ({
    ...c,
    title: resolveTemplate(c.title),
    links: c.links.slice(0, 5).map((l) => ({
      ...l,
      label: resolveTemplate(l.label),
    })),
  }));

  // Format giờ mở cửa gọn, dễ đọc. Hỗ trợ cả field cũ `weekend` (alias
  // cho "Thứ 7 + Chủ nhật"). Mỗi dòng có prefix ngày nếu biết.
  const hoursParts: string[] = [];
  if (opening?.weekday) {
    hoursParts.push(`T2-T6: ${opening.weekday}`);
  }
  if (opening?.saturday) {
    hoursParts.push(`T7: ${opening.saturday}`);
  } else if (opening?.weekend) {
    hoursParts.push(`Cuối tuần: ${opening.weekend}`);
  }
  if (opening?.sunday) {
    hoursParts.push(`CN: ${opening.sunday}`);
  }
  if (opening?.holidays) {
    hoursParts.push(`Lễ: ${opening.holidays}`);
  }
  const hoursLine = hoursParts.length
    ? hoursParts.join(" · ")
    : "8:00 - 21:00";

  return (
    <footer className="relative z-10 border-t bg-muted/40">
      <div className="container py-10 sm:py-12">
        {/* Main grid: 4 cols on desktop (Brand + 3 link groups) */}
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">
                {store.name?.slice(0, 3) || "Web"}
              </span>
              <span>{store.name || "Website"}</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
            {socialEntries.length > 0 && (
              <div className="flex items-center gap-2">
                {socialEntries.map(([key, url]) => {
                  const Icon = SOCIAL_ICONS[key] ?? Facebook;
                  return (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={key}
                      className="flex h-9 w-9 items-center justify-center rounded-full border bg-background text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      <Icon className="h-4 w-4" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* Link columns */}
          {visibleColumns.map((column) => (
            <div key={column.id} className="space-y-3">
              <h4 className="text-sm font-semibold tracking-wide">{column.title}</h4>
              <ul className="space-y-2">
                {column.links.map((link) => (
                  <li key={link.id}>
                    <Link
                      href={link.href}
                      target={link.external ? "_blank" : undefined}
                      rel={link.external ? "noopener noreferrer" : undefined}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Contact strip — 4 mini cells, dense and scan-friendly */}
        <div className="mt-8 grid grid-cols-2 gap-3 rounded-xl border bg-background/60 p-4 sm:grid-cols-4 sm:gap-4 sm:p-5">
          <ContactCell
            icon={MapPin}
            label="Địa chỉ"
            value={store.address}
            className="col-span-2 sm:col-span-1"
          />
          <ContactCell
            icon={Phone}
            label="Hotline"
            value={store.hotline ?? store.phone}
            href={telHref(store.hotline ?? store.phone) ?? undefined}
          />
          <ContactCell
            icon={Mail}
            label="Email"
            value={store.email}
            href={`mailto:${store.email}`}
            breakAll
          />
          <ContactCell icon={Clock} label="Giờ mở cửa" value={hoursLine} />
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:gap-4">
          <p className="text-center sm:text-left">
            © {new Date().getFullYear()} {store.legal.business_name} · MST:{" "}
            <span className="font-semibold text-foreground">{store.legal.tax_id}</span>
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:gap-6">
            <Link href="/dieu-khoan-su-dung" className="hover:text-foreground">
              Điều khoản
            </Link>
            <Link href="/chinh-sach-bao-mat" className="hover:text-foreground">
              Bảo mật
            </Link>
            <TradeBadge />
          </div>
        </div>
      </div>
    </footer>
  );
}

function ContactCell({
  icon: Icon,
  label,
  value,
  href,
  breakAll,
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  href?: string;
  breakAll?: boolean;
  className?: string;
}) {
  const inner = (
    <div className={cn("flex items-start gap-3", className)}>
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className={cn("mt-0.5 text-sm font-medium text-foreground", breakAll && "break-all")}>
          {value}
        </p>
      </div>
    </div>
  );
  if (href) {
    return (
      <a href={href} className="rounded-lg transition-colors hover:bg-primary/5">
        {inner}
      </a>
    );
  }
  return inner;
}
