import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import { env } from "@/lib/env";
import { getBrandNameCached } from "@/lib/brand-cached";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandNameCached();
  const titleDefault = `${brandName} - Laptop Cần Thơ`;
  const description = `${brandName} — Laptop chính hãng, giá tốt tại Cần Thơ. Apple · Dell · ASUS · Lenovo — trả góp 0% 12 tháng.`;

  return {
    // Chỉ khai báo title ở root. `(client)/layout` KHÔNG được set lại
    // `title.default` — nếu set, template `%s | brand` sẽ bọc thêm lần nữa
    // → Google từng hiện "LapLap - Laptop Cần Thơ | LapLap".
    title: {
      default: titleDefault,
      template: `%s | ${brandName}`,
    },
    description,
    applicationName: brandName,
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
    openGraph: {
      type: "website",
      locale: "vi_VN",
      siteName: brandName,
      title: titleDefault,
      description,
      url: env.NEXT_PUBLIC_APP_URL,
    },
    twitter: {
      card: "summary_large_image",
      title: titleDefault,
      description,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Pre-warm brand name so the first paint có thể dùng nếu cần.
  await getBrandNameCached();
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
