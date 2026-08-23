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
  Headphones,
  Building2,
  ArrowRight,
} from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { telHref } from "@/lib/shop-info";
import { Reveal } from "@/components/client/home/reveal";
import { ContactForm } from "@/components/shared/contact-form";
import { cn } from "@/lib/utils";

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

const CHANNELS = [
  {
    Icon: Phone,
    title: "Hotline bán hàng",
    value: "1900 1234",
    desc: "Tư vấn sản phẩm, báo giá, đặt hàng.",
    accent: "bg-emerald-50 text-emerald-700 border-emerald-100",
  },
  {
    Icon: Headphones,
    title: "Hỗ trợ kỹ thuật",
    value: "1900 1235",
    desc: "Hỗ trợ sau bán hàng, bảo hành, sửa chữa.",
    accent: "bg-blue-50 text-blue-700 border-blue-100",
  },
  {
    Icon: MessageCircle,
    title: "Zalo / WhatsApp",
    value: "0901 234 567",
    desc: "Chat nhanh qua Zalo OA, phản hồi trong 5 phút.",
    accent: "bg-violet-50 text-violet-700 border-violet-100",
  },
  {
    Icon: Mail,
    title: "Email",
    value: "info@laplap.vn",
    desc: "Gửi yêu cầu chi tiết, đính kèm tài liệu.",
    accent: "bg-amber-50 text-amber-700 border-amber-100",
  },
];

const HOURS = [
  { day: "Thứ 2 - Thứ 6", time: "8:00 - 21:00" },
  { day: "Thứ 7", time: "8:00 - 22:00" },
  { day: "Chủ nhật", time: "9:00 - 20:00" },
];

export default async function ContactPage() {
  const store = await getStoreInfo();
  const tel = telHref(store.phone);

  // Encode địa chỉ cho Google Maps embed
  const mapsQuery = encodeURIComponent(store.address);
  const mapsEmbedUrl = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  return (
    <div className="bg-white pb-20">
      {/* Hero */}
      <section className="container pt-6 md:pt-10">
        <Reveal variant="clip-up">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-16 text-center md:px-16 md:py-24">
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map(({ Icon, title, value, desc, accent }, i) => (
            <Reveal key={title} variant="fade-up" delay={i * 80} threshold={0.1}>
              <div className="group flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:border-slate-300 hover:shadow-md">
                <div
                  className={cn(
                    "mb-4 flex h-12 w-12 items-center justify-center rounded-xl border transition-transform duration-300 group-hover:scale-110",
                    accent,
                  )}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                  {title}
                </h3>
                <p className="mt-1.5 text-lg font-bold text-slate-900">{value}</p>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Form + Info */}
      <section className="container pt-16 md:pt-20">
        <div className="grid gap-8 lg:grid-cols-5 lg:gap-12">
          {/* Form */}
          <Reveal variant="fade-right" className="lg:col-span-3">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:p-10">
              <div className="mb-6">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
                  Gửi tin nhắn cho {store.name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">
                  Điền thông tin bên dưới — chúng tôi sẽ phản hồi qua email hoặc SĐT bạn cung cấp.
                </p>
              </div>
              <ContactForm />
            </div>
          </Reveal>

          {/* Info card */}
          <Reveal variant="fade-left" className="lg:col-span-2">
            <div className="flex h-full flex-col rounded-3xl border border-slate-200 bg-slate-50/60 p-6 md:p-8">
              <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
                Thông tin cửa hàng
              </h2>

              <div className="mt-6 space-y-4 text-sm">
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">{store.legal.business_name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      MST: {store.legal.tax_id} · ĐKKD:{" "}
                      {store.legal.business_registration_number}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Địa chỉ showroom</p>
                    <p className="mt-0.5 text-slate-600">{store.address}</p>
                    <a
                      href={mapsLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                    >
                      Mở Google Maps <ArrowRight className="h-3 w-3" />
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700">
                    <Phone className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Hotline</p>
                    {tel ? (
                      <a
                        href={tel}
                        className="mt-0.5 block text-slate-600 hover:text-blue-600"
                      >
                        {store.phone}
                      </a>
                    ) : (
                      <p className="mt-0.5 text-slate-600">{store.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700">
                    <Mail className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Email</p>
                    <a
                      href={`mailto:${store.email}`}
                      className="mt-0.5 block break-all text-slate-600 hover:text-blue-600"
                    >
                      {store.email}
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-slate-200 text-slate-700">
                    <Clock className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900">Giờ mở cửa</p>
                    <ul className="mt-1 space-y-0.5 text-slate-600">
                      {HOURS.map((h) => (
                        <li
                          key={h.day}
                          className="flex justify-between gap-3 text-xs"
                        >
                          <span>{h.day}</span>
                          <span className="font-mono font-medium">{h.time}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6 flex items-center gap-3 border-t border-slate-200 pt-5">
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="https://zalo.me"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white"
                  aria-label="Zalo"
                >
                  <Send className="h-4 w-4" />
                </a>
                <a
                  href={`mailto:${store.email}`}
                  className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 transition-colors hover:border-blue-500 hover:bg-blue-500 hover:text-white"
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
          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
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
            <div className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 p-5 sm:flex-row sm:items-center">
              <div>
                <p className="text-sm font-semibold text-slate-900">{store.name}</p>
                <p className="text-xs text-slate-500">{store.address}</p>
              </div>
              <Link
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white hover:bg-slate-700"
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
          <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-8 text-center md:p-12">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
              Bạn có câu hỏi thường gặp?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-slate-500 md:text-base">
              Xem ngay các câu hỏi phổ biến về mua hàng, bảo hành, đổi trả — có thể bạn sẽ tìm
              được câu trả lời ngay lập tức.
            </p>
            <Link
              href="/cau-hoi-thuong-gap"
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-full bg-slate-900 px-6 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Xem FAQ <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </section>
    </div>
  );
}