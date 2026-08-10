import { NextRequest } from "next/server";
import { SCANNER_PS1, SCANNER_BAT } from "@/lib/system-scan/scanner-template";

export const dynamic = "force-dynamic";

// Tao goi scanner mini (~20KB zip) - KHONG phu thuoc R2 hay filesystem.
// Template PowerShell duoc nhung inline trong bundle (`scanner-template.ts`)
// nen deploy Cloudflare Worker cung chay duoc.
//
// Token va API base duoc chen vao template, dong goi cung LapLap-Scanner.bat
// + README.txt -> tra ve 1 file zip cho user tai ve va chay.

type ZipEntry = {
  name: string;
  data: Buffer;
  mtime: Date;
};

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer: Buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date: Date) {
  const year = Math.max(1980, date.getFullYear());
  const dosTime =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    Math.floor(date.getSeconds() / 2);
  const dosDate =
    ((year - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();

  return { dosDate, dosTime };
}

function makeZip(entries: ZipEntry[]) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name.replace(/\\/g, "/"), "utf8");
    const { dosDate, dosTime } = dosDateTime(entry.mtime);
    const crc = crc32(entry.data);
    const size = entry.data.length;

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(dosTime, 10);
    localHeader.writeUInt16LE(dosDate, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(size, 18);
    localHeader.writeUInt32LE(size, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    localParts.push(localHeader, name, entry.data);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(dosTime, 12);
    centralHeader.writeUInt16LE(dosDate, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(size, 20);
    centralHeader.writeUInt32LE(size, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    centralParts.push(centralHeader, name);

    offset += localHeader.length + name.length + size;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}

function readme(apiBase: string, token: string) {
  return `LapLap Toolcheck (mini)
=======================

1. Giai nen file zip nay ra mot thu muc rieng.
2. Chay file LapLap-Scanner.bat (chi can DOUBLE-CLICK).
3. Cu so PowerShell se mo va scanner se:
   a. Download smartctl.exe (chi lan dau, ~5MB) tu server.
   b. Quet CPU, GPU, RAM, o cung (SMART chi tiet), pin, man hinh, WiFi.
   c. Gui ket qua ve trinh duyet.
4. Neu muon doc SMART chi tiet (wear level, reallocated sectors, NVMe health),
   phai chay voi quyen ADMIN:
   - Chuot phai vao "LapLap-Scanner.bat" -> "Run as administrator"
   - BAM YES tren UAC popup.
   - PS1 se tu phat hien admin va chay smartctl.exe.
5. Neu khong muon admin, scanner van chay binh thuong (chi thieu SMART chi tiet).

Server: ${apiBase}
Token : ${token}

Luu y:
- Lan dau smartctl se download tu server (~5MB), cache tai
  %LOCALAPPDATA%\\LapLap\\smartctl\\ (cac lan sau dung cache).
- smartctl chi chay duoi quyen admin nen can "Run as administrator".
- Neu gap canh bao "execution of scripts is disabled", nhan "Run once"
  hoac chay truc tiep lenh:
  powershell -NoProfile -ExecutionPolicy Bypass -File .\\laplap-toolcheck.ps1
`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  try {
    const apiBase = req.nextUrl.origin;
    // Chen token + api base vao template, KHONG can R2 / filesystem ngoai.
    const scannerScript = SCANNER_PS1
      .replaceAll("__API_BASE__", apiBase)
      .replaceAll("__SCAN_TOKEN__", token);

    const entries: ZipEntry[] = [
      {
        name: "LapLap-Scanner.bat",
        data: Buffer.from(SCANNER_BAT, "utf8"),
        mtime: new Date(),
      },
      {
        name: "laplap-toolcheck.ps1",
        data: Buffer.from(scannerScript, "utf8"),
        mtime: new Date(),
      },
      {
        name: "README.txt",
        data: Buffer.from(readme(apiBase, token), "utf8"),
        mtime: new Date(),
      },
    ];

    const zip = makeZip(entries);
    const safeToken = token.replace(/[^a-z0-9_-]/gi, "-");

    return new Response(zip, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="laplap-toolcheck-${safeToken}.zip"`,
        "Content-Length": String(zip.length),
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[system-scan/download]", error);
    return Response.json(
      { error: "Cannot build Toolcheck package" },
      { status: 500 },
    );
  }
}
