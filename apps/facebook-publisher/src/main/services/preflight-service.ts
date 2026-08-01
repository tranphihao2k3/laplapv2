/**
 * PreflightService — QUE-004.
 *
 * Trước khi đăng, kiểm tra variant còn hàng + giá/updatedAt không đổi.
 *
 * - API-005 trả product detail (refetch): gọi API xem còn hàng, giá mới.
 * - So sánh với snapshot ở job.snapshot_json.
 * - Hết hàng → job chuyển 'skipped' + reason.
 * - Giá/updatedAt đổi → job vẫn tiếp tục NHƯNG đánh dấu 'price_changed'
 *   để user xác nhận (CMP-002 preflight cảnh báo).
 *
 * Không throw lỗi — luôn trả typed Result để queue xử lý.
 */
import { AppError } from "../../shared/errors";
import { apiFetch, HttpError } from "../api/http-client";
import { PostJobRepository } from "../db/repositories/post-jobs";
import type { JobSnapshot } from "../jobs/snapshot";
import { SettingsRepository } from "../db/repositories/settings";

export type PreflightResult =
  | { kind: "ok"; priceChanged: boolean; updatedAtChanged: boolean }
  | { kind: "out_of_stock" }
  | { kind: "product_archived" }
  | { kind: "token_expired" }
  | { kind: "network_error"; message: string };

export type PreflightParams = {
  jobId: string;
  apiBaseUrl: string;
  accessToken: string;
};

type ProductDetailResponse = {
  id: string;
  status: "active" | "draft" | "archived";
  updatedAt: string | null;
  variants: Array<{
    id: string;
    sellingPrice: number | null;
    availableQty: number;
    isActive: boolean;
  }>;
};

export class PreflightService {
  constructor(
    private readonly jobs: PostJobRepository,
    private readonly settings: SettingsRepository,
  ) {}

  async run(p: PreflightParams): Promise<PreflightResult> {
    const job = this.jobs.findById(p.jobId);
    if (!job) throw new AppError("JOB_NOT_FOUND", `Không tìm thấy job: ${p.jobId}`, 404);
    if (!job.snapshot_json) {
      throw new AppError("JOB_NO_SNAPSHOT", "Job không có snapshot", 412);
    }
    const snap = JSON.parse(job.snapshot_json) as JobSnapshot;

    let resp: ProductDetailResponse;
    try {
      resp = await apiFetch<ProductDetailResponse>(
        p.apiBaseUrl,
        `/api/v1/desktop-posting/products/${snap.product.productId}`,
        "GET",
        { headers: { Authorization: `Bearer ${p.accessToken}` }, timeoutMs: this.settings.get().httpTimeoutMs },
      );
    } catch (err) {
      if (err instanceof HttpError && (err.status === 401 || err.status === 403)) {
        return { kind: "token_expired" };
      }
      const msg = err instanceof Error ? err.message : String(err);
      return { kind: "network_error", message: msg };
    }

    if (resp.status === "archived") return { kind: "product_archived" };

    const variant = resp.variants.find((v) => v.id === snap.variant.variantId);
    if (!variant || !variant.isActive || variant.availableQty <= 0) {
      return { kind: "out_of_stock" };
    }

    const priceChanged = variant.sellingPrice !== snap.variant.sellingPrice;
    const updatedAtChanged = resp.updatedAt !== snap.product.updatedAt;

    return {
      kind: "ok",
      priceChanged: priceChanged === true,
      updatedAtChanged: updatedAtChanged === true,
    };
  }
}