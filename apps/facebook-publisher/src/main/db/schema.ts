/**
 * File thứ tự thời gian các migration — DB-001.
 *
 * Mỗi migration tạo 1 bảng (hoặc nhóm bảng) + index cần thiết. Đặt theo
 * thứ tự foreign key: bảng cha trước, bảng con sau.
 *
 * Khi thêm bảng mới: tăng version, KHÔNG reorder.
 *
 * KHÔNG dùng cho việc khác ngoài schema. Settings có JSON để linh hoạt;
 * khi cấu trúc stable, tách thành bảng chuyên biệt ở version sau.
 */
import type { Migration } from "./migrations";

export const migrations: Migration[] = [
  {
    version: 1,
    name: "product_cache + variant_cache",
    sql: `
      -- Cache sản phẩm từ API /api/v1/desktop-posting/products.
      -- Chỉ mirror field cần cho offline browse + enqueue. Không thay thế
      -- source of truth (Supabase/Postgres).
      CREATE TABLE product_cache (
        product_id TEXT PRIMARY KEY NOT NULL,
        org_id TEXT NOT NULL,
        name TEXT NOT NULL,
        slug TEXT,
        short_description TEXT,
        thumbnail_url TEXT,
        status TEXT NOT NULL,
        product_url TEXT,
        updated_at TEXT,
        synced_at TEXT NOT NULL,
        -- raw JSON payload lưu gallery/specs để dự phòng mở rộng.
        raw_json TEXT
      );
      CREATE INDEX idx_product_cache_org_synced ON product_cache(org_id, synced_at);
      CREATE INDEX idx_product_cache_status ON product_cache(org_id, status);

      -- Cache variants để tính availableQty và enqueue preflight.
      CREATE TABLE variant_cache (
        variant_id TEXT PRIMARY KEY NOT NULL,
        product_id TEXT NOT NULL,
        sku TEXT NOT NULL,
        name TEXT,
        attributes_json TEXT,
        specs_json TEXT,
        selling_price REAL,
        is_active INTEGER NOT NULL DEFAULT 1,
        available_qty INTEGER NOT NULL DEFAULT 0,
        synced_at TEXT NOT NULL,
        FOREIGN KEY (product_id) REFERENCES product_cache(product_id) ON DELETE CASCADE
      );
      CREATE INDEX idx_variant_cache_product ON variant_cache(product_id);
      CREATE UNIQUE INDEX uq_variant_cache_sku ON variant_cache(sku);
    `,
  },

  {
    version: 2,
    name: "facebook_groups + group_sets",
    sql: `
      -- Nhóm Facebook user thêm thủ công (không scrape). URL chuẩn hoá về
      -- dạng facebook.com/groups/<id>.
      CREATE TABLE facebook_groups (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        url TEXT NOT NULL UNIQUE,
        enabled INTEGER NOT NULL DEFAULT 1,
        locale TEXT,
        notes TEXT,
        max_images INTEGER NOT NULL DEFAULT 10,
        allow_link INTEGER NOT NULL DEFAULT 1,
        posting_mode TEXT NOT NULL DEFAULT 'assisted',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT
      );
      CREATE INDEX idx_facebook_groups_enabled ON facebook_groups(enabled);

      -- Tập nhóm để chọn nhanh trong campaign.
      CREATE TABLE group_sets (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );

      -- Bảng nối many-to-many giữa group_set và facebook_group.
      -- Xoá group không cascade xoá history job.
      CREATE TABLE group_set_groups (
        group_set_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        PRIMARY KEY (group_set_id, group_id),
        FOREIGN KEY (group_set_id) REFERENCES group_sets(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES facebook_groups(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_group_set_groups_group ON group_set_groups(group_id);
    `,
  },

  {
    version: 3,
    name: "templates",
    sql: `
      -- Template text cho bài đăng. Thân template render qua TPL-001
      -- (allowlist biến, KHÔNG eval). content_text là snapshot cuối đã
      -- render để preview — KHÔNG phải input cho render sau này.
      CREATE TABLE templates (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        allowlisted_variables_json TEXT NOT NULL DEFAULT '[]',
        content_text TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT
      );
      CREATE UNIQUE INDEX uq_templates_name ON templates(name);
    `,
  },

  {
    version: 4,
    name: "campaigns",
    sql: `
      -- Campaign = 1 product + 1 variant + 1 template + N group + N image.
      -- Snapshot ở CMP-002 sẽ tách thành bảng riêng khi có yêu cầu review.
      CREATE TABLE campaigns (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        product_id TEXT NOT NULL,
        variant_id TEXT NOT NULL,
        template_id TEXT NOT NULL,
        group_set_id TEXT,
        image_paths_json TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL DEFAULT 'draft',
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT,
        FOREIGN KEY (product_id) REFERENCES product_cache(product_id),
        FOREIGN KEY (variant_id) REFERENCES variant_cache(variant_id),
        FOREIGN KEY (template_id) REFERENCES templates(id),
        FOREIGN KEY (group_set_id) REFERENCES group_sets(id) ON DELETE SET NULL
      );
      CREATE INDEX idx_campaigns_status ON campaigns(status);
    `,
  },

  {
    version: 5,
    name: "post_jobs + job_attempts",
    sql: `
      -- Job đăng bài (queue). State xem docs §13.
      CREATE TABLE post_jobs (
        id TEXT PRIMARY KEY NOT NULL,
        campaign_id TEXT NOT NULL,
        group_id TEXT NOT NULL,
        state TEXT NOT NULL DEFAULT 'draft',
        -- Fingerprint chống trùng (CMP-003) — hash tổng hợp group+variant+
        -- content+ordered image paths. Override phải audit qua state/skipped.
        fingerprint TEXT NOT NULL,
        submit_clicked_at TEXT,
        post_url TEXT,
        last_error_code TEXT,
        last_error_message TEXT,
        created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        updated_at TEXT,
        FOREIGN KEY (campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY (group_id) REFERENCES facebook_groups(id) ON DELETE RESTRICT
      );
      -- Unique partial index chỉ áp dụng cho job CHƯA kết thúc:
      -- draft/queued/preflight/posting/awaiting_confirmation/needs_action.
      -- Job done (published/failed/skipped) không còn blocking.
      CREATE UNIQUE INDEX uq_post_jobs_fingerprint_active
        ON post_jobs(fingerprint)
        WHERE state IN ('draft','queued','preflight','posting','awaiting_confirmation','needs_action');
      CREATE INDEX idx_post_jobs_state ON post_jobs(state);
      CREATE INDEX idx_post_jobs_campaign ON post_jobs(campaign_id);

      -- Mỗi lần thử (hoặc mỗi phase transition) có 1 attempt log để debug.
      CREATE TABLE job_attempts (
        id TEXT PRIMARY KEY NOT NULL,
        job_id TEXT NOT NULL,
        attempt_number INTEGER NOT NULL,
        from_state TEXT,
        to_state TEXT NOT NULL,
        error_code TEXT,
        error_message TEXT,
        started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
        ended_at TEXT,
        FOREIGN KEY (job_id) REFERENCES post_jobs(id) ON DELETE CASCADE
      );
      CREATE INDEX idx_job_attempts_job ON job_attempts(job_id, attempt_number);
    `,
  },

  {
    version: 6,
    name: "settings",
    sql: `
      -- Cấu hình app. K/V cho linh hoạt — value là JSON để typed schema
      -- ở tầng service (APP-003). KHÔNG lưu secret trong bảng này.
      -- Secret/refresh token dùng Electron safeStorage (APP-004).
      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value_json TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `,
  },
  {
    version: 7,
    name: "campaigns snapshot_json + post_jobs snapshot_json",
    sql: `
      -- CMP-002: thêm snapshot JSON cho campaign (preview/template body
      -- tại thời điểm enqueue) và post_jobs (rendered text + product/
      -- variant fields + image hashes). Sửa template/product sau khi
      -- enqueue KHÔNG ảnh hưởng job cũ.
      ALTER TABLE campaigns ADD COLUMN snapshot_json TEXT;
      ALTER TABLE post_jobs ADD COLUMN snapshot_json TEXT;
    `,
  },
];
