/**
 * Trang /about — nội dung render từ `page_blocks` (bảng DB).
 *
 * Admin chỉnh sửa tại /quanly/about-page: thêm/xoá/sửa/kéo thả các khối.
 * Block types hiện hỗ trợ: hero, richtext.
 *
 * Khi block rỗng, fallback metadata lấy từ store-info.
 */

import type { Metadata } from "next";
import { env } from "@/lib/env";
import { getStoreInfo } from "@/lib/store-info";
import { getPageBlocks } from "@/lib/page-blocks";
import { BlockRenderer } from "@/components/client/about/block-renderer";

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

export default async function AboutPage() {
  const [store, blocks] = await Promise.all([getStoreInfo(), getPageBlocks("about")]);

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
    <div className="pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <BlockRenderer blocks={blocks} />
    </div>
  );
}
