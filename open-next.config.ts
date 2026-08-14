import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cloudflare Workers Free plan có giới hạn 3 MiB gzip cho Worker bundle.
// opennextjs-cloudflare CLI mặc định đã bật `--minify` (xem build.ts dòng
// `minify: !args.noMinify`). KHÔNG có option `minify` trong
// `defineCloudflareConfig` — option này chỉ tồn tại ở CLI flag `--noMinify`.
// Vì vậy giữ config rỗng là đúng; thêm option ở đây sẽ bị TS ignore.
export default defineCloudflareConfig();
