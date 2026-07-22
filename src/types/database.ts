/**
 * Type definitions cho schema LapLap (28 bảng).
 *
 * Được viết tay theo DDL Supabase. Khi schema thay đổi, ưu tiên:
 *   npx supabase gen types typescript --project-id bmvgnhgxbkrhixydsqjh --schema public > src/types/database.ts
 * (lệnh trên sẽ ghi đè file này)
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

// ---------- Domain enums (text columns dùng làm union) ----------
export type ProductStatus = "draft" | "active" | "archived";
export type OrderStatus =
  | "draft"
  | "pending"
  | "confirmed"
  | "fulfilled"
  | "completed"
  | "cancelled";
export type PaymentStatus = "unpaid" | "partial" | "paid" | "refunded";
export type FulfillmentStatus = "unfulfilled" | "processing" | "shipped" | "delivered" | "returned";
export type SaleChannel = "pos" | "online" | "marketplace" | "wholesale";
export type PaymentMethod = "cash" | "card" | "transfer" | "ewallet" | "cod" | "credit";
export type InventoryTxType =
  | "purchase"
  | "sale"
  | "return"
  | "transfer_in"
  | "transfer_out"
  | "adjustment"
  | "damage";
export type SerialStatus = "in_stock" | "reserved" | "sold" | "returned" | "damaged" | "in_repair";
export type CustomerTier = "bronze" | "silver" | "gold" | "platinum";
export type LoyaltyTxType = "earn" | "redeem" | "expire" | "adjust";
export type WarehouseType = "store" | "central" | "online" | "transit";
export type PurchaseOrderStatus =
  | "draft"
  | "sent"
  | "partial"
  | "received"
  | "cancelled";
export type RepairStatus =
  | "received"
  | "diagnosing"
  | "quoted"
  | "approved"
  | "repairing"
  | "done"
  | "delivered"
  | "cancelled";
export type TradeInStatus = "pending" | "evaluating" | "approved" | "rejected" | "completed";
export type WarrantyStatus = "active" | "expired" | "voided" | "claimed";

// ---------- Row shapes ----------
type Timestamp = string;
type UUID = string;

export type OrganizationRow = {
  id: UUID;
  name: string;
  code: string | null;
  tax_code: string | null;
  tax_id: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  logo_url: string | null;
  website: string | null;
  is_active: boolean | null;
  parent_id: UUID | null;
  settings: Json | null;
  created_at: Timestamp | null;
};

export type ShopRow = {
  id: UUID;
  organization_id: UUID;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  timezone: string | null;
  is_active: boolean | null;
  created_at: Timestamp | null;
};

export type WarehouseRow = {
  id: UUID;
  organization_id: UUID | null;
  shop_id: UUID | null;
  name: string;
  code: string | null;
  type: WarehouseType | null;
  address: string | null;
  is_active: boolean | null;
  manager_name: string | null;
  phone: string | null;
  created_at: Timestamp | null;
};

export type UserProfileRow = {
  id: UUID;
  organization_id: UUID | null;
  full_name: string | null;
  avatar_url: string | null;
  phone: string | null;
  created_at: Timestamp | null;
};

export type RoleRow = {
  id: UUID;
  organization_id: UUID | null;
  name: string;
  code: string;
  created_at: Timestamp | null;
};

export type PermissionRow = {
  id: UUID;
  code: string;
  description: string | null;
};

export type RolePermissionRow = {
  role_id: UUID;
  permission_id: UUID;
};

export type ShopStaffRow = {
  id: UUID;
  shop_id: UUID | null;
  user_id: UUID | null;
  role_id: UUID | null;
  is_active: boolean | null;
  created_at: Timestamp | null;
};

export type BrandRow = {
  id: UUID;
  organization_id: UUID | null;
  name: string;
  slug: string | null;
  logo_url: string | null;
  show_on_homepage: boolean;
  created_at: Timestamp | null;
};

export type CategoryRow = {
  id: UUID;
  organization_id: UUID | null;
  parent_id: UUID | null;
  name: string;
  slug: string | null;
  position: number | null;
  created_at: Timestamp | null;
};

export type SpecTemplateRow = {
  id: UUID;
  organization_id: UUID | null;
  category_id: UUID | null;
  name: string;
  fields: Json;
  created_at: Timestamp | null;
};

export type ProductRow = {
  id: UUID;
  organization_id: UUID | null;
  category_id: UUID | null;
  brand_id: UUID | null;
  name: string;
  slug: string | null;
  short_description: string | null;
  description: string | null;
  thumbnail_url: string | null;
  status: ProductStatus | null;
  tags: string[] | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
};

export type ProductVariantRow = {
  id: UUID;
  product_id: UUID | null;
  sku: string;
  barcode: string | null;
  name: string | null;
  attributes: Json | null;
  specs: Json | null;
  cost_price: number | null;
  selling_price: number | null;
  weight: number | null;
  is_active: boolean | null;
  created_at: Timestamp | null;
};

export type ProductGiftRow = {
  product_id: UUID;
  gift_product_id: UUID;
  created_at: Timestamp;
};

export type SerialNumberRow = {
  id: UUID;
  product_variant_id: UUID | null;
  warehouse_id: UUID | null;
  serial: string | null;
  imei: string | null;
  status: SerialStatus | null;
  imported_at: Timestamp | null;
  sold_at: Timestamp | null;
};

export type StockLevelRow = {
  warehouse_id: UUID;
  product_variant_id: UUID;
  available_qty: number | null;
  reserved_qty: number | null;
  incoming_qty: number | null;
};

export type CustomerRow = {
  id: UUID;
  organization_id: UUID | null;
  full_name: string | null;
  phone: string | null;
  email: string | null;
  birthday: string | null;
  loyalty_points: number | null;
  tier: CustomerTier | null;
  created_at: Timestamp | null;
};

export type SupplierRow = {
  id: UUID;
  organization_id: UUID | null;
  company_name: string;
  tax_code: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  created_at: Timestamp | null;
};

export type PurchaseOrderRow = {
  id: UUID;
  supplier_id: UUID | null;
  warehouse_id: UUID | null;
  po_number: string;
  status: PurchaseOrderStatus | null;
  ordered_at: Timestamp | null;
  expected_at: Timestamp | null;
  created_by: UUID | null;
  created_at: Timestamp | null;
};

export type PurchaseOrderItemRow = {
  id: UUID;
  purchase_order_id: UUID | null;
  product_variant_id: UUID | null;
  quantity: number;
  unit_cost: number;
};

export type InventoryTransactionRow = {
  id: UUID;
  organization_id: UUID | null;
  warehouse_id: UUID | null;
  product_variant_id: UUID | null;
  serial_number_id: UUID | null;
  type: InventoryTxType;
  quantity: number;
  unit_cost: number | null;
  reference_type: string | null;
  reference_id: UUID | null;
  note: string | null;
  created_by: UUID | null;
  created_at: Timestamp | null;
};

export type OrderRow = {
  id: UUID;
  organization_id: UUID | null;
  shop_id: UUID | null;
  customer_id: UUID | null;
  order_number: string;
  channel: SaleChannel | null;
  status: OrderStatus | null;
  payment_status: PaymentStatus | null;
  fulfillment_status: FulfillmentStatus | null;
  subtotal: number | null;
  discount_amount: number | null;
  total_amount: number | null;
  note: string | null;
  created_by: UUID | null;
  created_at: Timestamp | null;
};

export type OrderItemRow = {
  id: UUID;
  order_id: UUID | null;
  product_variant_id: UUID | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_snapshot: Json | null;
};

export type PaymentRow = {
  id: UUID;
  order_id: UUID | null;
  method: PaymentMethod | null;
  amount: number | null;
  status: PaymentStatus | null;
  transaction_code: string | null;
  paid_at: Timestamp | null;
};

export type PosSessionRow = {
  id: UUID;
  shop_id: UUID | null;
  opened_by: UUID | null;
  opened_at: Timestamp | null;
  closed_at: Timestamp | null;
  opening_cash: number | null;
  closing_cash: number | null;
  expected_cash: number | null;
  difference_cash: number | null;
};

export type LoyaltyTransactionRow = {
  id: UUID;
  customer_id: UUID | null;
  order_id: UUID | null;
  points: number;
  type: LoyaltyTxType | null;
  created_at: Timestamp | null;
};

export type WarrantyRow = {
  id: UUID;
  serial_number_id: UUID | null;
  customer_id: UUID | null;
  order_id: UUID | null;
  start_date: string | null;
  end_date: string | null;
  status: WarrantyStatus | null;
};

export type RepairTicketRow = {
  id: UUID;
  shop_id: UUID | null;
  customer_id: UUID | null;
  device_name: string | null;
  serial_number: string | null;
  issue_description: string | null;
  condition_description: string | null;
  images: Json | null;
  status: RepairStatus | null;
  estimated_cost: number | null;
  actual_cost: number | null;
  assigned_to: UUID | null;
  created_at: Timestamp | null;
};

export type TradeInRequestRow = {
  id: UUID;
  customer_id: UUID | null;
  device_name: string | null;
  serial_number: string | null;
  condition_note: string | null;
  images: Json | null;
  offered_price: number | null;
  status: TradeInStatus | null;
  created_at: Timestamp | null;
};

export type RepairServicePriceType = "fixed" | "from" | "range" | "contact";
export type RepairServiceRow = {
  id: UUID;
  organization_id: UUID | null;
  category: string;
  name: string;
  slug: string | null;
  description: string | null;
  price_type: RepairServicePriceType;
  price_min: number | null;
  price_max: number | null;
  unit: string | null;
  warranty_text: string | null;
  position: number;
  is_active: boolean;
  is_featured: boolean;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
};

export type SettingRow = {
  id: UUID;
  organization_id: UUID | null;
  shop_id: UUID | null;
  group_name: string | null;
  key: string | null;
  value: Json | null;
};

export type AuditLogRow = {
  id: number;
  organization_id: UUID | null;
  user_id: UUID | null;
  entity_type: string | null;
  entity_id: UUID | null;
  action: string | null;
  before_data: Json | null;
  after_data: Json | null;
  ip_address: string | null;
  created_at: Timestamp | null;
};

export type LaptopRow = {
  id: UUID;
  device_id: string;
  device_name: string;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
};

export type LaptopSpecRow = {
  id: UUID;
  laptop_id: UUID | null;
  cpu_name: string | null;
  cpu_cores: number | null;
  cpu_threads: number | null;
  cpu_base_ghz: number | null;
  ram_gb: number | null;
  ram_brand: string | null;
  ram_speed_mhz: number | null;
  ram_type: string | null;
  ram_slots: number | null;
  storage_brand: string | null;
  storage_type: string | null;
  storage_gb: number | null;
  gpu_name: string | null;
  gpu_vendor: string | null;
  gpu_vram_gb: number | null;
  gpu_power_watts: number | null;
  mainboard: string | null;
  battery_design_mwh: number | null;
  battery_full_mwh: number | null;
  battery_health: number | null;
  battery_cycles: number | null;
  os_name: string | null;
  os_version: string | null;
  created_at: Timestamp | null;
  updated_at: Timestamp | null;
};

export type GpuBenchmarkRow = {
  id: UUID;
  laptop_id: UUID | null;
  test_date: Timestamp | null;
  gpu_score: number;
  gpu_rank: string | null;
  benchmark_tool: string | null;
  test_width: number | null;
  test_height: number | null;
  test_preset: string | null;
  test_duration_seconds: number | null;
  fps_avg: number | null;
  fps_min: number | null;
  fps_max: number | null;
  note: string | null;
  condition: string | null;
  tech_name: string | null;
  created_at: Timestamp | null;
};

export type BenchmarkDraftRow = {
  id: UUID;
  payload: Json | null;
  saved: boolean;
  created_at: Timestamp | null;
  expires_at: Timestamp | null;
};

// ---------- Helper: build Insert/Update từ Row ----------
type Insertable<T, Required extends keyof T = never> = {
  [K in Required]: T[K];
} & {
  [K in Exclude<keyof T, Required>]?: T[K];
};

type Updatable<T> = Partial<T>;
type AnyRelationship = {
  foreignKeyName: string;
  columns: string[];
  isOneToOne?: boolean;
  referencedRelation: string;
  referencedColumns: string[];
};
type AnyTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
  Relationships: AnyRelationship[];
};
type AnyView = {
  Row: Record<string, unknown>;
  Relationships: AnyRelationship[];
};
type AnyFunction = {
  Args: Record<string, unknown> | never;
  Returns: unknown;
};

// ---------- Database root type ----------
export type Database = {
  public: {
    Tables: {
      benchmark_drafts: {
        Row: BenchmarkDraftRow;
        Insert: Insertable<BenchmarkDraftRow>;
        Update: Updatable<BenchmarkDraftRow>;
        Relationships: [];
      };
      laptops: {
        Row: LaptopRow;
        Insert: Insertable<LaptopRow, "device_id" | "device_name">;
        Update: Updatable<LaptopRow>;
        Relationships: [];
      };
      laptop_specs: {
        Row: LaptopSpecRow;
        Insert: Insertable<LaptopSpecRow>;
        Update: Updatable<LaptopSpecRow>;
        Relationships: [];
      };
      gpu_benchmarks: {
        Row: GpuBenchmarkRow;
        Insert: Insertable<GpuBenchmarkRow, "gpu_score">;
        Update: Updatable<GpuBenchmarkRow>;
        Relationships: [];
      };
      organizations: {
        Row: OrganizationRow;
        Insert: Insertable<OrganizationRow, "name">;
        Update: Updatable<OrganizationRow>;
        Relationships: [
          { foreignKeyName: "organizations_parent_id_fkey", columns: ["parent_id"], referencedRelation: "organizations", referencedColumns: ["id"] },
        ];
      };
      shops: {
        Row: ShopRow;
        Insert: Insertable<ShopRow, "organization_id" | "name" | "code">;
        Update: Updatable<ShopRow>;
        Relationships: [];
      };
      warehouses: {
        Row: WarehouseRow;
        Insert: Insertable<WarehouseRow, "name">;
        Update: Updatable<WarehouseRow>;
        Relationships: [
          { foreignKeyName: "warehouses_organization_id_fkey", columns: ["organization_id"], referencedRelation: "organizations", referencedColumns: ["id"] },
        ];
      };
      user_profiles: {
        Row: UserProfileRow;
        Insert: Insertable<UserProfileRow, "id">;
        Update: Updatable<UserProfileRow>;
        Relationships: [];
      };
      roles: {
        Row: RoleRow;
        Insert: Insertable<RoleRow, "name" | "code">;
        Update: Updatable<RoleRow>;
        Relationships: [];
      };
      permissions: {
        Row: PermissionRow;
        Insert: Insertable<PermissionRow, "code">;
        Update: Updatable<PermissionRow>;
        Relationships: [];
      };
      role_permissions: {
        Row: RolePermissionRow;
        Insert: RolePermissionRow;
        Update: Updatable<RolePermissionRow>;
        Relationships: [];
      };
      shop_staff: {
        Row: ShopStaffRow;
        Insert: Insertable<ShopStaffRow>;
        Update: Updatable<ShopStaffRow>;
        Relationships: [];
      };
      brands: {
        Row: BrandRow;
        Insert: Insertable<BrandRow, "name">;
        Update: Updatable<BrandRow>;
        Relationships: [];
      };
      categories: {
        Row: CategoryRow;
        Insert: Insertable<CategoryRow, "name">;
        Update: Updatable<CategoryRow>;
        Relationships: [];
      };
      spec_templates: {
        Row: SpecTemplateRow;
        Insert: Insertable<SpecTemplateRow, "name" | "fields">;
        Update: Updatable<SpecTemplateRow>;
        Relationships: [];
      };
      products: {
        Row: ProductRow;
        Insert: Insertable<ProductRow, "name">;
        Update: Updatable<ProductRow>;
        Relationships: [];
      };
      product_variants: {
        Row: ProductVariantRow;
        Insert: Insertable<ProductVariantRow, "sku">;
        Update: Updatable<ProductVariantRow>;
        Relationships: [];
      };
      product_gifts: {
        Row: ProductGiftRow;
        Insert: Insertable<ProductGiftRow, "product_id" | "gift_product_id">;
        Update: Updatable<ProductGiftRow>;
        Relationships: [];
      };
      serial_numbers: {
        Row: SerialNumberRow;
        Insert: Insertable<SerialNumberRow>;
        Update: Updatable<SerialNumberRow>;
        Relationships: [];
      };
      stock_levels: {
        Row: StockLevelRow;
        Insert: Insertable<StockLevelRow, "warehouse_id" | "product_variant_id">;
        Update: Updatable<StockLevelRow>;
        Relationships: [];
      };
      customers: {
        Row: CustomerRow;
        Insert: Insertable<CustomerRow>;
        Update: Updatable<CustomerRow>;
        Relationships: [];
      };
      suppliers: {
        Row: SupplierRow;
        Insert: Insertable<SupplierRow, "company_name">;
        Update: Updatable<SupplierRow>;
        Relationships: [];
      };
      purchase_orders: {
        Row: PurchaseOrderRow;
        Insert: Insertable<PurchaseOrderRow, "po_number">;
        Update: Updatable<PurchaseOrderRow>;
        Relationships: [];
      };
      purchase_order_items: {
        Row: PurchaseOrderItemRow;
        Insert: Insertable<PurchaseOrderItemRow, "quantity" | "unit_cost">;
        Update: Updatable<PurchaseOrderItemRow>;
        Relationships: [];
      };
      inventory_transactions: {
        Row: InventoryTransactionRow;
        Insert: Insertable<InventoryTransactionRow, "type" | "quantity">;
        Update: Updatable<InventoryTransactionRow>;
        Relationships: [];
      };
      orders: {
        Row: OrderRow;
        Insert: Insertable<OrderRow, "order_number">;
        Update: Updatable<OrderRow>;
        Relationships: [];
      };
      order_items: {
        Row: OrderItemRow;
        Insert: Insertable<OrderItemRow, "quantity" | "unit_price" | "total_price">;
        Update: Updatable<OrderItemRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Insertable<PaymentRow>;
        Update: Updatable<PaymentRow>;
        Relationships: [];
      };
      pos_sessions: {
        Row: PosSessionRow;
        Insert: Insertable<PosSessionRow>;
        Update: Updatable<PosSessionRow>;
        Relationships: [];
      };
      loyalty_transactions: {
        Row: LoyaltyTransactionRow;
        Insert: Insertable<LoyaltyTransactionRow, "points">;
        Update: Updatable<LoyaltyTransactionRow>;
        Relationships: [];
      };
      warranties: {
        Row: WarrantyRow;
        Insert: Insertable<WarrantyRow>;
        Update: Updatable<WarrantyRow>;
        Relationships: [];
      };
      repair_tickets: {
        Row: RepairTicketRow;
        Insert: Insertable<RepairTicketRow>;
        Update: Updatable<RepairTicketRow>;
        Relationships: [];
      };
      trade_in_requests: {
        Row: TradeInRequestRow;
        Insert: Insertable<TradeInRequestRow>;
        Update: Updatable<TradeInRequestRow>;
        Relationships: [];
      };
      repair_services: {
        Row: RepairServiceRow;
        Insert: Insertable<RepairServiceRow, "name">;
        Update: Updatable<RepairServiceRow>;
        Relationships: [];
      };
      settings: {
        Row: SettingRow;
        Insert: Insertable<SettingRow>;
        Update: Updatable<SettingRow>;
        Relationships: [];
      };
      audit_logs: {
        Row: AuditLogRow;
        Insert: Insertable<AuditLogRow>;
        Update: Updatable<AuditLogRow>;
        Relationships: [];
      };
    } & Record<string, AnyTable>;
    Views: Record<string, AnyView>;
    Functions: {
      checkout_order: {
        Args: { payload: Json };
        Returns: Json;
      };
      cancel_order: {
        Args: { p_order_id: UUID };
        Returns: Json;
      };
      receive_purchase_order: {
        Args: { p_po_id: UUID; p_serials: Json | null };
        Returns: Json;
      };
      transfer_inventory: {
        Args: {
          p_from_warehouse: UUID;
          p_to_warehouse: UUID;
          p_items: Json;
          p_note: string | null;
        };
        Returns: Json;
      };
      close_pos_session: {
        Args: { p_session_id: UUID; p_closing_cash: number };
        Returns: Json;
      };
    } & Record<string, AnyFunction>;
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

// ---------- Aliases tiện dùng ----------
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];
export type DbFunctions = Database["public"]["Functions"];

// Legacy alias (giữ tương thích với code cũ dùng UserRole)
export type UserRole = string;
