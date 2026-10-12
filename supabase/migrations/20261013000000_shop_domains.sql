-- supabase/migrations/20261013000000_shop_domains.sql
--
-- Thêm 2 cột để hỗ trợ multi-domain / multi-shop routing:
--   - primary_domain: domain chính của shop (vd "laptopthanhvo.com"). Duy nhất trong
--     toàn bảng, dùng làm key resolve nhanh từ Host header trong middleware.
--   - allowed_domains: mảng các domain phụ cũng trỏ về shop này (vd "www.", domain
--     cũ sau khi rebrand, landing page phụ...). Không unique cho phép nhiều shop
--     cùng share "www." alias.
--
-- Resolution rule trong middleware:
--   1. Lấy host, bỏ port + tiền tố "www."
--   2. Tìm shop có primary_domain = clean host HOẶC allowed_domains contains clean host
--   3. Nếu không match → fallback shop mặc định (org setting) hoặc 404
--
-- Áp dụng cho organization multi-shop (1 org có nhiều chi nhánh, mỗi shop 1 domain
-- riêng) hoặc single-org chạy nhiều domain rebrand.

alter table public.shops
  add column if not exists primary_domain text,
  add column if not exists allowed_domains text[] not null default '{}';

-- Mỗi primary_domain là duy nhất trong hệ thống (case-insensitive để tránh
-- đăng ký trùng "LaptopThanhVo.com" vs "laptopthanhvo.com").
create unique index if not exists shops_primary_domain_unique
  on public.shops (lower(primary_domain))
  where primary_domain is not null;

-- Index phụ cho truy vấn "any shop nào claim domain này" trong middleware —
-- GIN trên text[] hỗ trợ toán tử `cs` (contains) và `&&` (overlap).
create index if not exists shops_allowed_domains_gin
  on public.shops using gin (allowed_domains);

comment on column public.shops.primary_domain is
  'Domain chính của shop, vd "laptopthanhvo.com". Middleware resolve shop từ Host header.';

comment on column public.shops.allowed_domains is
  'Các domain phụ trỏ về shop này (www, alias, domain cũ sau redirect). Mỗi phần tử là một domain thuần không có scheme/port.';
