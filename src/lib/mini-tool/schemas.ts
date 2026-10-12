/**
 * Zod schemas cho Mini Tool payload (xem MINI_TOOL_PLAN.md §5.2.3).
 *
 * `miniToolUploadBodySchema` parse body POST /api/v1/mini-tool/upload — cho
 * phép một số field alias (deviceId ↔ device_id) vì tool Electron phía Windows
 * viết camelCase nhưng server Supabase/REST thường gặp snake_case.
 *
 * NOTE: `passthrough()` chỉ áp dụng ở array items (tests) để không reject
 * payload khi schema payload phụ (speaker/mic/...) tiến hóa. Ở top-level vẫn
 * .strict() mặc định của zod để bắt typo.
 */
import { z } from "zod";

/** OS sub-shape — match §5.2.3 device.os */
const osSchema = z
  .object({
    name: z.string().nullish(),
    version: z.string().nullish(),
    build: z.string().nullish(),
    arch: z.string().nullish(),
    activated: z.boolean().nullish(),
  })
  .passthrough();

/** RAM module chi tiết (cho ram_slots_detail) */
const ramModuleSchema = z
  .object({
    sizeGb: z.number().nullish(),
    speedMhz: z.number().int().nullish(),
    type: z.string().nullish(),
    brand: z.string().nullish(),
    slot: z.number().int().nullish(),
  })
  .passthrough();

const cpuSchema = z
  .object({
    name: z.string().nullish(),
    cores: z.number().int().nullish(),
    threads: z.number().int().nullish(),
    baseGhz: z.number().nullish(),
    boostGhz: z.number().nullish(),
  })
  .passthrough();

const ramSchema = z
  .object({
    totalGb: z.number().nullish(),
    type: z.string().nullish(),
    speedMhz: z.number().int().nullish(),
    slots: z.number().int().nullish(),
    modules: z.array(ramModuleSchema).optional(),
  })
  .passthrough();

const storageDriveSchema = z
  .object({
    name: z.string().nullish(),
    type: z.string().nullish(),
    capacityGb: z.number().nullish(),
    healthPct: z.number().int().nullish(),
    smart: z.record(z.unknown()).nullish(),
  })
  .passthrough();

const gpuSchema = z
  .object({
    name: z.string().nullish(),
    vendor: z.string().nullish(),
    vramGb: z.number().nullish(),
    driverVersion: z.string().nullish(),
  })
  .passthrough();

const mainboardSchema = z
  .object({
    model: z.string().nullish(),
    biosVersion: z.string().nullish(),
  })
  .passthrough();

const batterySchema = z
  .object({
    designMwh: z.number().int().nullish(),
    fullMwh: z.number().int().nullish(),
    healthPct: z.number().nullish(),
    cycles: z.number().int().nullish(),
    voltageMv: z.number().int().nullish(),
  })
  .passthrough();

const networkSchema = z
  .object({
    mac: z.string().nullish(),
    ip: z.string().nullish(),
    wifi: z.string().nullish(),
  })
  .passthrough();

const hardwareSchema = z
  .object({
    cpu: cpuSchema.optional(),
    ram: ramSchema.optional(),
    storage: z.array(storageDriveSchema).optional(),
    gpu: z.array(gpuSchema).optional(),
    mainboard: mainboardSchema.optional(),
    battery: batterySchema.optional(),
    network: networkSchema.optional(),
  })
  .passthrough();

const benchmarkSchema = z
  .object({
    tool: z.string().nullish(),
    gpuScore: z.number().int().nullish(),
    fpsAvg: z.number().nullish(),
    testWidth: z.number().int().nullish(),
    testHeight: z.number().int().nullish(),
    testPreset: z.string().nullish(),
    duration: z.number().int().nullish(),
  })
  .passthrough();

/** Một test phụ (speaker, mic, camera, display, keyboard, wifi, ...) */
const testItemSchema = z
  .object({
    type: z.string().min(1),
    result: z.string().min(1),
    payload: z.record(z.unknown()).optional(),
    note: z.string().nullish(),
  })
  .passthrough();

/** Top-level payload mà tool build & gửi lên (trừ signature). */
export const miniToolPayloadSchema = z
  .object({
    payloadVersion: z.string().optional(),
    device: z
      .object({
        deviceId: z.string().nullish(),
        device_id: z.string().nullish(),
        deviceName: z.string().nullish(),
        device_name: z.string().nullish(),
        productSku: z.string().nullish(),
        product_sku: z.string().nullish(),
        serial: z
          .object({
            bios: z.string().nullish(),
            motherboard: z.string().nullish(),
          })
          .passthrough()
          .optional(),
        os: osSchema.optional(),
      })
      .passthrough(),
    hardware: hardwareSchema.optional(),
    benchmark: benchmarkSchema.optional(),
    tests: z.array(testItemSchema).optional(),
    /** Nonce random cho replay-protection — server check 24h window. */
    nonce: z.string().min(1).optional(),
  })
  .passthrough();

/** Body thực sự tool POST lên — có thêm signature ở top-level. */
export const miniToolUploadBodySchema = z
  .object({
    ...miniToolPayloadSchema.shape,
    signature: z.string().min(1, "Thiếu chữ ký HMAC"),
  })
  .passthrough();

export type MiniToolPayload = z.infer<typeof miniToolPayloadSchema>;
export type MiniToolUploadBody = z.infer<typeof miniToolUploadBodySchema>;
export type MiniToolTestItem = z.infer<typeof testItemSchema>;

/** Body cho POST /api/v1/mini-tool/sessions. */
export const createSessionBodySchema = z.object({
  redirectAfterUpload: z.string().startsWith("/").optional(),
  context: z.record(z.unknown()).optional(),
});
export type CreateSessionBody = z.infer<typeof createSessionBodySchema>;