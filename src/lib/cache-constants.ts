/** Shared constants cho localStorage cache. Tách riêng để tránh circular import. */
export const CACHE_KEY = "store-settings-cache";
// Giảm từ 24h → 10 phút. Lý do: admin thường đổi brand/tên cửa hàng + muốn thấy
// thay đổi ngay trong tab khác. Nếu user đang ở site mà localStorage hết hạn,
// lần render tiếp theo sẽ fetch lại từ /api/public/store-info (revalidate=3600s)
// → thực tế cache hiệu dụng tối đa ~10 phút từ phía client. Khi admin lưu
// settings, `invalidateBrandCache()` được gọi để refresh ngay cả trong 10p này.
export const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes
