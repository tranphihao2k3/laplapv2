/**
 * R2 helpers cho tool storage.
 *
 * Bucket: 'laplap-tools' (binding TOOLS_BUCKET).
 * Worker lay binding qua getCloudflareContext().
 *
 * LUONG UPLOAD:
 *   1. Admin POST /api/v1/admin/tools/upload (multipart).
 *   2. Server put file vao R2 key 'tools/<id>/<version>/<file>'.
 *   3. Insert row vao table `tools` (ghi r2_key + sha256).
 *
 * LUONG DOWNLOAD:
 *   Server proxy /api/v1/tools/download -> lay tool theo id -> lay
 *   R2 object -> stream body ve client. KHONG bao gio public R2 URL.
 */

import { getCloudflareContext } from "@opennextjs/cloudflare";

/** Minimal R2 type (de TS khong complain khi workers-types chua co). */
type R2Bucket = {
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | string,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<{
    size: number;
    etag?: string;
    httpMetadata?: { contentType?: string };
  } | null>;
  get(key: string): Promise<{
    body: ReadableStream;
    size: number;
    httpMetadata?: { contentType?: string };
  } | null>;
  head(key: string): Promise<{
    size: number;
    httpMetadata?: { contentType?: string };
  } | null>;
  delete(key: string): Promise<void>;
  list(options?: { prefix?: string }): Promise<{
    objects: Array<{ key: string; size: number }>;
  }>;
};

type R2Binding = {
  TOOLS_BUCKET?: R2Bucket;
};

async function getBucket(): Promise<R2Bucket | null> {
  try {
    const ctx = await getCloudflareContext({ async: true }) as unknown as { env: R2Binding };
    return ctx?.env?.TOOLS_BUCKET ?? null;
  } catch {
    return null;
  }
}

/** Upload file len R2. Tra ve size (bytes) thuc te. */
export async function putToolFile(
  key: string,
  body: ReadableStream | ArrayBuffer,
  contentType?: string,
): Promise<{ size: number; etag?: string }> {
  const bucket = await getBucket();
  if (!bucket) throw new Error("R2 TOOLS_BUCKET not available");

  const opts = contentType ? { httpMetadata: { contentType } } : undefined;
  const obj = await bucket.put(key, body as never, opts);
  if (!obj) throw new Error("R2 put failed");
  return { size: obj.size, etag: obj.etag };
}

/** Lay R2 object (download). */
export async function getToolFile(key: string): Promise<{
  body: ReadableStream;
  size: number;
  httpMetadata?: { contentType?: string };
} | null> {
  const bucket = await getBucket();
  if (!bucket) throw new Error("R2 TOOLS_BUCKET not available");
  const obj = await bucket.get(key);
  return obj ?? null;
}

/** Lay metadata R2 object (head). */
export async function headToolFile(key: string): Promise<{
  size: number;
  httpMetadata?: { contentType?: string };
} | null> {
  const bucket = await getBucket();
  if (!bucket) throw new Error("R2 TOOLS_BUCKET not available");
  return (await bucket.head(key)) ?? null;
}

/** Xoa R2 file. */
export async function deleteToolFile(key: string): Promise<void> {
  const bucket = await getBucket();
  if (!bucket) throw new Error("R2 TOOLS_BUCKET not available");
  await bucket.delete(key);
}

/**
 * Compute SHA256 cua R2 file (stream hash).
 * Luu y: R2 khong co API lay hash truc tiep, nen download-on-the-fly.
 * De hieu qua, nen tinh hash luc upload (tren server) va luu vao DB.
 *
 * Stream SHA256 implementation (Web Crypto API).
 */
export async function computeSha256(
  data: ArrayBuffer | ReadableStream<Uint8Array>,
): Promise<string> {
  const cryptoTarget = globalThis.crypto;
  if (!cryptoTarget?.subtle) throw new Error("SubtleCrypto unavailable");

  let buffer: ArrayBuffer;
  if (data instanceof ArrayBuffer) {
    buffer = data;
  } else {
    // Stream -> concat thanh Uint8Array.
    const reader = data.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      total += value.length;
    }
    const concat = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      concat.set(c, offset);
      offset += c.length;
    }
    // Copy ra ArrayBuffer rieng (subtle.digest can ArrayBuffer chinh xac).
    buffer = concat.buffer.slice(concat.byteOffset, concat.byteOffset + concat.byteLength);
  }

  const hash = await cryptoTarget.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Validate R2 key (chi cho phep [a-z0-9/_-]). */
export function isValidR2Key(key: string): boolean {
  return /^[a-z0-9/_\-.]{1,256}$/.test(key) && !key.includes("..");
}

/** Build R2 key theo convention. */
export function buildToolKey(id: string, version: string | null, filename: string): string {
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const v = version ? version.replace(/[^a-z0-9._-]/gi, "") : "latest";
  return `tools/${id}/${v}/${safeName}`;
}
