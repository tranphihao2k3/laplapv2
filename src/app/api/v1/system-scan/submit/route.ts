import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";

// In-memory cache for demo/simplified real-time data transfer
// Key: token, Value: scan data
if (!(global as any).scanResults) {
  (global as any).scanResults = new Map<string, any>();
}
const scanResults = (global as any).scanResults;

export async function POST(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const token = sp.get("token");
    if (!token) {
      return Response.json({ error: "Missing token" }, { status: 400 });
    }

    // Heartbeat ping (không có body): scanner báo đã kết nối và đang quét.
    // Không ghi đè kết quả "complete" nếu đã có.
    const phase = sp.get("status");
    if (phase === "scanning") {
      const existing = scanResults.get(token);
      if (!existing || existing.status !== "complete") {
        scanResults.set(token, { status: "scanning", timestamp: Date.now() });
      }
      return ok({ success: true });
    }

    const body = await req.json();
    scanResults.set(token, {
      status: "complete",
      data: body,
      timestamp: Date.now(),
    });

    return ok({ success: true });
  } catch (e) {
    return handleError(e);
  }
}
