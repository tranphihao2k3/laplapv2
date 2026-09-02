import type { Metadata } from "next";
import Link from "next/link";
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  MessageCircle,
  Facebook,
  Send,
  Building2,
  ArrowRight,
  Globe,
  Video,
} from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { telHref } from "@/lib/shop-info";
import { Reveal } from "@/components/client/home/reveal";
import { ContactForm } from "@/components/shared/contact-form";
import { ContactChannels } from "@/components/client/contact/contact-channels";

const SITE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    title: "Liên hệ",
    description: `Liên hệ với ${store.name} - Hệ thống bán lẻ laptop chính hãng tại Cần Thơ. Hotline ${store.phone}, showroom tại ${store.address}.`,
    alternates: { canonical: `${SITE}/contact` },
    openGraph: {
      type: "website",
      title: `Liên hệ với ${store.name}`,
      description: `Hotline ${store.phone} · ${store.address}`,
      url: `${SITE}/contact`,
      siteName: store.name,
      locale: "vi_VN",
    },
  };
}

export default async function ContactPage() {
  const store = await getStoreInfo();
  const tel = telHref(store.phone);

  // Encode địa chỉ cho Google Maps embed
  const mapsQuery = encodeURIComponent(store.address);
  const mapsEmbedUrl = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  // Build opening hours display from store.opening_hours
  const hoursDisplay = [];
  if (store.opening_hours?.weekday) {
    hoursDisplay.push({ day: "Thứ 2 - Thứ 6", time: store.opening_hours.weekday });
  }
  if (store.opening_hours?.saturday) {
    hoursDisplay.push({ day: "Thứ 7", time: store.opening_hours.saturday });
  }
  if (store.opening_hours?.sunday) {
    hoursDisplay.push({ day: "Chủ nhật", time: store.opening_hours.sunday });
  }
  if (store.opening_hours?.weekend) {
    hoursDisplay.push({ day: "Cuối tuần", time: store.opening_hours.weekend });
  }
  if (store.opening_hours?.holidays) {
    hoursDisplay.push({ day: "Ngày lễ", time: store.opening_hours.holidays });
  }
  // Fallback if nothing set
  if (hoursDisplay.length === 0) {
    hoursDisplay.push({ day: "Thứ 2 - Thứ 6", time: "8:00 - 21:00" });
    hoursDisplay.push({ day: "Thứ 7", time: "8:00 - 22:00" });
    hoursDisplay.push({ day: "Chủ nhật", time: "9:00 - 20:00" });
  }

  return (
    <div className="pb-20">
      {/* Hero */}
      <section className="container pt-6 md:pt-10">
        <Reveal variant="clip-up">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-16 text-center shadow-sm md:px-16 md:py-24 dark:border-slate-800">
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-emerald-500/15 blur-[100px]" />

            <div className="relative z-10 mx-auto max-w-3xl">
              <Reveal variant="fade-up" delay={150}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 backdrop-blur-md">
                  <MessageCircle className="h-3.5 w-3.5 text-emerald-400" /> Liên hệ với chúng tôi
                </span>
              </Reveal>
              <Reveal variant="slide-split" delay={250}>
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl">
                  Chúng tôi sẵn sàng
                  <br />
                  <span className="bg-gradient-to-r from-emerald-400 to-blue-400 bg-clip-text text-transparent">
                    lắng nghe bạn.
                  </span>
                </h1>
              </Reveal>
              <Reveal variant="fade-up" delay={350}>
                <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-slate-300 md:text-lg">
                  Mọi thắc mắc về sản phẩm, đơn hàng, bảo hành — đội ngũ LapLap phản hồi trong
                  vòng 24 giờ làm việc.
                </p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Quick contact channels */}
      <section className="container pt-12 md:pt-16">
        <ContactChannels />
      </section>

      {/* Form + Info */}
      <section className="container pt-16 md:pt-20">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
          {/* Form */}
          <Reveal variant="fade-right" className="lg:col-span-3">
            <div className="rounded-3xl border border-border bg-card p-6 text-card-foreground shadow-sm md:p-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
                  Gửi tin nhắn cho {store.name}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Điền thông tin bên dưới — chúng tôi sẽ phản hồi qua email hoặc SĐT bạn cung cấp.
                </p>
              </div>
              <ContactForm />
            </div>
          </Reveal>

          {/* Info card */}
          <Reveal variant="fade-left" className="lg:col-span-2">
            <div className="flex h-full flex-col rounded-3xl border border-border bg-muted/40 p-6 md:p-8">
              <h2 className="text-xl font-bold tracking-tight text-foreground md:text-2xl">
                Thông tin cửa hàng
              </h2>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-foreground">{store.legal.business_name}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      MST: {store.legal.tax_id} · ĐKKD:{" "}
                      {store.legal.business_registration_number}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Địa chỉ showroom</p>
                    <p className="mt-0.5 text-muted-foreground">{store.address}</p>
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
                    >
                      Mở Google Maps <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Hotline</p>
                    {tel ? (
                      <a
                        href={tel}
                        className="mt-0.5 block text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        {store.phone}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-muted-foreground">{store.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <a
                      href={`mailto:${store.email}`}
                      className="mt-0.5 block break-all text-muted-foreground hover:text-blue-600 dark:hover:text-blue-400"
                    >
                      {store.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-foreground">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Giờ mở cửa</p>
                    <ul className="mt-1 space-y-0.5 text-muted-foreground">
                      {hoursDisplay.map((h) => (
                        <li
                          key={h.day}
                          className="flex justify-between gap-3 text-xs"
                        >
                          <span>{h.day}</span>
                          <span className="font-mono font-medium text-foreground">{h.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-border pt-5">
                {store.social_links?.facebook ? (
                  <a
                    href={store.social_links.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                    aria-label="Facebook"
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                ) : (
                  <a
                    href="https://facebook.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                    aria-label="Facebook"
                  >
                    <Facebook className="h-4 w-4" />
                  </a>
                )}
                {store.social_links?.zalo ? (
                  <a
                    href={store.social_links.zalo}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                    aria-label="Zalo"
                  >
                    <Send className="h-4 w-4" />
                  </a>
                ) : (
                  <a
                    href="https://zalo.me"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                    aria-label="Zalo"
                  >
                    <Send className="h-4 w-4" />
                  </a>
                )}
                {store.social_links?.website ? (
                  <a
                    href={store.social_links.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                    aria-label="Website"
                  >
                    <Globe className="h-4 w-4" />
                  </a>
                ) : null}
                {store.social_links?.tiktok ? (
                  <a
                    href={store.social_links.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                    aria-label="TikTok"
                  >
                    <Video className="h-4 w-4" />
                  </a>
                ) : null}
                <a
                  href={`mailto:${store.email}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-card text-foreground transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white dark:hover:text-white"
                  aria-label="Email"
                >
                  <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Map */}
      <section className="container pt-16 md:pt-20">
        <Reveal variant="clip-up" threshold={0.1}>
          <div className="overflow-hidden rounded-3xl border border-border bg-card text-card-foreground shadow-sm">
            <div className="aspect-[16/9] w-full md:aspect-[21/9]">
              <iframe
                src={mapsEmbedUrl}
                title={`Bản đồ - ${store.name}`}
                className="h-full w-full"
                style={{ border: 0 }}
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                allowFullScreen
              />
            </div>
            <div className="flex flex-col items-start justify-between gap-3 border-t border-border p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-foreground">{store.name}</p>
                <p className="text-xs text-muted-foreground">{store.address}</p>
              </div>
              <Link
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              >
                <MapPin className="h-3.5 w-3.5" />
                Chỉ đường
              </Link>
            </div>
          </div>
        </Reveal>
      </section>

      {/* FAQ shortcut */}
      <section className="container pt-16 md:pt-20">
        <Reveal variant="fade-up">
          <div className="rounded-3xl border border-border bg-gradient-to-br from-slate-50 to-card p-8 text-center dark:from-slate-900 dark:to-card md:p-12">
            <h2 className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">
              Bạn có câu hỏi thường gặp?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
              Xem ngay các câu hỏi phổ biến về mua hàng, bảo hành, đổi trả — có thể bạn sẽ tìm
              được câu trả lời ngay lập tức.
            </p>
            <Link
              href="/cau-hoi-thuong-gap"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            >
              Xem FAQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}