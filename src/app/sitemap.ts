import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";

// Sitemap sinh động: các trang tĩnh công khai + toàn bộ sản phẩm active.
// Next.js phục vụ file này tại /sitemap.xml.
export const revalidate = 3600; // làm mới mỗi giờ

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");

  // Trang tĩnh công khai.
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/products`, changeFrequency: "daily", priority: 0.9 },
    { url: `${baseUrl}/dich-vu-sua-chua`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${baseUrl}/tra-cuu-bao-hanh`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${baseUrl}/about`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${baseUrl}/contact`, changeFrequency: "yearly", priority: 0.4 },
    // Các trang chính sách pháp lý — Nghị định 52/2013 + 85/2021.
    { url: `${baseUrl}/chinh-sach-bao-hanh`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach-doi-tra`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach-giao-hang`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach-thanh-toan`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/chinh-sach-bao-mat`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/dieu-khoan-su-dung`, changeFrequency: "yearly", priority: 0.2 },
    {
      url: `${baseUrl}/chinh-sach-giai-quyet-khieu-nai`,
      changeFrequency: "yearly",
      priority: 0.2,
    },
    { url: `${baseUrl}/cau-hoi-thuong-gap`, changeFrequency: "monthly", priority: 0.5 },
  ];

  // Sản phẩm active — có thể thất bại lúc build (env fallback), nên bọc try/catch.
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const supabase = (await createClient()) as any;
    const { data } = await supabase
      .from("products")
      .select("slug, updated_at")
      .eq("status", "active")
      .not("slug", "is", null);

    if (Array.isArray(data)) {
      productRoutes = data
        .filter((p: { slug: string | null }) => p.slug)
        .map((p: { slug: string; updated_at: string | null }) => ({
          url: `${baseUrl}/products/${p.slug}`,
          lastModified: p.updated_at ? new Date(p.updated_at) : undefined,
          changeFrequency: "weekly" as const,
          priority: 0.8,
        }));
    }
  } catch {
    // Bỏ qua — vẫn trả về sitemap trang tĩnh nếu Supabase không sẵn sàng.
  }

  return [...staticRoutes, ...productRoutes];
}
