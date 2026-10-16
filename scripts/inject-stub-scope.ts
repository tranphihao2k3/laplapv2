/**
 * Restore stub scope state để code reference vẫn valid, nhưng ép scope = "org"
 * và shops = []. TrustBadgesSettings/FooterSettings nhận shopId=null → dùng mode org.
 */
import * as fs from "fs";
import * as path from "path";

const file = path.join(process.cwd(), "src", "app", "quanly", "settings", "page.tsx");
let src = fs.readFileSync(file, "utf8");

const STUB = `  // Multi-shop removed: scope luôn là "org" vì chỉ có 1 cửa hàng.
  const [scope, setScope] = useState<"org" | "shop">("org");
  const scopeShopId: string | null = null;
  const setScopeShopId = (_v: string | null) => {};
  const shops: Array<{ id: string; name: string; code: string | null }> = [];
  const handleScopeChange = (v: string) => setScope(v as "org" | "shop");
`;

// Tìm các chỗ bắt đầu 1 function (SystemSettings, TrustBadgesSection, FooterSection)
// và inject STUB ngay sau `const qc = useQueryClient();` nếu có, hoặc sau dấu `{` đầu tiên.
const functionRegex = /(function (SystemSettings|TrustBadgesSection|FooterSection)\(\) \{\r\n)((?:  const qc = useQueryClient\(\);\r\n)?)/g;
src = src.replace(functionRegex, (_match, prefix, _name, qcLine) => {
  return prefix + qcLine + STUB;
});

fs.writeFileSync(file, src, "utf8");
console.log("Injected stub scope state into 3 sections");
