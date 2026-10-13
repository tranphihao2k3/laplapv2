# Batch update server callers to use *ForRequest helpers (multi-shop brand)
# Đổi:
#   await getStoreInfo()  →  await getStoreInfoForRequest()
#   await getStoreInfoCached()  →  await getStoreInfoCached(await getShopIdFromRequest())
#   await getBrandNameAsync()  →  await getBrandNameForRequest()
#   await getShopInfo()  →  await getShopInfoForRequest()
#
# Import thay thế: request-shop thay cho store-info / brand / shop-info (chỉ function, giữ type imports).

$ErrorActionPreference = 'Stop'
$root = "c:\Users\admin\Documents\code ne\laplap-laptop"
Set-Location $root

# Files cần update (server context). Loại trừ các file đã được update.
$files = @(
  "src\app\(client)\chinh-sach-bao-mat\page.tsx"
  "src\app\(client)\chinh-sach-doi-tra\page.tsx"
  "src\app\(client)\chinh-sach-giao-hang\page.tsx"
  "src\app\(client)\chinh-sach-thanh-toan\page.tsx"
  "src\app\(client)\chinh-sach-bao-hanh\page.tsx"
  "src\app\(client)\chinh-sach-giai-quyet-khieu-nai\page.tsx"
  "src\app\(client)\dieu-khoan-su-dung\page.tsx"
  "src\app\(client)\about\page.tsx"
  "src\app\(client)\contact\page.tsx"
  "src\app\(client)\dich-vu-sua-chua\page.tsx"
  "src\app\(client)\products\page.tsx"
  "src\app\(client)\products\[slug]\page.tsx"
  "src\app\(client)\cau-hoi-thuong-gap\page.tsx"
  "src\components\client\layout\client-footer.tsx"
  "src\components\shared\store-contact-info.tsx"
  "src\app\api\v1\contact\route.ts"
  "src\app\api\v1\newsletter\subscribe\route.ts"
  "src\app\api\v1\newsletter\resend-confirm\route.ts"
  "src\app\api\v1\newsletter\dispatch\route.ts"
  "src\app\api\v1\admin\newsletter\dispatch\route.ts"
)

foreach ($rel in $files) {
  $path = Join-Path $root $rel
  if (-not (Test-Path $path)) {
    Write-Host "SKIP (not found): $rel" -ForegroundColor Yellow
    continue
  }

  $original = Get-Content $path -Raw -Encoding utf8
  $new = $original

  # 1) Replace await getStoreInfo() → await getStoreInfoForRequest()
  #    Match với cả await trước. Dùng lookahead để tránh getStoreInfoCached / getStoreContact / getStoreInfoForRequest.
  $new = [regex]::Replace($new, 'await getStoreInfo\(\)', 'await getStoreInfoForRequest()')

  # 2) Replace await getBrandNameAsync() → await getBrandNameForRequest()
  $new = [regex]::Replace($new, 'await getBrandNameAsync\(\)', 'await getBrandNameForRequest()')

  # 3) Replace await getShopInfo() → await getShopInfoForRequest()
  $new = [regex]::Replace($new, 'await getShopInfo\(\)', 'await getShopInfoForRequest()')

  # 4) Replace getStoreInfoCached() → truyền shopId (giữ ở local API thì gọi trực tiếp helper)
  #    File src/app/api/public/store-info/route.ts đã update rồi (không nằm trong list này).

  # 5) Đổi import:
  #    import { getStoreInfo } from "@/lib/store-info"; → import { getStoreInfoForRequest } from "@/lib/request-shop";
  #    Chỉ replace khi import chỉ có function (không có type nào).
  $new = [regex]::Replace(
    $new,
    [regex]::Escape('import { getStoreInfo } from "@/lib/store-info";'),
    'import { getStoreInfoForRequest } from "@/lib/request-shop";'
  )

  $new = [regex]::Replace(
    $new,
    [regex]::Escape('import { getBrandNameAsync } from "@/lib/brand";'),
    'import { getBrandNameForRequest } from "@/lib/request-shop";'
  )

  $new = [regex]::Replace(
    $new,
    [regex]::Escape('import { getShopInfo } from "@/lib/shop-info";'),
    'import { getShopInfoForRequest } from "@/lib/request-shop";'
  )

  if ($new -ne $original) {
    Set-Content -Path $path -Value $new -Encoding utf8 -NoNewline
    Write-Host "UPDATED: $rel" -ForegroundColor Green
  } else {
    Write-Host "UNCHANGED: $rel" -ForegroundColor DarkGray
  }
}

Write-Host "`nDone." -ForegroundColor Cyan
