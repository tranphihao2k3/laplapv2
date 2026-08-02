/**
 * CampaignService — CMP-001/002/003.
 *
 * - Tạo campaign từ product+variant+template+groupSet+images.
 * - Render preview tại thời điểm enqueue (snapshot_text).
 * - Enqueue job cho từng group trong set; snapshot JSON lưu vào
 *   post_jobs.snapshot_json để không bị ảnh hưởng bởi thay đổi
 *   template/product sau đó.
 * - Fingerprint unique partial index chống trùng.
 *
 * KHÔNG dùng raw SQL ngoài repository.
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors";
import { CampaignRepository } from "../db/repositories/campaigns";
import { PostJobRepository } from "../db/repositories/post-jobs";
import { ProductRepository } from "../db/repositories/products";
import { TemplateRepository } from "../db/repositories/templates";
import { GroupSetRepository, FacebookGroupRepository } from "../db/repositories/facebook-groups";
import { render, makeResolver } from "../template/engine";
import { buildSnapshot, type JobSnapshot } from "../jobs/snapshot";
import { computeFingerprint } from "../jobs/fingerprint";
import type { CampaignStatus } from "../../shared/db-types";

export type CampaignInput = {
  name: string;
  productId: string;
  variantId: string;
  templateId: string;
  groupSetId?: string | null;
  /** File paths từ MED-001 cache. Có thể rỗng. */
  imagePaths?: string[];
  status?: CampaignStatus;
};

export type EnqueueRequest = {
  campaignId: string;
  /** Override URLs (vd từ MED-001 download result); để trace lại trong snapshot. */
  imageUrls?: string[];
  /** Sha256 ảnh (sau MED-001). */
  imageSha256s?: string[];
};

export type EnqueueResult = {
  campaignId: string;
  jobsCreated: number;
  duplicates: number;
  errors: string[];
};

export class CampaignService {
  constructor(
    private readonly campaigns: CampaignRepository,
    private readonly jobs: PostJobRepository,
    private readonly products: ProductRepository,
    private readonly templates: TemplateRepository,
    private readonly groups: FacebookGroupRepository,
    private readonly sets: GroupSetRepository,
  ) {}

  createCampaign(input: CampaignInput): { id: string; snapshot: JobSnapshot | null } {
    if (input.name.trim().length === 0) {
      throw new AppError("CAMPAIGN_NAME_REQUIRED", "Tên chiến dịch không được rỗng", 400);
    }
    const product = this.products.findById(input.productId);
    if (!product) throw new AppError("CAMPAIGN_PRODUCT_NOT_FOUND", `Sản phẩm không tồn tại: ${input.productId}`, 404);
    const variant = this.products.listVariants(input.productId).find((v) => v.variant_id === input.variantId);
    if (!variant) throw new AppError("CAMPAIGN_VARIANT_NOT_FOUND", `Biến thể không tồn tại: ${input.variantId}`, 404);
    const template = this.templates.findById(input.templateId);
    if (!template) throw new AppError("CAMPAIGN_TEMPLATE_NOT_FOUND", `Mẫu không tồn tại: ${input.templateId}`, 404);
    if (input.groupSetId) {
      const set = this.sets.listSets().find((s) => s.id === input.groupSetId);
      if (!set) throw new AppError("CAMPAIGN_SET_NOT_FOUND", `Tập nhóm không tồn tại: ${input.groupSetId}`, 404);
    }

    const id = randomUUID();
    this.campaigns.insert(id, {
      name: input.name.trim(),
      productId: input.productId,
      variantId: input.variantId,
      templateId: input.templateId,
      groupSetId: input.groupSetId ?? null,
      imagePaths: input.imagePaths ?? [],
      status: input.status ?? "draft",
    });
    return { id, snapshot: null };
  }

  updateCampaign(id: string, patch: Partial<CampaignInput>): { id: string } {
    const existing = this.campaigns.findById(id);
    if (!existing) throw new AppError("CAMPAIGN_NOT_FOUND", `Chiến dịch không tồn tại: ${id}`, 404);
    this.campaigns.update(id, patch);
    return { id };
  }

  deleteCampaign(id: string): void {
    const existing = this.campaigns.findById(id);
    if (!existing) throw new AppError("CAMPAIGN_NOT_FOUND", `Chiến dịch không tồn tại: ${id}`, 404);
    this.campaigns.delete(id);
  }

  list() {
    return this.campaigns.listAll();
  }

  findById(id: string) {
    return this.campaigns.findById(id);
  }

