/**
 * SecretScanner — SEC-001.
 *
 * Quét text/JSON để phát hiện secret lộ:
 *  - service_role key (Supabase prefix `sb_secret_`, `service_role`).
 *  - access/refresh token dạng JWT (3 phần base64url ngăn bởi `.`).
 *  - Authorization header có Bearer.
 *  - cookie c_user/xs/fr/datr/sb.
 *  - password=... trong URL.
 *
 * Trả { clean, findings[] } để script kiểm tra.
 */
import { promises as fs } from "node:fs";
import path from "node:path";

export type Finding = {
  rule: string;
  match: string;
  file?: string;
};

export type ScanResult = {
  clean: boolean;
  findings: Finding[];
};

const PATTERNS: Array<{ rule: string; re: RegExp }> = [
  { rule: "supabase-service-role-key", re: /sb_secret_[A-Za-z0-9_-]{20,}/g },
  { rule: "jwt-token", re: /eyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g },
  { rule: "auth-bearer", re: /Authorization:\s*Bearer\s+[A-Za-z0-9._-]{16,}/gi },
  { rule: "cookie-cuser", re: /c_user=[A-Za-z0-9]{5,}/g },
  { rule: "cookie-xs", re: /xs=[A-Za-z0-9]{20,}/g },
  { rule: "cookie-fr", re: /fr=[A-Za-z0-9]{20,}/g },
  { rule: "cookie-datr", re: /datr=[A-Za-z0-9]{20,}/g },
  { rule: "cookie-sb", re: /sb=[A-Za-z0-9]{20,}/g },
  { rule: "password-url", re: /[?&]password=[^&\s]{4,}/gi },
];

/**
 * Scan text nội dung (file hoặc buffer). `file` chỉ để hiển thị trong
 * findings.
 */
export function scanText(input: string, file?: string): ScanResult {
  const findings: Finding[] = [];
  for (const { rule, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(input)) !== null) {
      findings.push({ rule, match: m[0].slice(0, 40), file });
    }
  }
  return { clean: findings.length === 0, findings };
}

/**
 * Quét toàn bộ file .ts/.json/.md dưới rootPath. Bỏ qua node_modules,
 * release, out, dist, .git.
 */
export async function scanDirectory(rootPath: string): Promise<ScanResult> {
  const all: Finding[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name === "node_modules" || entry.name.startsWith(".git")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (["release", "out", "dist", ".electron-vite"].includes(entry.name)) continue;
        await walk(full);
      } else if (/\.(ts|tsx|js|json|md|txt|env|log)$/.test(entry.name)) {
        const content = await fs.readFile(full, "utf8").catch(() => "");
        const r = scanText(content, full);
        all.push(...r.findings);
      }
    }
  }
  await walk(rootPath);
  return { clean: all.length === 0, findings: all };
}