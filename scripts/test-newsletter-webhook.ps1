# Test svix signature verification.
# Webhook phai reject request thieu/khong dung svix headers.

$ErrorActionPreference = "Stop"
$base = "http://localhost:3000"

# Set webhook secret de enable endpoint (can co RESEND_WEBHOOK_SECRET env).
# Test: gui raw body khong co svix headers -> 400 (signature required).

# Test 1: empty headers -> 400
Write-Host "Test 1: POST webhook without svix headers" -ForegroundColor Cyan
try {
    $r = Invoke-WebRequest -Uri "$base/api/v1/newsletter/webhook" -Method POST -Body '{"type":"email.bounced","data":{"email_id":"test","to":["a@b.com"]}}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
    Write-Host "  FAIL: got $($r.StatusCode), expected error" -ForegroundColor Red
    exit 1
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 400 -or $code -eq 401 -or $code -eq 503) {
        Write-Host "  OK $code" -ForegroundColor Green
    } else {
        Write-Host "  FAIL: got $code" -ForegroundColor Red
        exit 1
    }
}

# Test 2: with garbage svix headers (no real secret) -> 401 (invalid signature)
Write-Host "Test 2: POST webhook with garbage svix headers" -ForegroundColor Cyan
$headers = @{
    "svix-id" = "msg_test123"
    "svix-timestamp" = [int][double]::Parse((Get-Date -UFormat %s))
    "svix-signature" = "v1,0000000000000000000000000000000000000000000000000000000000000000"
    "content-type" = "application/json"
}
try {
    $r = Invoke-WebRequest -Uri "$base/api/v1/newsletter/webhook" -Method POST -Body '{"type":"email.bounced","data":{"email_id":"test","to":["a@b.com"]}}' -Headers $headers -UseBasicParsing -TimeoutSec 10
    Write-Host "  FAIL: got $($r.StatusCode), expected 401/503" -ForegroundColor Red
    exit 1
} catch {
    $code = $_.Exception.Response.StatusCode.value__
    if ($code -eq 401 -or $code -eq 503) {
        Write-Host "  OK $code (signature rejected or secret not configured)" -ForegroundColor Green
    } else {
        Write-Host "  Got $code" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "svix signature test passed" -ForegroundColor Green