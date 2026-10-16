import * as fs from "fs";
import * as path from "path";

const file = path.join(process.cwd(), "src", "app", "quanly", "settings", "page.tsx");
let src = fs.readFileSync(file, "utf8");

// Remove scope state + shopId state + shopsQ query + handleScopeChange (same as before but applied to remaining 3 sections)
const patterns = [
  // scope state + shopId state
  /  const \[scope, setScope\] = useState<[^>]+>\("org"\);\r\n  const \[scopeShopId, setScopeShopId\] = useState<string \| null>\(null\);\r\n/g,
  // shopsQ block
  /  const shopsQ = useQuery\(\{\r\n    queryKey: \["settings-shops"\],\r\n    queryFn: \(\) => httpGet<Paginated<Shop>>\("\/v1\/shops", \{ page: 1, pageSize: 50 \}\),\r\n  \}\);\r\n  const shops = shopsQ\.data\?\.items \?\? \[\];\r\n/g,
  // handleScopeChange
  /  function handleScopeChange\(v: string\) \{\r\n    setScope\(v as "org" \| "shop"\);\r\n    if \(v === "shop" && shops\.length > 0\) \{\r\n      setScopeShopId\(shops\[0\]\.id\);\r\n    \} else \{\r\n      setScopeShopId\(null\);\r\n    \}\r\n  \}\r\n/g,
];

for (const re of patterns) {
  src = src.replace(re, "");
}

fs.writeFileSync(file, src, "utf8");
console.log("Done. File size:", src.length);
