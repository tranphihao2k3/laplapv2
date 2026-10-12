/**
 * Test HMAC canonical JSON khớp giữa PowerShell và TypeScript.
 *
 * Cách chạy:
 *   1. Từ PowerShell, chạy file này:
 *        Invoke-RestMethod -Method POST -Uri "http://localhost:3000/api/v1/mini-tool/test-canonical" `
 *                           -ContentType "application/json" `
 *                           -Body '{"sample":"value"}'
 *   2. Copy response.expected_canonical về PowerShell, so sánh với ConvertTo-CanonicalJson
 *
 * Hoặc tự chạy nhanh:
 *   node scripts/test-mini-tool-canonical.mjs
 *
 * Script này KHÔNG phụ thuộc vào PS2EXE hay PowerShell — chỉ verify TS implementation
 * cho đúng rồi publish 1 test endpoint để bên PS đối chiếu.
 */

const express = (() => {
  // Mini Node check: chỉ cần chạy được từ Node 18+
  return null;
})();

import { canonicalJson, DEV_FALLBACK_SHARED_SECRET } from "../src/lib/mini-tool/signature.ts";

// Test cases — các object PS sẽ gặp trong thực tế
const testCases = [
  {
    name: "simple",
    input: { a: 1, b: "two", c: true, d: null },
  },
  {
    name: "nested",
    input: {
      device: { id: "PC-1", name: "Laptop" },
      hardware: { cpu: { name: "i7", cores: 8 }, ram: { totalGb: 16 } },
    },
  },
  {
    name: "array",
    input: { tags: ["a", "b", "c"], scores: [1, 2, 3] },
  },
  {
    name: "realistic-payload",
    input: {
      payloadVersion: "mini-tool-v1",
      nonce: "abc-123",
      device: { deviceId: "PC-001", os: { name: "Windows 11", arch: "x64" } },
      hardware: {
        cpu: { name: "Intel Core i7-12700H", cores: 14, threads: 20, baseGhz: 2.3 },
        ram: { totalGb: 16, type: "DDR4", speedMhz: 3200 },
        storage: [
          { name: "WD SN850", type: "NVMe SSD", capacityGb: 512 },
        ],
        gpu: [{ name: "RTX 3050", vendor: "NVIDIA", vramGb: 4 }],
      },
      benchmark: { tool: "FurMark 2", gpuScore: 5109, fpsAvg: 43.5, duration: 300 },
      tests: [],
    },
  },
  {
    name: "edge-unicode",
    input: { name: "Cày test \u00e0 \u0111\u01b0\u1ee3c \u4e2d", note: "Pin: 90% • CPU: i7" },
  },
  {
    name: "edge-empty",
    input: {},
  },
  {
    name: "edge-boolean-false",
    input: { isCompleted: false, count: 0, msg: "" },
  },
];

console.log("=== Mini Tool Canonical JSON Test ===\n");
for (const tc of testCases) {
  const got = canonicalJson(tc.input);
  console.log(`[${tc.name}]`);
  console.log(`  input :`, JSON.stringify(tc.input));
  console.log(`  output:`, got);
  console.log();
}

// Print hmac signature for "realistic-payload" — server can verify
import { createHmac } from "node:crypto";
const realPayload = testCases.find((t) => t.name === "realistic-payload").input;
const canonical = canonicalJson(realPayload);
const sig = createHmac("sha256", DEV_FALLBACK_SHARED_SECRET).update(canonical).digest("hex");
console.log("=== HMAC Test Vector ===");
console.log("payload:           ", canonical);
console.log("secret:            ", DEV_FALLBACK_SHARED_SECRET);
console.log("expected signature:", sig);
console.log("\nPowerShell can verify by running:");
console.log(`
$payload = @{
  payloadVersion = "mini-tool-v1"
  ...
}
$secret = "${DEV_FALLBACK_SHARED_SECRET}"
$canonical = ConvertTo-CanonicalJson $payload
$hmac = New-Object System.Security.Cryptography.HMACSHA256
$hmac.Key = [Text.Encoding]::UTF8.GetBytes($secret)
$bytes = [Text.Encoding]::UTF8.GetBytes($canonical)
$hash = $hmac.ComputeHash($bytes)
$sig = ([BitConverter]::ToString($hash) -replace '-','').ToLower()
Write-Host "PS sig: $sig"
`);
