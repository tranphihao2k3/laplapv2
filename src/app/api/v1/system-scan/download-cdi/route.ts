import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * Endpoint download CDI (CrystalDiskInfo) DLL — port sang Native DLL từ
 * `ftyszyx/CrystalDiskInfo_dll_lib` (MIT, base trên CrystalDiskInfo gốc).
 *
 * LUONG:
 *   1. Detect arch qua query `?arch=x64|x86` (default x64).
 *   2. Serve file `public/cdi/CDI_<arch>.dll` (đã được tải sẵn bằng
 *      scripts/download-cdi-dll.ps1).
 *   3. Verify magic bytes ("MZ").
 *
 * DLL export:
 *   CreateAtaSmart, DestroyAtaSmart, InitAtaSmart, GetDiskCount, GetDiskInfo,
 *   GetModel, GetSerialNumber, GetDrivemap, GetPhysicalDriveId,
 *   GetInterfaceType, GetDriveLettermap
 *
 * Chi chay duoc khi chay voi quyen Administrator (se goi IOCTL).
 */
const DLL_DIR = path.join(process.cwd(), "public", "cdi");

async function readDll(arch: "x64" | "x86"): Promise<Buffer | null> {
  const filename = arch === "x86" ? "CDI_x86.dll" : "CDI_x64.dll";
  const full = path.join(DLL_DIR, filename);
  try {
    return await readFile(full);
  } catch {
    return null;
  }
}

function isValidDll(buf: Buffer): boolean {
  return buf.length >= 64 && buf[0] === 0x4d && buf[1] === 0x5a;
}

export async function GET(req: NextRequest) {
  const archParam = (req.nextUrl.searchParams.get("arch") || "x64").toLowerCase();
  const arch: "x64" | "x86" = archParam === "x86" ? "x86" : "x64";

  const buf = await readDll(arch);
  if (!buf) {
    return NextResponse.json(
      {
        error: `CDI DLL not found for arch=${arch}`,
        path: path.join(DLL_DIR, arch === "x86" ? "CDI_x86.dll" : "CDI_x64.dll"),
        hint: "Run scripts/download-cdi-dll.ps1 to fetch DLLs from ftyszyx/CrystalDiskInfo_dll_lib v1.0.1",
      },
      { status: 404 },
    );
  }

  if (!isValidDll(buf)) {
    return NextResponse.json(
      { error: `CDI DLL for arch=${arch} is not a valid PE binary`, size: buf.length },
      { status: 502 },
    );
  }

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Length": String(buf.length),
      "Content-Disposition": `attachment; filename="CDI_${arch}.dll"`,
      "X-CDI-Arch": arch,
      "X-CDI-Source": "ftyszyx/CrystalDiskInfo_dll_lib@1.0.1",
      "Cache-Control": "public, max-age=604800, immutable",
    },
  });
}
