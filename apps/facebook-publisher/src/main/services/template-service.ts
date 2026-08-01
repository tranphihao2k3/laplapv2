/**
 * TemplateService — TPL-001 + TPL-002 (preview).
 *
 * Validate body (allowlist), render preview với product/variant/group context.
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors";
import { TemplateRepository } from "../db/repositories/templates";
import {
  assertAllowlist,
  makeResolver,
  render,
  type RenderOptions,
} from "../template/engine";
import type { TemplateRow } from "../../shared/db-types";

export type TemplateInput = {
  name: string;
  body: string;
  allowlistedVariables: string[];
  /** Render trước với context đầy đủ (vd từ UI preview) → lưu vào content_text. */
  previewContext?: Record<string, unknown>;
  previewLocale?: string;
};

export type PreviewRequest = {
  body: string;
  context: Record<string, unknown>;
  locale?: string;
};

export class TemplateService {
  constructor(private readonly templates: TemplateRepository) {}

  create(input: TemplateInput): TemplateRow {
    if (input.name.trim().length === 0) {
      throw new AppError("TEMPLATE_NAME_REQUIRED", "Tên mẫu không được rỗng", 400);
    }
    if (input.body.length > 20_000) {
      throw new AppError("TEMPLATE_BODY_TOO_LONG", "Thân mẫu quá dài (>20k)", 400);
    }
    try {
      assertAllowlist(input.body);
    } catch (err) {
      throw new AppError(
        "TEMPLATE_VAR_NOT_ALLOWED",
        err instanceof Error ? err.message : String(err),
        400,
      );
    }
    if (this.templates.findByName(input.name.trim())) {
      throw new AppError("TEMPLATE_DUPLICATE_NAME", `Tên mẫu đã tồn tại: ${input.name}`, 409);
    }

    const contentText = input.previewContext
      ? renderPreview(input.body, input.previewContext, input.previewLocale ?? "vi-VN")
      : null;

    const id = randomUUID();
    try {
      this.templates.insert({
        id,
        name: input.name.trim(),
        body: input.body,
        allowlisted_variables_json: JSON.stringify(input.allowlistedVariables),
        content_text: contentText,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE") && msg.includes("name")) {
        throw new AppError("TEMPLATE_DUPLICATE_NAME", `Tên mẫu đã tồn tại: ${input.name}`, 409);
      }
      throw new AppError("TEMPLATE_DB_ERROR", msg, 500);
    }
    return this.templates.findById(id) as TemplateRow;
  }

  update(id: string, patch: Partial<TemplateInput>): TemplateRow {
    const existing = this.templates.findById(id);
    if (!existing) throw new AppError("TEMPLATE_NOT_FOUND", `Không tìm thấy mẫu: ${id}`, 404);

    if (patch.body !== undefined) {
      try {
        assertAllowlist(patch.body);
      } catch (err) {
        throw new AppError(
          "TEMPLATE_VAR_NOT_ALLOWED",
          err instanceof Error ? err.message : String(err),
          400,
        );
      }
    }
    if (patch.body !== undefined && patch.body.length > 20_000) {
      throw new AppError("TEMPLATE_BODY_TOO_LONG", "Thân mẫu quá dài (>20k)", 400);
    }

    const nextBody = patch.body ?? existing.body;
    const nextContent =
      patch.previewContext !== undefined
        ? renderPreview(nextBody, patch.previewContext, patch.previewLocale ?? "vi-VN")
        : existing.content_text;

    this.templates.update(id, {
      name: patch.name?.trim() ?? existing.name,
      body: nextBody,
      allowlisted_variables_json: patch.allowlistedVariables
        ? JSON.stringify(patch.allowlistedVariables)
        : existing.allowlisted_variables_json,
      content_text: nextContent,
    });
    return this.templates.findById(id) as TemplateRow;
  }

  delete(id: string): void {
    const existing = this.templates.findById(id);
    if (!existing) throw new AppError("TEMPLATE_NOT_FOUND", `Không tìm thấy mẫu: ${id}`, 404);
    this.templates.delete(id);
  }

  list() {
    return this.templates.listAll();
  }

  findById(id: string) {
    return this.templates.findById(id);
  }

  /** Render preview không lưu DB. Dùng cho TPL-002 live preview. */
  renderPreview(body: string, context: Record<string, unknown>, locale?: string): string {
    return renderPreview(body, context, locale ?? "vi-VN");
  }
}

function renderPreview(body: string, context: Record<string, unknown>, locale: string): string {
  const options: RenderOptions = { locale, unknownFallback: "" };
  return render(body, makeResolver(context), options);
}