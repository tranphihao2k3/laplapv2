import { NextRequest } from "next/server";
import { ok, handleError } from "@/lib/api/response";

// Use the same global-backed Map as the submit route. Reading global on each
// request (not at module load) avoids capturing a stale/empty Map if this
// module is initialized before submit creates global.scanResults.
if (!(global as any).scanResults) {
  (global as any).scanResults = new Map<string, any>();
}

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const token = sp.get("token");
    if (!token) {
      return Response.json({ error: "Missing token" }, { status: 400 });
    }

    const scanResults = (global as any).scanResults;
    const result = scanResults.get(token);
    if (!result) {
      return ok({ status: "waiting" });
    }

    return ok(result);
  } catch (e) {
    return handleError(e);
  }
}
