import Link from "next/link";
import { getStoreInfoCached } from "@/lib/store-info-cached";
import { getFooterSettingsCached } from "@/lib/footer-settings-cached";
import { telHref } from "@/lib/shop-info";
import { TradeBadge } from "@/components/shared/trade-badge";
import { FooterColumns } from "@/components/client/layout/footer-columns";
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
    // Dùng bản `unstable_cache` (có tag "store-info"/"footer-settings") thay vì
    // `getStoreInfo()` trần. Lý do: footer nằm trong layout của MỌI trang
    // public → nếu đọc DB trực tiếp thì mỗi request đều query Supabase.
    // Bản cached được `revalidateTag("store-info")` xoá ngay khi admin lưu
    // settings (xem server/services/settings-service.ts) → vẫn cập nhật tức thì,
    // chỉ khác là cache hit thay vì query mỗi lượt.
    getStoreInfoCached(),
    getFooterSettingsCached(),
  ]);

  const description = footerSettings.description ?? store.description;
  const columns = footerSettings.columns ?? [];
  const opening = store.opening_hours;
  const socials = store.social_links ?? {};
  // Phương thức thanh toán do admin cấu hình ở tab "Footer" (Settings).
  // Lọc bỏ chuỗi rỗng để không render badge trống.
  const paymentMethods = (footerSettings.payment_methods ?? []).filter(
    (m) => typeof m === "string" && m.trim().length > 0,
  );
  // Copyright tuỳ chỉnh (nếu admin có khai báo) → fallback về năm + tên pháp nhân.
  const copyrightText =
    footerSettings.copyright?.trim() ||
    `© ${new Date().getFullYear()} ${store.legal.business_name}`;

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
      <div className="container py-8 sm:py-12">
        {/* Main grid: 4 cols on desktop (Brand + 3 link groups) */}
        <div className="grid gap-6 lg:grid-cols-4 lg:gap-8">
          {/* Brand */}
          <div className="space-y-3 sm:space-y-4">
            <Link href="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight">
              {/* Monogram: chữ đầu của tên thương hiệu (tránh lặp tên bên cạnh) */}
              <span className="rounded-md bg-primary px-1.5 py-0.5 text-primary-foreground">
                {(store.name?.trim().charAt(0) || "W").toUpperCase()}
              </span>
              <span>{store.name || "Website"}</span>
            </Link>
            <p className="hidden max-w-xs text-sm leading-relaxed text-muted-foreground sm:block">
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

          {/* Link columns — accordion trên mobile, expanded list trên desktop. */}
          <FooterColumns columns={visibleColumns} />
        </div>

        {/* Contact strip — 4 mini cells, dense and scan-friendly */}
        <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl border bg-background/60 p-3 sm:mt-8 sm:grid-cols-4 sm:gap-4 sm:p-5">
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

        {/* Payment methods — do admin cấu hình ở tab "Footer" (Settings). */}
        {paymentMethods.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="mr-1 shrink-0 font-medium">Thanh toán:</span>
            {paymentMethods.map((method, idx) => (
              <span
                key={`${method}-${idx}`}
                className="rounded-md border bg-background px-2 py-1 font-medium text-foreground"
              >
                {method}
              </span>
            ))}
          </div>
        )}

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-center justify-between gap-3 border-t pt-5 text-xs text-muted-foreground sm:flex-row sm:gap-4">
          <p className="text-center sm:text-left">
            {copyrightText} · MST:{" "}
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
