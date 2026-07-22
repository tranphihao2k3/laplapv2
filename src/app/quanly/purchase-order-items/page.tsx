import { CrudEntityPage } from "@/components/admin/crud-entity-page";

export default function PurchaseOrderItemsAdminPage() {
  return (
    <CrudEntityPage
      title="Chi tiết phiếu mua"
      subtitle="CRUD purchase-order-items"
      entity="purchase-order-items"
      fields={[
        { key: "purchase_order_id", label: "PO ID" },
        { key: "product_variant_id", label: "Variant ID" },
        { key: "quantity", label: "Số lượng" },
        { key: "unit_cost", label: "Đơn giá vốn" },
      ]}
    />
  );
}
