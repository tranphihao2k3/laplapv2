import { randomBytes } from "node:crypto";

export interface UploadPayloadInput {
  hardware?: unknown;
  benchmark?: unknown;
  tests?: unknown;
}

export interface MiniToolUploadPayload {
  payloadVersion: "mini-tool-v1";
  nonce: string;
  capturedAt: string;
  hardware?: unknown;
  benchmark?: unknown;
  tests?: unknown;
}

export function buildUploadPayload(input: UploadPayloadInput): MiniToolUploadPayload {
  return {
    payloadVersion: "mini-tool-v1",
    nonce: randomBytes(16).toString("hex"),
    capturedAt: new Date().toISOString(),
    hardware: input.hardware,
    benchmark: input.benchmark,
    tests: input.tests,
  };
}

export async function uploadToServer(args: {
  sid: string;
  uploadUrl: string;
  body: unknown;
}): Promise<unknown> {
  const sep = args.uploadUrl.includes("?") ? "&" : "?";
  const url = args.uploadUrl.includes("sid=")
    ? args.uploadUrl
    : `${args.uploadUrl}${sep}sid=${encodeURIComponent(args.sid)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(args.body),
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  if (!res.ok) {
    throw new Error(
      `Upload failed (${res.status} ${res.statusText}): ${typeof json === "string" ? json : JSON.stringify(json)}`,
    );
  }
  return json;
}