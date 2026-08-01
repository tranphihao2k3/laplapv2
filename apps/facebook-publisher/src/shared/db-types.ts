/**
 * SQLite row types — DB-001.
 *
 * Khớp schema trong src/main/db/schema.ts. Renderer không cần — chỉ main
 * process và repository layer dùng.
 *
 * Khi thêm cột mới: thêm version migration + cập nhật type tương ứng.
 * KHÔNG thêm field nullable lung tung — review lại schema trước.
 */

export type ProductCacheRow = {
  product_id: string;
  org_id: string;
  name: string;
  slug: string | null;
  short_description: string | null;
  thumbnail_url: string | null;
  status: string;
  product_url: string | null;
  updated_at: string | null;
  synced_at: string;
  raw_json: string | null;
};

export type VariantCacheRow = {
  variant_id: string;
  product_id: string;
  sku: string;
  name: string | null;
  attributes_json: string | null;
  specs_json: string | null;
  selling_price: number | null;
  is_active: number;
  available_qty: number;
  synced_at: string;
};

export type PostingMode = "assisted" | "auto";

export type FacebookGroupRow = {
  id: string;
  name: string;
  url: string;
  enabled: number;
  locale: string | null;
  notes: string | null;
  max_images: number;
  allow_link: number;
  posting_mode: PostingMode;
  created_at: string;
  updated_at: string | null;
};

export type GroupSetRow = {
  id: string;
  name: string;
  created_at: string;
};

export type GroupSetGroupRow = {
  group_set_id: string;
  group_id: string;
};

export type TemplateRow = {
  id: string;
  name: string;
  body: string;
  allowlisted_variables_json: string;
  content_text: string | null;
  created_at: string;
  updated_at: string | null;
};

export type CampaignStatus = "draft" | "ready" | "archived";

export type CampaignRow = {
  id: string;
  name: string;
  product_id: string;
  variant_id: string;
  template_id: string;
  group_set_id: string | null;
  image_paths_json: string;
  status: CampaignStatus;
  created_at: string;
  updated_at: string | null;
};

/** Theo docs §13: state enum của queue. */
export type JobState =
  | "draft"
  | "queued"
  | "preflight"
  | "posting"
  | "awaiting_confirmation"
  | "published"
  | "pending_approval"
  | "unverified"
  | "needs_action"
  | "failed"
  | "skipped"
  | "cancelled";

export type PostJobRow = {
  id: string;
  campaign_id: string;
  group_id: string;
  state: JobState;
  fingerprint: string;
  submit_clicked_at: string | null;
  post_url: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  created_at: string;
  updated_at: string | null;
};

export type JobAttemptRow = {
  id: string;
  job_id: string;
  attempt_number: number;
  from_state: JobState | null;
  to_state: JobState;
  error_code: string | null;
  error_message: string | null;
  started_at: string;
  ended_at: string | null;
};

export type SettingsRow = {
  key: string;
  value_json: string;
  updated_at: string;
};
