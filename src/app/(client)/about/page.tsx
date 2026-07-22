import type { Metadata } from "next";
import Link from "next/link";
import {
  ShieldCheck,
  Truck,
  RefreshCw,
  Headphones,
  Award,
  Users,
  Store,
  Target,
  Heart,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
} from "lucide-react";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/app/api/public/store-info/route";
import { Reveal } from "@/components/client/home/reveal";
import { cn } from "@/lib/utils";

const SITE = env.NEXT_PUBLIC_APP_URL;

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  const title = `Giới thiệu ${store.name} - Laptop chính hãng tại Cần Thơ`;
  return {
    title: "Giới thiệu - Cửa hàng laptop chính hãng tại Cần Thơ",
    description: store.description,
    keywords: [
      store.name,
      "laptop Cần Thơ",
      "mua laptop Cần Thơ",
      "laptop chính hãng",
      "laptop trả góp Cần Thơ",
      "sửa laptop Cần Thơ",
    ],
    alternates: { canonical: `${SITE}/about` },
    openGraph: {
      type: "website",
      title,
      description: store.description,
      url: `${SITE}/about`,
      siteName: store.name,
      locale: "vi_VN",
    },
    twitter: { card: "summary_large_image", title, description: store.description },
  };
}

const VALUES = [
  {
    Icon: ShieldCheck,
    title: "Chính hãng 100%",
    desc: "Nguồn gốc rõ ràng, hóa đơn VAT, hoàn tiền nếu phát hiện hàng giả.",
    accent: "text-emerald-600 bg-emerald-50 border-emerald-100",
  },
  {
    Icon: Award,
    title: "Giá tốt nhất",
    desc: "Giá cạnh tranh nhất khu vực Cần Thơ cùng nhiều ưu đãi tặng kèm.",
    accent: "text-amber-600 bg-amber-50 border-amber-100",
  },
  {
    Icon: RefreshCw,
    title: "Đổi trả linh hoạt",
    desc: "Đổi trả trong 30 ngày, thu cũ đổi mới định giá minh bạch.",
    accent: "text-blue-600 bg-blue-50 border-blue-100",
  },
  {
    Icon: Headphones,
    title: "Hỗ trợ tận tâm",
    desc: "Tư vấn am hiểu kỹ thuật, đồng hành cùng bạn suốt quá trình.",
    accent: "text-violet-600 bg-violet-50 border-violet-100",
  },
];

const STATS = [
  { value: "10.000+", label: "Khách hàng tin tưởng" },
  { value: "500+", label: "Mẫu laptop chính hãng" },
  { value: "5+", label: "Năm kinh nghiệm" },
  { value: "98%", label: "Khách hàng hài lòng" },
];

const SERVICES = [
  { Icon: Store, title: "Bán lẻ laptop chính hãng", desc: "Văn phòng, gaming, ultrabook, MacBook từ thương hiệu lớn." },
  { Icon: Truck, title: "Giao hàng tận nơi", desc: "Nội thành Cần Thơ trong 2 giờ, hỗ trợ ship toàn quốc." },
  { Icon: ShieldCheck, title: "Bảo hành & sửa chữa", desc: "Trung tâm bảo hành riêng, linh kiện thật, trả máy trong ngày." },
  { Icon: RefreshCw, title: "Thu cũ đổi mới", desc: "Định giá máy cũ cao, hỗ trợ lên đời laptop dễ dàng." },
];

const MILESTONES = [
  { year: "2019", text: "Thành lập cửa hàng đầu tiên tại Ninh Kiều, Cần Thơ." },
  { year: "2021", text: "Mở rộng danh mục sang laptop gaming và MacBook." },
  { year: "2023", text: "Ra mắt trả góp 0% và trung tâm bảo hành riêng." },
  { year: "2025", text: "Phát triển nền tảng mua sắm trực tuyến cho toàn miền Tây." },
];

