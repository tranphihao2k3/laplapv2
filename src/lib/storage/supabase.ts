/**
 * Supabase Storage — hiện chỉ còn TOOLS_BUCKET (private, signed URL).
 *
 * File audio đã chuyển sang ghi trực tiếp lên Fly Volume (mount /data/audio)
 * qua @/lib/storage/local. Public URL của audio do Next.js route
 * /api/v1/audio/[...key] phục vụ.
 *
 * LUONG UPLOAD (tools):
 *   1. Admin POST /api/v1/admin/tools/upload (multipart).
 *   2. Server upload file len Supabase Storage key 'tools/<id>/<version>/<file>'.
 *   3. Insert row vao table `tools` (ghi storage_path + sha256).
 *
 * LUONG DOWNLOAD (tools):
 *   Server proxy /api/v1/tools/download -> lay tool theo id -> Signed URL
 *   tu Supabase Storage -> redirect hoac stream body ve client.
 *   KHONG bao gio public Supabase Storage URL truc tiep cho tools.
 */
import { createAdminClient } from "@/lib/supabase/admin";

const TOOLS_BUCKET = "tools";

export interface UploadResult {
  path: string;
  size: number;
  publicUrl?: string;
}

/** Upload file tool (private bucket). */
export async function putToolFile(
  path: string,
  body: ArrayBuffer | Uint8Array | Blob,
  contentType?: string,
): Promise<UploadResult> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(TOOLS_BUCKET)
    .upload(path, body, {
      contentType: contentType ?? "application/octet-stream",
      upsert: false,
    });

  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);

  return {
    path: data.path,
    size: (body as ArrayBuffer).byteLength ?? 0,
  };
}

/** Lay Signed URL cho tool (private bucket, expire 60s). */
export async function getToolSignedUrl(path: string, expiresIn = 60): Promise<string> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(TOOLS_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
  return data.signedUrl;
}

/** Download tool file nhu ArrayBuffer (cho proxy stream). */
export async function downloadToolFile(path: string): Promise<ArrayBuffer> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(TOOLS_BUCKET)
    .download(path);

  if (error) throw new Error(`Failed to download tool: ${error.message}`);
  if (!data) throw new Error("Empty file body");

  return await data.arrayBuffer();
}

/** Lay metadata tool (size). */
export async function headToolFile(path: string): Promise<{ size: number } | null> {
  const supabase = createAdminClient();
  const list = await supabase.storage.from(TOOLS_BUCKET).list(path.split("/").slice(0, -1).join("/"), {
    search: path.split("/").pop(),
  });

  if (list.error || !list.data?.length) return null;
  const file = list.data[0];
  return { size: file.metadata?.size ?? 0 };
}

/** Xoa tool file. */
export async function deleteToolFile(path: string): Promise<void> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage.from(TOOLS_BUCKET).remove([path]);
  if (error) throw new Error(`Failed to delete tool: ${error.message}`);
}

/** Validate storage key (chi cho phep [a-z0-9/_-]). */
export function isValidStorageKey(key: string): boolean {
  return /^[a-z0-9/_\-.]{1,256}$/.test(key) && !key.includes("..");
}

/** Build tool key theo convention. */
export function buildToolKey(id: string, version: string | null, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const v = version ? version.replace(/[^a-z0-9._-]/gi, "") : "latest";
  return `tools/${id}/${v}/${safeName}`;
}

/** Compute SHA256 (Web Crypto API). */
export async function computeSha256(data: ArrayBuffer | Uint8Array): Promise<string> {
  const cryptoTarget = globalThis.crypto;
  if (!cryptoTarget?.subtle) throw new Error("SubtleCrypto unavailable");

  let buffer: ArrayBuffer;
  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else {
    // Copy ra ArrayBuffer rieng (subtle.digest can ArrayBuffer chinh xac).
    const view = new Uint8Array(data.byteLength);
    view.set(data);
    buffer = view.buffer;
  }

  const hash = await cryptoTarget.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
