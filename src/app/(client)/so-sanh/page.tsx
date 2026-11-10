import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { Clock, Mail, MapPin, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { getStoreInfoForRequest } from "@/lib/request-shop";
import { telHref } from "@/lib/shop-info";
import { CompareClient } from "./_components/compare-client";

export const metadata: Metadata = {
  title: "So sánh laptop",
  description:
    "So sánh thông số cơ bản giữa các mẫu laptop để bạn tự đối chiếu và lựa chọn.",
};

export default async function ComparePage() {
  const store = await getStoreInfoForRequest();

  const mapsQuery = encodeURIComponent(store.address);
  const mapsEmbedUrl = `https://www.google.com/maps?q=${mapsQuery}&output=embed`;
  const mapsLink = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}`;

  const opening = store.opening_hours;
  const hoursParts: string[] = [];
  if (opening?.weekday) hoursParts.push(`T2-T6: ${opening.weekday}`);
  if (opening?.saturday) hoursParts.push(`T7: ${opening.saturday}`);
  else if (opening?.weekend) hoursParts.push(`Cuối tuần: ${opening.weekend}`);
  if (opening?.sunday) hoursParts.push(`CN: ${opening.sunday}`);
  if (opening?.holidays) hoursParts.push(`Lễ: ${opening.holidays}`);
  const hoursLine = hoursParts.length ? hoursParts.join(" · ") : "8:00 - 21:00";

  const phone = store.hotline ?? store.phone;
  const phoneHref = telHref(phone) ?? undefined;

  return (
    <div className="container max-w-7xl space-y-8 py-6 sm:space-y-10 sm:py-8">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
          So sánh laptop
        </h1>
        <p className="max-w-2xl text-sm text-slate-500 sm:text-base">
          Đặt các mẫu laptop cạnh nhau để tự đối chiếu thông số và chọn máy phù hợp với bạn.
        </p>
      </div>

      <Suspense fallback={<Skeleton className="h-[420px] w-full rounded-2xl" />}>
        <CompareClient />
      </Suspense>

      <section
        aria-labelledby="compare-store-info"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="border-b border-slate-100 px-4 py-4 sm:px-6">
          <h2 id="compare-store-info" className="text-lg font-semibold text-slate-900">
            Thông tin cửa hàng
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Thông tin liên hệ và địa chỉ được đồng bộ với footer của website.
          </p>
        </div>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,380px)_1fr]">
          <div className="space-y-4 p-4 sm:p-6">
            <div>
              <p className="text-base font-semibold text-slate-900">{store.name}</p>
              {store.description ? (
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{store.description}</p>
              ) : null}
            </div>

            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Phone className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Hotline hỗ trợ
                  </span>
                  {phoneHref ? (
                    <a href={phoneHref} className="mt-0.5 block font-medium text-slate-800 hover:text-blue-700">
                      {phone}
                    </a>
                  ) : (
                    <span className="mt-0.5 block font-medium text-slate-800">{phone}</span>
                  )}
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Địa chỉ
                  </span>
                  <span className="mt-0.5 block text-slate-800">{store.address}</span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <MapPin className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Trung tâm bảo hành
                  </span>
                  <span className="mt-0.5 block text-slate-800">
                    Mang sản phẩm đến cửa hàng gần nhất.{" "}
                    <Link href="/tra-cuu-bao-hanh" className="font-medium text-blue-700 hover:underline">
                      Xem trang bảo hành
                    </Link>
                  </span>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Mail className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Email
                  </span>
                  <a
                    href={`mailto:${store.email}`}
                    className="mt-0.5 block break-all text-slate-800 hover:text-blue-700"
                  >
                    {store.email}
                  </a>
                </span>
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
                  <Clock className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Giờ mở cửa
                  </span>
                  <span className="mt-0.5 block text-slate-800">{hoursLine}</span>
                </span>
              </li>
            </ul>

            <div className="pt-1">
              <Link
                href={mapsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
              >
                <MapPin className="h-4 w-4" />
                Mở chỉ đường
              </Link>
            </div>
          </div>

          <div className="min-h-[280px] border-t border-slate-100 lg:min-h-[420px] lg:border-l lg:border-t-0">
            <iframe
              src={mapsEmbedUrl}
              title={`Bản đồ - ${store.name}`}
              className="h-full min-h-[280px] w-full lg:min-h-[420px]"
              style={{ border: 0 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              allowFullScreen
            />
          </div>
        </div>
      </section>
    </div>
  );
}