export default async function AboutPage() {
  const store = await getStoreInfo();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Store",
    name: store.name,
    description: store.description,
    url: `${SITE}/about`,
    telephone: store.phone,
    email: store.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: store.address,
      addressLocality: "Ninh Kiều",
      addressRegion: "Cần Thơ",
      addressCountry: "VN",
    },
    priceRange: "15.000.000đ - 40.000.000đ",
    areaServed: "Cần Thơ",
  };

  return (
    <div className="bg-white pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Hero Section */}
      <section className="container pt-6 md:pt-10">
        <Reveal variant="clip-up">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-16 text-center md:px-16 md:py-28">
            {/* Grid background overlay */}
            <div
              className="absolute inset-0 opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage:
                  "linear-gradient(to right,#fff 1px,transparent 1px),linear-gradient(to bottom,#fff 1px,transparent 1px)",
                backgroundSize: "48px 48px",
              }}
            />
            {/* Decorative blurs */}
            <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-blue-500/20 blur-[100px]" />
            <div className="pointer-events-none absolute -bottom-20 -right-20 h-72 w-72 rounded-full bg-slate-500/30 blur-[100px]" />

            <div className="relative z-10 mx-auto max-w-3xl">
              <Reveal variant="fade-up" delay={200}>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-slate-300 backdrop-blur-md">
                  <Heart className="h-3.5 w-3.5 text-rose-400" /> Về chúng tôi
                </span>
              </Reveal>
              <Reveal variant="slide-split" delay={300}>
                <h1 className="mt-6 text-4xl font-extrabold leading-[1.1] tracking-tight text-white md:text-6xl lg:text-7xl">
                  {store.name}
                  <br />
                  <span className="text-slate-400">Laptop Cần Thơ.</span>
                </h1>
              </Reveal>
              <Reveal variant="fade-up" delay={400}>
                <p className="mx-auto mt-6 max-w-2xl text-base font-medium leading-relaxed text-slate-300 md:text-lg">
                  {store.description}
                </p>
              </Reveal>
            </div>
          </div>
        </Reveal>
      </section>

      {/* Stats Bento Grid */}
      <section className="container pt-12 md:pt-16">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {STATS.map((s, i) => (
            <Reveal key={s.label} variant="scale-up" delay={i * 80} threshold={0.1}>
              <div className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center transition-all duration-300 hover:border-slate-300 hover:bg-white hover:shadow-sm">
                <div className="text-3xl font-extrabold tracking-tight text-slate-900 md:text-4xl">
                  {s.value}
                </div>
                <div className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wide md:text-sm">
                  {s.label}
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Câu chuyện */}
      <section className="container pt-20 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <Reveal variant="fade-up">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
              Câu chuyện của <span className="text-blue-600">{store.name}</span>
            </h2>
          </Reveal>
          <Reveal variant="fade-up" delay={100}>
            <div className="mt-6 space-y-5 text-base leading-relaxed text-slate-600 md:text-lg">
              <p>
                Ra đời năm 2019 tại trung tâm thành phố Cần Thơ, chúng tôi khởi đầu từ một cửa hàng nhỏ với mong muốn mang đến cho người dùng miền Tây những chiếc laptop chính hãng với mức giá hợp lý nhất.
              </p>
              <p>
                Sau nhiều năm phát triển, LapLap tự hào trở thành một trong những hệ thống bán lẻ laptop uy tín hàng đầu khu vực. Mỗi sản phẩm đến tay khách hàng đều được kiểm tra kỹ lưỡng, bảo hành minh bạch và hỗ trợ tận tâm.
              </p>
              <p className="font-medium text-slate-900">
                Với LapLap, việc mua laptop không chỉ là một giao dịch — đó là sự đồng hành lâu dài.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Chặng đường phát triển - Timeline */}
      <section className="container pt-20 md:pt-28">
        <div className="mx-auto max-w-4xl">
          <Reveal variant="fade-right">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Hành trình</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Chặng đường phát triển</h2>
          </Reveal>
          <div className="mt-10 border-l-2 border-slate-100 pl-6 md:pl-10 space-y-10">
            {MILESTONES.map((m, i) => (
              <Reveal key={m.year} variant="fade-up" delay={i * 150} threshold={0.1}>
                <div className="relative">
                  {/* Timeline dot */}
                  <div className="absolute -left-[35px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-blue-600 bg-white md:-left-[51px] shadow-[0_0_0_4px_rgba(37,99,235,0.1)]" />
                  <h3 className="text-2xl font-extrabold text-slate-900">{m.year}</h3>
                  <p className="mt-2 text-base text-slate-600 md:text-lg">{m.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Giá trị cốt lõi */}
      <section className="container pt-20 md:pt-28">
        <Reveal variant="slide-split">
          <div className="mb-10 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">Giá trị cốt lõi</h2>
            <p className="mt-3 text-slate-500">Những gì chúng tôi cam kết với mỗi khách hàng</p>
          </div>
        </Reveal>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {VALUES.map(({ Icon, title, desc, accent }, i) => (
            <Reveal key={title} variant={i % 2 === 0 ? "fade-up" : "flip-x"} delay={i * 100} threshold={0.05}>
              <div className="group flex h-full flex-col rounded-3xl border border-slate-200 bg-white p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:border-slate-300">
                <div className={cn("mb-5 flex h-14 w-14 items-center justify-center rounded-2xl border transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3", accent)}>
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-600">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Sứ mệnh & Tầm nhìn */}
      <section className="container pt-20 md:pt-28">
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal variant="fade-left">
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-8 transition-all hover:bg-white hover:shadow-md md:p-12">
              <Target className="mb-6 h-10 w-10 text-blue-600" />
              <h3 className="text-2xl font-bold text-slate-900">Sứ mệnh</h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
                Giúp mọi người dân Cần Thơ và miền Tây dễ dàng sở hữu chiếc laptop chính hãng phù hợp nhất với nhu cầu và ngân sách của mình.
              </p>
            </div>
          </Reveal>
          <Reveal variant="fade-right">
            <div className="flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-8 transition-all hover:bg-white hover:shadow-md md:p-12">
              <Users className="mb-6 h-10 w-10 text-emerald-600" />
              <h3 className="text-2xl font-bold text-slate-900">Tầm nhìn</h3>
              <p className="mt-4 text-base leading-relaxed text-slate-600 md:text-lg">
                Trở thành thương hiệu bán lẻ và dịch vụ laptop được tin tưởng nhất khu vực Đồng bằng sông Cửu Long, mang lại dịch vụ vượt kỳ vọng.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Liên hệ / CTA */}
      <section className="container pt-20 md:pt-28">
        <Reveal variant="clip-up" threshold={0.1}>
          <div className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-12 shadow-sm md:px-12 md:py-20 text-center">
            {/* Grid pattern background */}
            <div
              className="absolute inset-0 opacity-[0.02] pointer-events-none"
              style={{
                backgroundImage:
                  "radial-gradient(#000 1px,transparent 1px)",
                backgroundSize: "24px 24px",
              }}
            />
            
            <div className="relative z-10 mx-auto max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
                Bắt đầu hành trình cùng {store.name}
              </h2>
              <p className="mt-4 text-base text-slate-500 md:text-lg">
                Ghé thăm showroom của chúng tôi tại <strong className="text-slate-800">{store.address}</strong> để trải nghiệm trực tiếp các dòng sản phẩm mới nhất.
              </p>
              
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Link
                  href="/products"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-slate-900 px-8 text-sm font-bold text-white shadow-sm transition-all hover:bg-slate-800 sm:w-auto"
                >
                  Xem sản phẩm <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/contact"
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-8 text-sm font-bold text-slate-900 transition-all hover:bg-slate-50 sm:w-auto"
                >
                  <MapPin className="h-4 w-4" /> Bản đồ đường đi
                </Link>
              </div>

              <div className="mt-8 flex flex-wrap items-center justify-center gap-6 border-t border-slate-100 pt-8 text-sm font-medium text-slate-600">
                <a href={`tel:${store.phone.replace(/\s/g, "")}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                  <Phone className="h-4 w-4" /> {store.phone}
                </a>
                <a href={`mailto:${store.email}`} className="flex items-center gap-2 hover:text-blue-600 transition-colors">
                  <Mail className="h-4 w-4" /> {store.email}
                </a>
              </div>
            </div>
          </div>
        </Reveal>
      </section>
    </div>
  );
}
