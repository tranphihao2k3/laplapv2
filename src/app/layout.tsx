import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import { env } from "@/lib/env";
import { getBrandNameAsync } from "@/lib/brand";
import { getShopIdFromRequest } from "@/lib/request-shop";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const shopId = await getShopIdFromRequest();
  const brandName = await getBrandNameAsync(shopId);
  return {
    title: {
      default: `${brandName} - Laptop Cần Thơ`,
      template: `%s | ${brandName}`,
    },
    description: `${brandName} - Cửa hàng laptop uy tín tại Cần Thơ`,
    metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),
  };
}

export const viewport: Viewport = {
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
  const shopId = await getShopIdFromRequest();
  await getBrandNameAsync(shopId);
  return (
    <html lang="vi" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
