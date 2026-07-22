/**
 * Xác định một mục menu có đang "active" theo URL hiện tại hay không.
 *
 * Quy tắc:
 *  - "/quanly" (trang tổng quan) chỉ active khi khớp CHÍNH XÁC — nếu không sẽ
 *    active ở mọi trang con.
 *  - Các mục khác active khi pathname trùng khớp hoặc là trang con của url
 *    (so khớp theo TỪNG SEGMENT để "/quanly/products" không khớp nhầm
 *    "/quanly/product-variants").
 */
export function isNavActive(pathname: string | null, url: string): boolean {
  if (!pathname) return false;

  // Chuẩn hoá: bỏ dấu "/" thừa ở cuối.
  const clean = (s: string) => s.replace(/\/+$/, "");
  const path = clean(pathname);
  const target = clean(url);

  if (target === "/quanly") return path === "/quanly";
  if (path === target) return true;
  // Trang con: phải khớp trọn segment (thêm "/" ngăn cách).
  return path.startsWith(target + "/");
}
