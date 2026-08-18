/**
 * POST /api/v1/mini-tool/upload?sid=X
 *
 * Tool gửi payload + HMAC signature lên web để:
 *   1. Verify session còn hạn, chưa consumed
 *   2. Verify HMAC chống tamper
 *   3. Check nonce chưa dùng trong 24h
 *   4. Rate-limit per-sid
 *   5. Upsert `laptops` + `laptop_specs` + (optional) `gpu_benchmarks`
 *   6. Insert `mini_tool_uploads` (raw payload + sig + nonce + score + os_info)
 *   7. Insert `hardware_test_results` cho từng test
 *   8. Mark session consumed → return redirectUrl
 *
 * Plan tham chiếu: MINI_TOOL_PLAN.md §5.2.3.
 */
import { NextRequest } from "next/server";
import { ok, handleError, ApiError } from "@/lib/api/response";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { verifySession, markSessionConsumed } from "@/lib/mini-tool/session";
import { verifySignature, checkNonceReplay, rateLimitUpload } from "@/lib/mini-tool/signature";
import { miniToolUploadBodySchema } from "@/lib/mini-tool/schemas";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SID_RE = /^[a-f0-9]{32}$/i;
const MAX_BODY_BYTES = 256 * 1024; // 256KB (xem plan §5.2.4 PAYLOAD_TOO_LARGE)

function calcGpuRank(score: number): string {
  if (score >= 8000) return "Excellent";
  if (score >= 6000) return "Good";
  if (score >= 4000) return "Fair";
  return "Poor";
}

/** Pick `a ?? b ?? null`-like normalize trước khi insert vào DB (text). */
function pickStr(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    if (typeof c === "string" && c.length > 0) return c;
  }
  return null;
}

function pickNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (typeof c === "number" && Number.isFinite(c)) return c;
    if (typeof c === "string" && c.length > 0 && !Number.isNaN(Number(c))) {
      return Number(c);
    }
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    // 1) sid hợp lệ
    const sid = req.nextUrl.searchParams.get("sid")?.trim() ?? "";
    if (!SID_RE.test(sid)) {
      throw new ApiError("INVALID_SID", "sid phải là 32 ký tự hex", 400);
    }

    // 2) Size guard (256KB)
    const contentLength = req.headers.get("content-length");
    if (contentLength && Number(contentLength) > MAX_BODY_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", "Payload > 256KB", 413);
    }
    const rawText = await req.text();
    if (rawText.length > MAX_BODY_BYTES) {
      throw new ApiError("PAYLOAD_TOO_LARGE", "Payload > 256KB", 413);
    }

    // 3) Parse body (zod)
    let jsonBody: unknown;
    try {
      jsonBody = JSON.parse(rawText);
    } catch {
      throw new ApiError("INVALID_BODY", "Body không phải JSON hợp lệ", 400);
    }
    const parsed = miniToolUploadBodySchema.safeParse(jsonBody);
    if (!parsed.success) {
      throw new ApiError(
        "INVALID_BODY",
        "Payload không đúng schema",
        422,
      );
    }
    const body = parsed.data;
    if (body.payloadVersion && body.payloadVersion !== "mini-tool-v1") {
      throw new ApiError(
        "INVALID_VERSION",
        `payloadVersion "${body.payloadVersion}" không được hỗ trợ`,
        400,
      );
    }

    // 4) Verify session (sid còn hạn, chưa consumed)
    const session = await verifySession(sid);
    if (!session.valid) {
      throw new ApiError("SESSION_NOT_FOUND", "Session không hợp lệ", 404);
    }

    // 5) Verify HMAC (trên payload đã bỏ `signature`)
    const { signature, ...payloadNoSig } = body;
    verifySignature(payloadNoSig, signature);

    // 6) Nonce replay check
    if (payloadNoSig.nonce) {
      await checkNonceReplay(payloadNoSig.nonce);
    }

    // 7) Rate limit per-sid
    rateLimitUpload(sid);

    // 8) Save: upsert laptop + specs + (optional) benchmark + upload + tests
    const supabase = createSupabaseServiceClient();

    const deviceId =
      pickStr(payloadNoSig.device?.deviceId, payloadNoSig.device?.device_id) ?? "unknown-device";
    const deviceName =
      pickStr(
        payloadNoSig.device?.deviceName,
        payloadNoSig.device?.device_name,
      ) ?? deviceId;

    // 8a) upsert laptops
    const { data: existingLaptop } = await supabase
      .from("laptops")
      .select("id")
      .eq("device_id", deviceId)
      .maybeSingle();

    let laptopId: string;
    if (existingLaptop?.id) {
      laptopId = existingLaptop.id as string;
      await supabase
        .from("laptops")
        .update({ device_name: deviceName })
        .eq("id", laptopId);
    } else {
      const { data: newLaptop, error: insErr } = await supabase
        .from("laptops")
        .insert({ device_id: deviceId, device_name: deviceName })
        .select("id")
        .single();
      if (insErr) throw insErr;
      laptopId = newLaptop.id as string;
    }

    // 8b) upsert laptop_specs
    const hw = payloadNoSig.hardware ?? {};
    const cpu = (hw.cpu ?? {}) as Record<string, unknown>;
    const ram = (hw.ram ?? {}) as Record<string, unknown>;
    const battery = (hw.battery ?? {}) as Record<string, unknown>;
    const mb = (hw.mainboard ?? {}) as Record<string, unknown>;
    const network = (hw.network ?? {}) as Record<string, unknown>;
    const gpuList = Array.isArray(hw.gpu) ? hw.gpu : [];
    const gpu0 = gpuList[0] as Record<string, unknown> | undefined;
    const storageList = Array.isArray(hw.storage) ? hw.storage : [];
    const storage0 = storageList[0] as Record<string, unknown> | undefined;
    const osInfo = (payloadNoSig.device?.os ?? {}) as Record<string, unknown>;
    const serialInfo = (payloadNoSig.device?.serial ?? {}) as Record<string, unknown>;

    const specsPayload = {
      laptop_id: laptopId,
      cpu_name: pickStr(cpu.name),
      cpu_cores: pickNum(cpu.cores),
      cpu_threads: pickNum(cpu.threads),
      cpu_base_ghz: pickNum(cpu.baseGhz),
      ram_gb: pickNum(ram.totalGb),
      ram_brand: pickStr(ram.brand),
      ram_speed_mhz: pickNum(ram.speedMhz),
      ram_type: pickStr(ram.type),
      ram_slots: pickNum(ram.slots),
      ram_slots_detail: Array.isArray(ram.modules) ? ram.modules : null,
      storage_brand: pickStr(storage0?.name),
      storage_type: pickStr(storage0?.type),
      storage_gb: pickNum(storage0?.capacityGb),
      storage_drives: storageList.length > 0 ? storageList : null,
      storage_health_pct: pickNum(storage0?.healthPct),
      gpu_name: pickStr(gpu0?.name),
      gpu_vendor: pickStr(gpu0?.vendor),
      gpu_vram_gb: pickNum(gpu0?.vramGb),
      gpu_driver_version: pickStr(gpu0?.driverVersion),
      mainboard: pickStr(mb.model),
      bios_version: pickStr(mb.biosVersion, osInfo.build /* fallback nếu tool nhầm */),
      bios_serial: pickStr(serialInfo.bios),
      motherboard_serial: pickStr(serialInfo.motherboard),
      product_sku:
        pickStr((payloadNoSig.device as Record<string, unknown> | undefined)?.productSku) ??
        pickStr((payloadNoSig.device as Record<string, unknown> | undefined)?.product_sku),
      battery_design_mwh: pickNum(battery.designMwh),
      battery_full_mwh: pickNum(battery.fullMwh),
      battery_health: pickNum(battery.healthPct),
      battery_cycles: pickNum(battery.cycles),
      os_name: pickStr(osInfo.name),
      os_version: pickStr(osInfo.version),
      os_edition: pickStr(osInfo.edition),
      os_build: pickStr(osInfo.build),
      os_arch: pickStr(osInfo.arch),
      os_activated:
        typeof osInfo.activated === "boolean" ? (osInfo.activated as boolean) : null,
      network_macs: network.mac ? [network] : null,
      wifi_adapter: pickStr(network.wifi),
    };

    const { data: existingSpecs } = await supabase
      .from("laptop_specs")
      .select("id")
      .eq("laptop_id", laptopId)
      .maybeSingle();

    let specsUpdated = false;
    if (existingSpecs?.id) {
      const { error: upErr } = await supabase
        .from("laptop_specs")
        .update(specsPayload)
        .eq("id", existingSpecs.id);
      if (upErr) throw upErr;
      specsUpdated = true;
    } else {
      const { error: insErr } = await supabase
        .from("laptop_specs")
        .insert(specsPayload);
      if (insErr) throw insErr;
      specsUpdated = true;
    }

    // 8c) optional benchmark
    const bench = (payloadNoSig.benchmark ?? {}) as Record<string, unknown>;
    const gpuScore = pickNum(bench.gpuScore);
    let benchmarkId: string | null = null;
    let gpuRank: string | null = null;
    if (gpuScore !== null && gpuScore > 0) {
      gpuRank = calcGpuRank(gpuScore);
      const { data: bm, error: bmErr } = await supabase
        .from("gpu_benchmarks")
        .insert({
          laptop_id: laptopId,
          gpu_score: gpuScore,
          gpu_rank: gpuRank,
          fps_avg: pickNum(bench.fpsAvg),
          benchmark_tool: pickStr(bench.tool),
          test_width: pickNum(bench.testWidth),
          test_height: pickNum(bench.testHeight),
          test_preset: pickStr(bench.testPreset),
          test_duration_seconds: pickNum(bench.duration),
        })
        .select("id")
        .single();
      if (bmErr) throw bmErr;
      benchmarkId = (bm as { id: string }).id;
    }

    // 8d) chèn mini_tool_uploads
    const sourceIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      null;

    const { data: uploadRow, error: upErr } = await supabase
      .from("mini_tool_uploads")
      .insert({
        session_id: sid,
        device_id: deviceId,
        device_name: deviceName,
        payload: payloadNoSig as unknown as Record<string, unknown>,
        signature,
        gpu_score: gpuScore,
        status: "processed",
        os_info: payloadNoSig.device?.os ?? null,
        source_ip: sourceIp,
        laptop_id: laptopId,
      })
      .select("id")
      .single();
    if (upErr) throw upErr;
    const uploadId = (uploadRow as { id: string }).id;

    // 8e) chèn hardware_test_results
    const tests = Array.isArray(payloadNoSig.tests) ? payloadNoSig.tests : [];
    let testResultsSaved = 0;
    if (tests.length > 0) {
      const rows = tests
        .filter((t) => typeof t.type === "string" && typeof t.result === "string")
        .map((t) => ({
          upload_id: uploadId,
          laptop_id: laptopId,
          test_type: t.type as string,
          result: t.result as string,
          payload: (t.payload as Record<string, unknown> | undefined) ?? {},
          note: typeof t.note === "string" ? t.note : null,
        }));
      if (rows.length > 0) {
        const { error: tErr } = await supabase
          .from("hardware_test_results")
          .insert(rows);
        if (tErr) throw tErr;
        testResultsSaved = rows.length;
      }
    }

    // 9) Mark session consumed (sau khi mọi thứ OK)
    await markSessionConsumed(sid, { laptopId });

    // 10) Build redirectUrl giống pattern /system-scan/submit
    const proto = req.headers.get("x-forwarded-proto") ?? req.nextUrl.protocol.replace(":", "");
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? req.nextUrl.host;
    const rank = gpuRank ?? "Pending";
    const redirectUrl = `${proto}://${host}/test-laptop?highlight=${encodeURIComponent(laptopId)}&rank=${encodeURIComponent(rank)}`;

    return ok(
      {
        uploadId,
        laptopId,
        redirectUrl,
        saved: {
          specsUpdated,
          benchmarkId,
          testResultsSaved,
        },
      },
      { status: 201 },
    );
  } catch (e) {
    return handleError(e);
  }
}