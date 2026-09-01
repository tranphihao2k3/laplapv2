import { NextRequest, NextResponse } from "next/server";
import {
  buildTestAudioBuffer,
  TEST_AUDIO_KINDS,
  type TestAudioKind,
} from "@/lib/test-audio";

// Force dynamic so the response is generated per request — but the body is
// deterministic, so we cache aggressively via Cache-Control.
export const dynamic = "force-dynamic";

function isKind(value: string): value is TestAudioKind {
  return (TEST_AUDIO_KINDS as readonly string[]).includes(value);
}

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ type: string }> },
) {
  const { type } = await context.params;
  if (!type || !isKind(type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `Invalid type "${type}". Supported: ${TEST_AUDIO_KINDS.join(", ")}`,
      },
      { status: 400 },
    );
  }

  const wav = buildTestAudioBuffer(type);
  // Copy into a fresh ArrayBuffer-backed Uint8Array to avoid Node Buffer
  // being interpreted as a Latin-1 string by NextResponse/undici.
  const ab = new ArrayBuffer(wav.byteLength);
  new Uint8Array(ab).set(wav);
  return new NextResponse(ab, {
    status: 200,
    headers: {
      "Content-Type": "audio/wav",
      "Content-Length": String(ab.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
      "Accept-Ranges": "bytes",
    },
  });
}