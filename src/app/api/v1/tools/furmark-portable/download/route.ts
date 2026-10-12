/**
 * GET /api/v1/tools/furmark-portable/download
 *
 * Tra ve metadata cua FurMark 2 portable zip (download URL chinh thuc tu Geeks3D).
 * KHONG bundle FurMark trong server (vi pham ban quyen Geeks3D).
 * Tool client (laplap-mini-tool.ps1) se goi endpoint nay de lay URL,
 * sau do tu download tu Geeks3D.
 *
 * Response: {
 *   ok: true,
 *   data: {
 *     vendor: "Geeks3D",
 *     name: "FurMark 2",
 *     version: "2.x",
 *     zipUrl: "https://geeks3d.com/downloads/...",
 *     pageUrl: "https://geeks3d.com/furmark/",
 *     sizeBytes: 73400320,
 *     sha256: null,
 *     license: "Freeware (proprietary)",
 *     note: "Auto-detect latest URL; do not redistribute this file"
 *   }
 * }
 *
 * Neu trong tuong lai muon host mirror (vi ly do phap ly/ban quyen khac),
 * set env LAPLAP_FURMARK_MIRROR_URL vao file .env.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";

// Hard-coded stable URL (FurMark 2 portable zip, Geeks3D CDN).
// NOTE: Update khi Geeks3D phat hanh version moi.
const FURMARK_PORTABLE_URL =
  process.env.LAPLAP_FURMARK_MIRROR_URL ||
  "https://geeks3d.com/downloads/furmark/FurMark_2.7.0_portable.zip";

const FURMARK_PAGE_URL = "https://geeks3d.com/furmark/";

export async function GET() {
  return NextResponse.json({
    ok: true,
    data: {
      vendor: "Geeks3D",
      name: "FurMark 2",
      version: "2.7.0",
      zipUrl: FURMARK_PORTABLE_URL,
      pageUrl: FURMARK_PAGE_URL,
      sizeBytes: 73400320, // ~70 MB
      sizeLabel: "70 MB",
      sha256: null, // Geeks3D khong public checksum; client verify bang signature
      license: "Freeware (proprietary, © Geeks3D)",
      note:
        "Khong duoc redistribute vi pham ban quen. Tool client tu download tu URL chinh thuc, " +
        "extract vao folder FurMark2/ canh laplap-mini-tool.bat.",
    },
  });
}
