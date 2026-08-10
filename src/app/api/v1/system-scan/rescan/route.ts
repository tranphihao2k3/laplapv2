/**
 * POST /api/v1/system-scan/rescan?token=X
 *
 * User bam "Quet lai" tren web (KHONG can tai zip moi) → web goi endpoint
 * nay → server set command "rescan" vao queue → scanner (dang chay o BG
 * polling command-poll moi 3s) nhan command → chay lai scan script →
 * submit lai JSON → web nhan qua poll va update UI.
 *
 * Yeu cau: scanner BAT phai dang chay o background (user KHONG dong cua so
 * PowerShell sau khi scan xong). Neu dong, bat buoc tai lai zip.
 */
import { NextRequest } from "next/server";
import { ok, fail } from "@/lib/api/response";
import { commandQueue } from "@/lib/tools/command-queue";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");
  if (!token) return fail("MISSING_TOKEN", "Missing token", 400);

  // Set status "rescan_requested" de user biet scanner se chay lai som.
  // Neu scanner KHONG con song (PS1 dong cua so), poll se stale sau 30s
  // → UI canh bao user mo lai .bat.
  try {
    const supabase = createSupabaseServiceClient();
    const now = new Date().toISOString();
    await supabase
      .from("system_scan_results")
      .upsert(
        { token, status: "rescan_requested", updated_at: now },
        { onConflict: "token" },
      );
  } catch {
    // Supabase loi → van set command queue (web van hoat dong).
  }

  // Set command "rescan" — scanner se chay lai scan script.
  // KHONG can toolId nhu launch-tool, nen dung gia tri dac biet "rescan".
  commandQueue.set(token, {
    action: "rescan",
    toolId: "rescan",
    toolName: "Re-scan system",
    downloadUrl: "",
    sha256: "",
    exec: "",
    args: [],
    extract: false,
    requiresAdmin: false,
    issuedAt: Date.now(),
  });

  return ok({ queued: true, action: "rescan" });
}