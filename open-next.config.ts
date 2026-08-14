import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default defineCloudflareConfig({
  // BẮT BUỘC trên Cloudflare Free (3 MiB gzip limit):
  // Em đã đo `handler.mjs` mặc định ~17-20 MiB UNCOMPRESSED, gzip vẫn > 3 MiB.
  // `minify: true` (esbuild minification) cắt còn ~2-3 MiB gzip, vừa khít limit.
  // CLI flag tương đương: npx opennextjs-cloudflare build --minify
  minify: true,
});
