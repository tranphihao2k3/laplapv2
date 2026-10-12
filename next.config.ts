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
  // Graceful redirect cho URL Mini Tool cũ (.exe/.bat/.ps1) trỏ tới file ZIP.
  // File ZIP gộp .bat + .ps1 + README, user giai nen 1 lan, click .bat de chay.
  // File .exe thật sẽ build sau (qua scripts/build-mini-tool.ps1 + PS2EXE trên Windows).
  async rewrites() {
    return [
      {
        source: "/scripts/laplap-mini-tool.exe",
        destination: "/scripts/laplap-mini-tool.zip",
      },
      {
        source: "/scripts/laplap-mini-tool.bat",
        destination: "/scripts/laplap-mini-tool.zip",
      },
      {
        source: "/scripts/laplap-mini-tool.ps1",
        destination: "/scripts/laplap-mini-tool.zip",
      },
    ];
  },
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
