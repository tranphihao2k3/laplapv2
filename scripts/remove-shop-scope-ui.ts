/**
 * Post-edit script: remove shop-scope UI from 3 settings sections.
 * Trong single-shop mode, không cần cho admin chọn scope theo shop.
 *
 * Idempotent: nếu code đã được clean trước đó, script no-op.
 */
import * as fs from "fs";
import * as path from "path";

const file = path.join(
  process.cwd(),
  "src",
  "app",
  "quanly",
  "settings",
  "page.tsx",
);
let src = fs.readFileSync(file, "utf8");

const BEFORE = src;

// 1) Replace the scope + shop query block. 3 sections cùng pattern.
const blockRegex =
  /  const \[scope, setScope\] = useState<[^>]+>\("org"\);\n  const \[scopeShopId, setScopeShopId\] = useState<string \| null>\(null\);\n\n  const shopsQ = useQuery\(\{\n    queryKey: \["settings-shops"\],\n    queryFn: \(\) => httpGet<Paginated<Shop>>\("\/v1\/shops", \{ page: 1, pageSize: 50 \}\),\n  \}\);\n  const shops = shopsQ\.data\?\.items \?\? \[\];\n\n  function handleScopeChange\(v: string\) \{\n    setScope\(v as "org" \| "shop"\);\n    if \(v === "shop" && shops\.length > 0\) \{\n      setScopeShopId\(shops\[0\]\.id\);\n    \} else \{\n      setScopeShopId\(null\);\n    \}\n  \}\n/g;

src = src.replace(blockRegex, "");

// 2) Replace scope UI: scope Select block. Match by `<Select value={scope} onValueChange={handleScopeChange}>`.
const scopeSelectRegex =
  /            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">\n              <div className="flex items-center gap-2">\n                <Label className="shrink-0">Phạm vi:<\/Label>\n                <Select value=\{scope\} onValueChange=\{handleScopeChange\}>\n                  <SelectTrigger className="w-full sm:w-44">\n                    <SelectValue \/>\n                  <\/SelectTrigger>\n                  <SelectContent>\n                    <SelectItem value="org">Toàn tổ chức<\/SelectItem>\n                    <SelectItem value="shop">Theo cửa hàng<\/SelectItem>\n                  <\/SelectContent>\n                <\/Select>\n              <\/div>\n              \{scope === "shop" && \(\n                <div className="flex items-center gap-2">\n                  <Label className="shrink-0">Cửa hàng:<\/Label>\n                  <Select value=\{scopeShopId \?\? ""\} onValueChange=\{setScopeShopId\}>\n                    <SelectTrigger className="w-full sm:w-56">\n                      <SelectValue placeholder="Chọn cửa hàng" \/>\n                    <\/SelectTrigger>\n                    <SelectContent>\n                      \{shops\.map\(\(s\) => \(\n                        <SelectItem key=\{s\.id\} value=\{s\.id\}>\n                          \{s\.name\} \(\{s\.code \?\? "—"\}\)\n                        <\/SelectItem>\n                      \)\)\}\n                    <\/SelectContent>\n                  <\/Select>\n                <\/div>\n              \)\}\n            <\/div>\n/g;

src = src.replace(scopeSelectRegex, "");

// 3) Remove "scope === \"shop\" && " guards (always false now, but tsc will complain)
src = src.replace(/ \|\| \(scope === "shop" && !scopeShopId\)/g, "");
src = src.replace(/disabled=\{upsert\.isPending \|\| \(scope === "shop" && !scopeShopId\)\}/g, "disabled={upsert.isPending}");
src = src.replace(/disabled=\{scope === "shop" && !scopeShopId\}/g, "");

if (src !== BEFORE) {
  fs.writeFileSync(file, src, "utf8");
  console.log("✅ Updated settings/page.tsx — removed shop scope UI");
} else {
  console.log("ℹ️ No changes applied (already clean?)");
}
