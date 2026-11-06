/**
 * Brand — Server-only cached functions.
 * File này chỉ được import trong Server Components / API routes (vì
 * `unstable_cache` là API server-only của Next.js).
 *
 * Vì sao cần bản cached: các layout (`src/app/layout.tsx`,
 * `src/app/(client)/layout.tsx`) gọi `getBrandNameAsync()` để dựng metadata
 * (title/description). Route group `(client)` đã bật `force-dynamic` (để
 * footer lấy được giờ mở cửa mới nhất từ bảng `settings`) → metadata chạy ở
 * MỌI request. Nếu đọc DB trực tiếp thì mỗi lượt view đều tốn 1 query
 * Supabase. Bản cached dùng chung tag "store-info" với `getStoreInfoCached`
 * nên admin lưu settings → `revalidateTag("store-info")` xoá luôn → vẫn cập
 * nhật tức thì.
 */
import { unstable_cache } from "next/cache";
import { getBrandNameAsync, getBrandEmailAsync } from "./brand";

/**
 * Tên thương hiệu có cache xuyên request (tag "store-info").
 * `revalidate: 3600` là TTL dự phòng; TTL thật do `revalidateTag` điều khiển.
 */
export const getBrandNameCached = unstable_cache(
  async (): Promise<string> => {
    return getBrandNameAsync();
  },
  ["brand-name-v1"],
  {
    revalidate: 3600,
    tags: ["store-info"],
  },
);

/** Email liên hệ mặc định có cache xuyên request (tag "store-info"). */
export const getBrandEmailCached = unstable_cache(
  async (): Promise<string> => {
    return getBrandEmailAsync();
  },
  ["brand-email-v1"],
  {
    revalidate: 3600,
    tags: ["store-info"],
  },
);
