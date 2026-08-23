import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
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
    // Next.js 15.5+ chạy standalone có internal proxy layer riêng với body cap
    // mặc định 10MB. Nếu upload > 10MB mà chưa bump limit này, Next sẽ
    // silently truncate body trước khi đến route handler → multipart bị cắt →
    // "Failed to parse body as FormData". Phải khớp hoặc lớn hơn Fly proxy
    // (40mb trong fly.toml) để audio upload 30MB đi qua trọn vẹn.
    proxyClientMaxBodySize: "40mb",
    // Tên cũ vẫn còn xuất hiện trong warning log của Next 15.5.21 → set luôn
    // để chắc chắn, không ảnh hưởng middleware vì route upload đã được bypass.
    middlewareClientMaxBodySize: "40mb",
  },
  // serverExternalPackages đã được promote từ experimental ra top-level từ Next.js 15.0.
  // Cloudflare build log cũ warning: "Unrecognized key(s) in object: 'serverExternalPackages'
  // at 'experimental'" → tức là @supabase/ssr externalize KHÔNG được apply → Supabase bị
  // inline vào handler.mjs (gây @supabase/ssr + transitive phình ~1-2 MB).
  // Cấu hình đúng phải đặt top-level:
  // Docs: https://nextjs.org/docs/app/api-reference/config/next-config-js/serverExternalPackages
  serverExternalPackages: [
    // Supabase chạy ở RUNTIME trong mọi API route + server components.
    // Externalize giúp Next không inline toàn bộ transitive (cross-fetch helpers v.v.).
    "@supabase/ssr",
    "@supabase/supabase-js",
    // axios: chỉ dùng phía client (src/lib/api/axios.ts có NEXT_PUBLIC_APP_URL), nhưng
    // externalize cho an toàn phòng code server lỡ import.
    "axios",
  ],
  // FIX #2 (theo https://hoangtaiki.com/blog/optimizing-nextjs-bundle-performance-cloudflare):
  // Alias 'next/og' -> false để gỡ @vercel/og + resvg.wasm + yoga.wasm khỏi bundle.
  // Project này KHÔNG dùng opengraph-image.tsx / ImageResponse / next/og (grep đã confirm)
  // nhưng Next.js vẫn tự include → phình ~2.2 MiB uncompressed trong handler.mjs.
  // Cài webpack hook chỉ chạy trong `next build`, không ảnh hưởng dev.
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "next/og": false,
    };
    return config;
  },
};

export default nextConfig;
