-- ============================================================================
-- Module: Catalog — Ảnh chi tiết sản phẩm (gallery nhiều ảnh)
-- Thêm cột products.images (jsonb) lưu mảng URL ảnh chi tiết.
-- thumbnail_url vẫn là ảnh đại diện; images là toàn bộ ảnh hiển thị ở gallery.
-- ============================================================================

alter table public.products
  add column if not exists images jsonb;

comment on column public.products.images is
  'Mảng URL ảnh chi tiết hiển thị ở gallery trang sản phẩm, ví dụ: ["https://.../1.jpg", "https://.../2.jpg"]. Ảnh đại diện vẫn là thumbnail_url.';
