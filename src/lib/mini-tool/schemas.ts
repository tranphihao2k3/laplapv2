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
    name: z.string().optional().nullable(),
    version: z.string().optional().nullable(),
    build: z.string().optional().nullable(),
    arch: z.string().optional().nullable(),
    activated: z.boolean().optional().nullable(),
  })
  .passthrough();

/** RAM module chi tiết (cho ram_slots_detail) */
const ramModuleSchema = z
  .object({
    sizeGb: z.number().optional(),
    speedMhz: z.number().optional(),
    type: z.string().optional().nullable(),
    brand: z.string().optional().nullable(),
    slot: z.number().int().optional(),
  })
  .passthrough();

const cpuSchema = z
  .object({
    name: z.string().optional().nullable(),
    cores: z.number().int().optional(),
    threads: z.number().int().optional(),
    baseGhz: z.number().optional(),
    boostGhz: z.number().optional(),
  })
  .passthrough();

const ramSchema = z
  .object({
    totalGb: z.number().optional(),
    type: z.string().optional().nullable(),
    speedMhz: z.number().int().optional(),
    slots: z.number().int().optional(),
    modules: z.array(ramModuleSchema).optional(),
  })
  .passthrough();

const storageDriveSchema = z
  .object({
    name: z.string().optional().nullable(),
    type: z.string().optional().nullable(),
    capacityGb: z.number().optional(),
    healthPct: z.number().int().optional(),
    smart: z.record(z.unknown()).optional().nullable(),
  })
  .passthrough();

const gpuSchema = z
  .object({
    name: z.string().optional().nullable(),
    vendor: z.string().optional().nullable(),
    vramGb: z.number().optional(),
    driverVersion: z.string().optional().nullable(),
  })
  .passthrough();

const mainboardSchema = z
  .object({
    model: z.string().optional().nullable(),
    biosVersion: z.string().optional().nullable(),
  })
  .passthrough();

const batterySchema = z
  .object({
    designMwh: z.number().int().optional(),
    fullMwh: z.number().int().optional(),
    healthPct: z.number().optional(),
    cycles: z.number().int().optional(),
    voltageMv: z.number().int().optional(),
  })
  .passthrough();

const networkSchema = z
  .object({
    mac: z.string().optional().nullable(),
    ip: z.string().optional().nullable(),
    wifi: z.string().optional().nullable(),
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
    tool: z.string().optional().nullable(),
    gpuScore: z.number().int().optional(),
    fpsAvg: z.number().optional(),
    testWidth: z.number().int().optional(),
    testHeight: z.number().int().optional(),
    testPreset: z.string().optional().nullable(),
    duration: z.number().int().optional(),
  })
  .passthrough();

/** Một test phụ (speaker, mic, camera, display, keyboard, wifi, ...) */
const testItemSchema = z
  .object({
    type: z.string().min(1),
    result: z.string().min(1),
    payload: z.record(z.unknown()).optional(),
    note: z.string().optional().nullable(),
  })
  .passthrough();

/** Top-level payload mà tool build & gửi lên (trừ signature). */
export const miniToolPayloadSchema = z
  .object({
    payloadVersion: z.string().optional(),
    device: z
      .object({
        deviceId: z.string().optional(),
        device_id: z.string().optional(),
        deviceName: z.string().optional(),
        device_name: z.string().optional(),
        productSku: z.string().optional(),
        product_sku: z.string().optional(),
        serial: z
          .object({
            bios: z.string().optional().nullable(),
            motherboard: z.string().optional().nullable(),
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