// ─────────────────────────────────────────────────────────────────────────────
// Type tối thiểu cho R2 binding dùng trong các route speaker-songs.
//
// Vì sao KHÔNG dùng `wrangler types` / @cloudflare/workers-types:
// hai cái đó khai báo lại global fetch/Response theo runtime Workers, khiến
// `res.json()` trả về `unknown` và làm vỡ ~50 chỗ dùng fetch sẵn có trong dự án.
// Ở đây chỉ khai báo đúng phần R2 đang cần, không chạm vào global nào khác.
//
// Tham khảo: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
// ─────────────────────────────────────────────────────────────────────────────

interface R2Object {
  key: string;
  size: number;
  etag: string;
  uploaded: Date;
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}

interface R2ObjectBody extends R2Object {
  body: ReadableStream;
  arrayBuffer(): Promise<ArrayBuffer>;
  text(): Promise<string>;
}

interface R2PutOptions {
  httpMetadata?: { contentType?: string; cacheControl?: string };
  customMetadata?: Record<string, string>;
}

declare interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream | string | null,
    options?: R2PutOptions,
  ): Promise<R2Object | null>;
  delete(keys: string | string[]): Promise<void>;
  head(key: string): Promise<R2Object | null>;
}
