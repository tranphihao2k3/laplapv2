import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  images: {
    // Cloudflare Workers (OpenNext) không có sharp → bộ tối ưu ảnh /_next/image
    // của Next fail với ảnh lớn/quality cao (ảnh chính vỡ, thumbnail nhỏ thì OK).
    // Serve thẳng ảnh từ CDN Supabase (vốn đã tối ưu qua CDN) cho chắc chắn hiển thị.
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
  },
};

export default nextConfig;

// Cho phép truy cập binding của Cloudflare khi chạy `next dev` (chỉ dev, no-op ở prod).
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
