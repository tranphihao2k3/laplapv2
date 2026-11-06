import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Providers } from "@/providers";
import { env } from "@/lib/env";
import { getBrandNameCached } from "@/lib/brand-cached";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "vietnamese"], variable: "--font-sans" });

export async function generateMetadata(): Promise<Metadata> {
  const brandName = await getBrandNameCached();
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
