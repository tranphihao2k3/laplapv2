/**
 * GroupService — GRP-001.
 *
 * Validate URL Facebook (docs §11 GRP-001):
 *   - URL phải là facebook.com/groups/<id>.
 *   - URL trùng/không hợp lệ bị chặn.
 *   - Delete có confirm (UI) — service không cascade xoá history job.
 *
 * Layer này KHÔNG truy cập FB; user tự thêm URL.
 */
import { randomUUID } from "node:crypto";
import { AppError } from "../../shared/errors";
import {
  FacebookGroupRepository,
  GroupSetRepository,
  normalizeFacebookGroupUrl,
} from "../db/repositories/facebook-groups";
import type { FacebookGroupRow, PostingMode } from "../../shared/db-types";

export type GroupInput = {
  name: string;
  url: string;
  enabled?: boolean;
  locale?: string | null;
  notes?: string | null;
  maxImages?: number;
  allowLink?: boolean;
  postingMode?: PostingMode;
};

const ALLOWED_POSTING_MODES: PostingMode[] = ["assisted", "auto"];

export class GroupService {
  constructor(
    private readonly groups: FacebookGroupRepository,
    private readonly sets: GroupSetRepository,
  ) {}

  /** Tạo group mới. Throw nếu URL trùng/không hợp lệ. */
  create(input: GroupInput): FacebookGroupRow {
    const normalizedUrl = normalizeFacebookGroupUrl(input.url);
    if (!normalizedUrl) {
      throw new AppError(
        "GROUP_BAD_URL",
        "URL không hợp lệ — chỉ chấp nhận facebook.com/groups/<id>",
        400,
      );
    }
    if (input.name.trim().length === 0) {
      throw new AppError("GROUP_NAME_REQUIRED", "Tên nhóm không được rỗng", 400);
    }
    if (input.postingMode && !ALLOWED_POSTING_MODES.includes(input.postingMode)) {
      throw new AppError("GROUP_BAD_POSTING_MODE", `postingMode không hợp lệ: ${input.postingMode}`, 400);
    }
    const existing = this.groups.findById(""); // no-op
    void existing;

    const id = randomUUID();
    const row: Omit<FacebookGroupRow, "created_at" | "updated_at"> = {
      id,
      name: input.name.trim(),
      url: normalizedUrl,
      enabled: input.enabled ?? true ? 1 : 0,
      locale: input.locale ?? null,
      notes: input.notes ?? null,
      max_images: input.maxImages ?? 10,
      allow_link: input.allowLink ?? true ? 1 : 0,
      posting_mode: input.postingMode ?? "assisted",
    };
    try {
      this.groups.insert(row);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("UNIQUE") && msg.includes("url")) {
        throw new AppError("GROUP_DUPLICATE_URL", `URL đã tồn tại: ${normalizedUrl}`, 409);
      }
      throw new AppError("GROUP_DB_ERROR", msg, 500);
    }
    return this.groups.findById(id) as FacebookGroupRow;
  }

  update(id: string, patch: Partial<GroupInput>): FacebookGroupRow {
    const existing = this.groups.findById(id);
    if (!existing) throw new AppError("GROUP_NOT_FOUND", `Không tìm thấy group: ${id}`, 404);

    const normalizedUrl =
      patch.url !== undefined ? normalizeFacebookGroupUrl(patch.url) : existing.url;
    if (patch.url !== undefined && !normalizedUrl) {
      throw new AppError(
        "GROUP_BAD_URL",
        "URL không hợp lệ — chỉ chấp nhận facebook.com/groups/<id>",
        400,
      );
    }
    if (patch.name !== undefined && patch.name.trim().length === 0) {
      throw new AppError("GROUP_NAME_REQUIRED", "Tên nhóm không được rỗng", 400);
    }
    if (patch.postingMode && !ALLOWED_POSTING_MODES.includes(patch.postingMode)) {
      throw new AppError("GROUP_BAD_POSTING_MODE", `postingMode không hợp lệ: ${patch.postingMode}`, 400);
    }

    this.groups.update(id, {
      name: patch.name?.trim() ?? existing.name,
      url: normalizedUrl,
      enabled: patch.enabled !== undefined ? (patch.enabled ? 1 : 0) : existing.enabled,
      locale: patch.locale !== undefined ? patch.locale : existing.locale,
      notes: patch.notes !== undefined ? patch.notes : existing.notes,
      max_images: patch.maxImages ?? existing.max_images,
      allow_link: patch.allowLink !== undefined ? (patch.allowLink ? 1 : 0) : existing.allow_link,
      posting_mode: patch.postingMode ?? existing.posting_mode,
    });
    return this.groups.findById(id) as FacebookGroupRow;
  }

  /** Soft chưa cần — GRP-001 chỉ yêu cầu delete không phá history. */
  delete(id: string): void {
    const existing = this.groups.findById(id);
    if (!existing) throw new AppError("GROUP_NOT_FOUND", `Không tìm thấy group: ${id}`, 404);
    // FK ON DELETE CASCADE sẽ xoá group_set_groups liên quan; KHÔNG xoá
    // post_jobs (đã thiết kế cascade NO ACTION ở schema, an toàn).
    this.groups.delete(id);
  }

  listAll() {
    return this.groups.listAll();
  }

  listEnabled() {
    return this.groups.listEnabled();
  }

  findById(id: string) {
    return this.groups.findById(id);
  }
}

/** Helper cho GRP-002 — tạo/sửa/xoá group set. */
export class GroupSetService {
  constructor(private readonly sets: GroupSetRepository) {}

  create(name: string): { id: string; name: string } {
    if (name.trim().length === 0) {
      throw new AppError("GROUP_SET_NAME_REQUIRED", "Tên tập nhóm không được rỗng", 400);
    }
    const id = randomUUID();
    this.sets.createSet(id, name.trim());
    return { id, name: name.trim() };
  }

  addMember(setId: string, groupId: string): void {
    this.sets.addToSet(setId, groupId);
  }

  removeMember(setId: string, groupId: string): void {
    this.sets.removeFromSet(setId, groupId);
  }

  list() {
    return this.sets.listSets();
  }

  members(setId: string) {
    return this.sets.listMembers(setId);
  }

  delete(setId: string): void {
    this.sets.deleteSet(setId);
  }
}