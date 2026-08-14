import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  experimental: {
    optimizePackageImports: ["lucide-react", "date-fns"],
    // Bắt buộc trên Cloudflare Workers (3 MiB free plan):
    // - Externalize mọi package chứa native bindings / RPC / Node-only API
    //   để Worker bundle KHÔNG inline chúng vào server-functions/handler.mjs.
    // - Nếu thiếu, esbuild (mặc định) sẽ gộp toàn bộ @supabase/* + resend
    //   + svix + axios + node:* polyfills → handler.mjs phình 15-20 MB → vượt 3 MiB.
    // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
    serverExternalPackages: [
      "@supabase/ssr",
      "@supabase/supabase-js",
      "resend",
      "svix",
      "axios",
      "@react-email/*",
    ],
  },
};

export default nextConfig;

// Cho phép truy cập binding của Cloudflare khi chạy `next dev` (chỉ dev, no-op ở prod).
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
