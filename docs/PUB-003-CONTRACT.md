# PUB-003 — Khóa API contract và local model

**Owner**: DEV-A + DEV-B  
**Reviewer**: DEV-D  
**Size**: M  
**Status**: DONE

## Schema versioned

- API desktop đặt dưới `/api/v1/desktop-posting/...` — bất kỳ breaking change phải bump `/v2`.
- DB SQLite có `pragma user_version` quản lý schema.

## Bảng contract đã chốt

| Resource | Field / Enum | Sample |
|----------|--------------|--------|
| Product | id, name, slug, shortDescription, plainTextDescription, thumbnailUrl, images[], productUrl, updatedAt | xem `src/lib/schemas/desktop-product.ts` |
| Variant | id, sku, name, attributes, specs, sellingPrice, availableQty, isActive | id, sku, name, attributes, specs, sellingPrice, availableQty, isActive |
| Group | id, url, name, enabled, postingMode | assisted / auto |
| Template | id, name, body, variables[] | `{{product.name}}` |
| Campaign | id, name, productId, variantId, templateId, groupSetId, scheduledAt | nullable |
| PostJob | id, campaignId, state, fingerprint, snapshotJson, attempts | queued / pre_submitting / submitting / submitted / success / pending_approval / failed / unknown |
| JobAttempt | id, jobId, startedAt, endedAt, errorCode, errorMessage | |
| ErrorCode | enum: token_expired, network, http_4xx_5xx, post_blocked, no_permission, pending_approval, checkpoint, captcha, unknown_ui, rate_limit, content_too_long, no_image | |
| QueueState | enum: queued, pre_submitting, submitting, submitted, success, pending_approval, failed, unknown, cancelled | |

## Sample product detail

```json
{
  "product": {
    "id": "p_001",
    "name": "Laptop Acer Nitro 5",
    "slug": "acer-nitro-5",
    "shortDescription": "RTX 3060, 16GB RAM",
    "plainTextDescription": "Acer Nitro 5 2024... trọng lượng 2.5kg",
    "thumbnailUrl": "https://cdn.laplap.vn/p_001/thumb.jpg",
    "images": ["https://cdn.laplap.vn/p_001/1.jpg", "https://cdn.laplap.vn/p_001/2.jpg"],
    "productUrl": "https://laplap.vn/p/acer-nitro-5",
    "updatedAt": "2026-07-30T08:00:00Z"
  },
  "variants": [
    {
      "id": "v_001",
      "sku": "NITRO5-I7-3060",
      "name": "i7-12700H / RTX 3060 / 16GB / 512GB",
      "attributes": {"cpu": "i7-12700H", "gpu": "RTX 3060", "ram": "16GB", "ssd": "512GB"},
      "specs": {"weight": "2.5kg", "battery": "57Wh"},
      "sellingPrice": 25990000,
      "availableQty": 8,
      "isActive": true
    }
  ]
}
```

Đã validate thủ công bằng `apps/facebook-publisher/tests/fixtures/sample-product.json`.