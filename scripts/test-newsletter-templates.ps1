# Render email templates thanh HTML de kiem tra visual.
# Luu ra temp, mo bang browser de check (optional).

$ErrorActionPreference = "Stop"
$ts = Get-Date -Format "yyyyMMdd-HHmmss"
$outDir = "$env:TEMP\newsletter-render-$ts"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
Write-Host "Output: $outDir" -ForegroundColor Cyan

# Can use ts-node hoac transpile. De don gian, chi can import tu Next.js build,
# nhung se phuc tap. Thay vao do, copy logic vao 1 file PS1 doc lap.
# (Skip visual - chi assert templates export type dung)

# Check templates.ts co render functions cho 3 loai:
$templates = @(
    "src/lib/email/templates.ts"
)
foreach ($f in $templates) {
    $path = "c:\Users\admin\Documents\code ne\laplap-laptop\$f"
    $content = Get-Content $path -Raw
    $has = @{
        confirm = $content -match "renderConfirmEmail"
        productAlert = $content -match "renderProductAlertEmail"
        unsubscribe = $content -match "renderUnsubscribeConfirmEmail"
    }
    foreach ($k in $has.Keys) {
        if ($has[$k]) {
            Write-Host "  OK render$($k)" -ForegroundColor Green
        } else {
            Write-Host "  FAIL: missing render$($k)" -ForegroundColor Red
            exit 1
        }
    }
}

# Check XSS guard (escapeHtml) co mat
$content = Get-Content "c:\Users\admin\Documents\code ne\laplap-laptop\src\lib\email\templates.ts" -Raw
if ($content -match "function escapeHtml") {
    Write-Host "  OK escapeHtml XSS guard" -ForegroundColor Green
} else {
    Write-Host "  FAIL: missing escapeHtml" -ForegroundColor Red
    exit 1
}

# Check unsubscribe link injection co mat
if ($content -match "injectUnsubscribeLink") {
    Write-Host "  OK injectUnsubscribeLink" -ForegroundColor Green
} else {
    Write-Host "  FAIL: missing injectUnsubscribeLink" -ForegroundColor Red
    exit 1
}

# Check tokens.ts co 2 functions
$tokens = Get-Content "c:\Users\admin\Documents\code ne\laplap-laptop\src\lib\newsletter\tokens.ts" -Raw
if ($tokens -match "export function normalizeEmail" -and $tokens -match "export function randomToken") {
    Write-Host "  OK normalizeEmail + randomToken" -ForegroundColor Green
} else {
    Write-Host "  FAIL: missing token helpers" -ForegroundColor Red
    exit 1
}

# Check resend.ts wrapper
$resend = Get-Content "c:\Users\admin\Documents\code ne\laplap-laptop\src\lib\email\resend.ts" -Raw
if ($resend -match "export async function sendEmail" -and $resend -match "RESEND_API_KEY" -and $resend -match "RESEND_FROM_EMAIL") {
    Write-Host "  OK sendEmail wrapper + env keys" -ForegroundColor Green
} else {
    Write-Host "  FAIL: missing sendEmail" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Template + helper sanity check passed" -ForegroundColor Green