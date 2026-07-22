import { promises as fs } from "node:fs";
import path from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

async function collectFiles(dir: string, zipRoot: string): Promise<ZipEntry[]> {
  const dirents = await fs.readdir(dir, { withFileTypes: true });
  const entries: ZipEntry[] = [];

  for (const dirent of dirents) {
    const fullPath = path.join(dir, dirent.name);
    const zipPath = `${zipRoot}/${dirent.name}`.replace(/\\/g, "/");

    if (dirent.isDirectory()) {
      const childEntries = await collectFiles(fullPath, zipPath);
      entries.push(...childEntries);
      continue;
    }

    if (!dirent.isFile()) continue;

    const [data, stat] = await Promise.all([
      fs.readFile(fullPath),
      fs.stat(fullPath),
    ]);
    entries.push({ name: zipPath, data, mtime: stat.mtime });
  }

  return entries.sort((a, b) => a.name.localeCompare(b.name));
}

function scannerBat() {
  return `@echo off
chcp 65001 >nul
cd /d "%~dp0"
title LapLap Toolcheck Scanner
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0laplap-toolcheck.ps1"
echo.
echo Nhan phim bat ky de dong cua so...
pause >nul
`;
}

function readme(apiBase: string, token: string) {
  return `LapLap Toolcheck
================

1. Giai nen file zip nay ra mot thu muc rieng.
2. Chay file LapLap-Scanner.bat.
3. Scanner se quet cau hinh, gui ket qua ve web, sau do hien menu mo cac tool trong Toolcheck.

Server: ${apiBase}
Token : ${token}

Trong menu sau khi quet:
- Mo CrystalDiskInfo de xem suc khoe o cung.
- Chay FurMark benchmark tu ban FurMark di kem.
- Mo GPU-Z hoac BatteryMon khi can kiem tra chi tiet.
`;
}

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token")?.trim();
  if (!token) {
    return Response.json({ error: "Missing token" }, { status: 400 });
  }

  const root = process.cwd();
  const toolcheckDir = path.join(root, "Toolcheck");
  const scannerTemplatePath = path.join(root, "scripts", "laplap-toolcheck.ps1");
  const furmarkScriptPath = path.join(root, "public", "scripts", "furmark-benchmark.ps1");

  try {
    await fs.access(toolcheckDir);
    const apiBase = req.nextUrl.origin;
    const [toolEntries, scannerTemplate, furmarkScript] = await Promise.all([
      collectFiles(toolcheckDir, "Toolcheck"),
      fs.readFile(scannerTemplatePath, "utf8"),
      fs.readFile(furmarkScriptPath),
    ]);

    const scannerScript = scannerTemplate
      .replaceAll("__API_BASE__", apiBase)
      .replaceAll("__SCAN_TOKEN__", token);

    const entries: ZipEntry[] = [
      {
        name: "LapLap-Scanner.bat",
        data: Buffer.from(scannerBat(), "utf8"),
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
      {
        name: "scripts/furmark-benchmark.ps1",
        data: Buffer.from(furmarkScript),
        mtime: new Date(),
      },
      ...toolEntries,
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
