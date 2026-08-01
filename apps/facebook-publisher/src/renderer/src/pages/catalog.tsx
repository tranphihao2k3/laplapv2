/**
 * Catalog — CAT-001..CAT-002.
 * Placeholder cho đến khi CAT-001 wired. Hiện chỉ hiển thị stub + gợi ý
 * dùng cache.
 */
export function CatalogPage() {
  return (
    <section>
      <h1 className="text-lg font-semibold">Sản phẩm</h1>
      <p className="mt-2 text-sm text-muted-500">
        Đồng bộ danh sách sản phẩm từ LapLap API. Tính năng chi tiết sẽ thêm ở
        CAT-001.
      </p>
      <div className="mt-4 rounded border border-muted-100 bg-white p-4 text-sm">
        <p className="font-medium">Trạng thái:</p>
        <ul className="mt-2 list-disc pl-5 text-muted-500">
          <li>Chưa đồng bộ</li>
        </ul>
      </div>
    </section>
  );
}