  /**
   * Enqueue job cho từng nhóm enabled trong tập nhóm của campaign.
   *
   * Mỗi job:
   *  - Snapshot JSON (CMP-002).
   *  - Fingerprint (CMP-003).
   *  - state='queued'.
   *
   * Lỗi duplicate (UNIQUE PARTIAL INDEX) được đếm riêng để UI báo cáo.
   */
  enqueue(req: EnqueueRequest): EnqueueResult {
    const campaign = this.campaigns.findById(req.campaignId);
    if (!campaign) throw new AppError("CAMPAIGN_NOT_FOUND", `Chiến dịch không tồn tại: ${req.campaignId}`, 404);

    const product = this.products.findById(campaign.product_id);
    if (!product) throw new AppError("CAMPAIGN_PRODUCT_NOT_FOUND", "Sản phẩm không còn trong cache", 412);

    const variant = this.products.listVariants(campaign.product_id).find((v) => v.variant_id === campaign.variant_id);
    if (!variant) throw new AppError("CAMPAIGN_VARIANT_NOT_FOUND", "Biến thể không còn trong cache", 412);

    const template = this.templates.findById(campaign.template_id);
    if (!template) throw new AppError("CAMPAIGN_TEMPLATE_NOT_FOUND", "Mẫu không còn tồn tại", 412);

    // Lấy group list từ set (nếu có) hoặc từ enabled groups.
    const groupList = campaign.group_set_id
      ? this.sets.listMembers(campaign.group_set_id)
      : this.groups.listEnabled();
    const enabledGroups = groupList.filter((g) => g.enabled !== 0);
    if (enabledGroups.length === 0) {
      throw new AppError(
        "CAMPAIGN_NO_GROUPS",
        "Tập nhóm rỗng hoặc không có nhóm nào enabled",
        400,
      );
    }

    // Build template context từ first group để render text snapshot.
    // (Mỗi job có group riêng — fingerprint phụ thuộc group_id, text giữ
    // nguyên vì text chỉ phụ thuộc product/variant/template).
    const firstGroup = enabledGroups[0]!;

    let imageUrls = req.imageUrls ?? [];
    let imageSha256s = req.imageSha256s ?? [];
    if (imageUrls.length === 0 || imageSha256s.length === 0) {
      // Fallback: dùng từ campaign.image_paths_json (parse thô).
      try {
        const arr = JSON.parse(campaign.image_paths_json) as string[];
        imageUrls = arr;
        imageSha256s = arr.map((p) => p.replace(/^.*[/\\]/, "").split(".")[0] ?? "");
      } catch {
        imageUrls = [];
        imageSha256s = [];
      }
    }

    const ctx = {
      "product.name": product.name,
      "product.shortDescription": product.short_description ?? "",
      "product.slug": product.slug ?? "",
      "product.updatedAt": product.updated_at ?? "",
      "variant.sku": variant.sku,
      "variant.name": variant.name ?? "",
      "variant.price": variant.selling_price ?? 0,
      "variant.availableQty": variant.available_qty,
      "group.name": firstGroup.name,
      "group.url": firstGroup.url,
      "post.id": "",
      "post.scheduledAt": "",
    };
    const renderedText = render(template.body, makeResolver(ctx), { locale: "vi-VN" });

    const imagesArr = imageUrls.map((url, i) => ({
      url,
      filePath: (() => {
        try {
          const arr = JSON.parse(campaign.image_paths_json) as string[];
          return arr[i] ?? "";
        } catch {
          return "";
        }
      })(),
      sha256: imageSha256s[i] ?? "",
    }));

    let created = 0;
    let duplicates = 0;
    const errors: string[] = [];

    for (const group of enabledGroups) {
      const groupCtx = { ...ctx, "group.name": group.name, "group.url": group.url };
      const groupText = render(template.body, makeResolver(groupCtx), { locale: "vi-VN" });

      const snapshot = buildSnapshot({
        product: {
          productId: product.product_id,
          name: product.name,
          slug: product.slug,
          shortDescription: product.short_description,
          thumbnailUrl: product.thumbnail_url,
          updatedAt: product.updated_at,
          status: product.status,
          productUrl: product.product_url,
          syncedAt: product.synced_at,
          variantsCount: 0,
          inStock: variant.available_qty > 0,
        },
        variant: {
          productId: variant.product_id,
          variantId: variant.variant_id,
          sku: variant.sku,
          name: variant.name,
          attributes: null,
          specs: null,
          sellingPrice: variant.selling_price,
          isActive: variant.is_active !== 0,
          availableQty: variant.available_qty,
          syncedAt: variant.synced_at,
        },
        template: { id: template.id, name: template.name, body: template.body },
        group: { id: group.id, name: group.name, url: group.url },
        images: imagesArr,
        renderedText: groupText,
      });

      const fingerprint = computeFingerprint({
        groupId: group.id,
        variantId: variant.variant_id,
        renderedText: groupText,
        imageSha256s,
      });

      try {
        this.jobs.insert({
          id: randomUUID(),
          campaign_id: campaign.id,
          group_id: group.id,
          state: "queued",
          fingerprint,
          snapshot_json: JSON.stringify(snapshot),
        });
        created += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("UNIQUE") && msg.toLowerCase().includes("fingerprint")) {
          duplicates += 1;
        } else {
          errors.push(msg);
        }
      }
    }

    return { campaignId: req.campaignId, jobsCreated: created, duplicates, errors };
  }
}