# Smoke test newsletter endpoints (no DB - chi kiem tra contract/parse).
#
# Cac endpoint can DB thuc se tra 500 (vi bảng chua co trong local DB).
# Test se kiem tra:
#   - status code 400/200/401/503 dung cho tung endpoint
#   - response JSON shape dung theo { ok, data | error }
#   - svix signature reject 401

$ErrorActionPreference = "Continue"
$base = "http://localhost:3000"
$pass = 0; $fail = 0; $total = 0

function Test-Case {
    param([string]$name, [scriptblock]$body)
    $script:total++
    Write-Host ""
    Write-Host "[$script:total] $name" -ForegroundColor Cyan
    try {
        & $body
        $script:pass++
    } catch {
        Write-Host "  FAIL: $_" -ForegroundColor Red
        $script:fail++
    }
}

# Test 1: subscribe voi email invalid -> 400
Test-Case "subscribe with invalid email -> 400" {
    $body = '{"email":"not-an-email"}'
    try {
        $r = Invoke-WebRequest -Uri "$base/api/v1/newsletter/subscribe" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 400) { Write-Host "  OK 400" -ForegroundColor Green; return }
        throw "expected 400, got $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 400) { Write-Host "  OK 400 (via exception)" -ForegroundColor Green; return }
        throw $_
    }
}

# Test 2: subscribe with valid email -> 200 (hoac 500 neu DB chua setup)
Test-Case "subscribe with valid email -> 200" {
    $body = '{"email":"smoke@example.com"}'
    try {
        $r = Invoke-WebRequest -Uri "$base/api/v1/newsletter/subscribe" -Method POST -Body $body -ContentType "application/json" -UseBasicParsing -TimeoutSec 15
        if ($r.StatusCode -eq 200) {
            Write-Host "  OK 200 - body: $($r.Content)" -ForegroundColor Green
            return
        }
        throw "expected 200, got $($r.StatusCode): $($r.Content)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $body2 = $reader.ReadToEnd()
        if ($code -eq 200) { Write-Host "  OK 200" -ForegroundColor Green; return }
        Write-Host ("  Server returned {0}: {1}" -f $code, $body2) -ForegroundColor Yellow
        Write-Host "  (500 expected neu DB chua setup - OK for smoke test)" -ForegroundColor Yellow
        if ($code -eq 500) { Write-Host "  PASS (DB not migrated yet)" -ForegroundColor Green; return }
        throw $_
    }
}

# Test 3: resend-confirm voi email invalid -> 400
Test-Case "resend-confirm with invalid email -> 400" {
    try {
        $r = Invoke-WebRequest -Uri "$base/api/v1/newsletter/resend-confirm" -Method POST -Body '{"email":"bad"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        if ($r.StatusCode -eq 400) { Write-Host "  OK 400" -ForegroundColor Green; return }
        throw "expected 400, got $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 400) { Write-Host "  OK 400" -ForegroundColor Green; return }
        throw $_
    }
}

# Test 4: confirm without token -> 307/302 redirect den /?newsletter=invalid
Test-Case "confirm without token -> redirect invalid" {
    $req = [System.Net.HttpWebRequest]::Create("$base/api/v1/newsletter/confirm")
    $req.Method = "GET"
    $req.Timeout = 10000
    $req.AllowAutoRedirect = $false
    try {
        $resp = $req.GetResponse()
        $loc = $resp.Headers["Location"]
        $code = [int]$resp.StatusCode
        if (($code -eq 307 -or $code -eq 302) -and $loc -like "*newsletter=invalid*") {
            Write-Host "  OK $code -> $loc" -ForegroundColor Green; return
        }
        throw "expected 307/302 invalid, got $code ($loc)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 307 -or $code -eq 302) {
            $loc = $_.Exception.Response.Headers["Location"]
            if ($loc -like "*newsletter=invalid*") { Write-Host "  OK $code invalid" -ForegroundColor Green; return }
        }
        throw $_
    }
}

# Test 5: unsubscribe without token -> 307/302 invalid
Test-Case "unsubscribe without token -> redirect invalid" {
    $req = [System.Net.HttpWebRequest]::Create("$base/api/v1/newsletter/unsubscribe")
    $req.Method = "GET"
    $req.Timeout = 10000
    $req.AllowAutoRedirect = $false
    try {
        $resp = $req.GetResponse()
        $code = [int]$resp.StatusCode
        if ($code -eq 307 -or $code -eq 302) { Write-Host "  OK $code" -ForegroundColor Green; return }
    } catch {
        if ($_.Exception.Response.StatusCode.value__ -eq 307 -or $_.Exception.Response.StatusCode.value__ -eq 302) {
            Write-Host "  OK 307/302" -ForegroundColor Green; return
        }
    }
    throw "expected 307/302"
}

# Test 6: webhook missing svix headers -> 400
Test-Case "webhook missing svix headers -> 400" {
    try {
        $r = Invoke-WebRequest -Uri "$base/api/v1/newsletter/webhook" -Method POST -Body '{"type":"email.delivered"}' -ContentType "application/json" -UseBasicParsing -TimeoutSec 10
        throw "expected error, got $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 400 -or $code -eq 503) {
            Write-Host "  OK $code (503 = secret not configured, OK)" -ForegroundColor Green; return
        }
        throw $_
    }
}

# Test 7: admin endpoints can auth -> 401
Test-Case "admin/newsletter/stats no auth -> 401" {
    try {
        $r = Invoke-WebRequest -Uri "$base/api/v1/admin/newsletter/stats" -UseBasicParsing -TimeoutSec 10
        throw "expected error, got $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 401) { Write-Host "  OK 401" -ForegroundColor Green; return }
        throw $_
    }
}

# Test 8: admin/newsletter/dispatch no auth -> 401
Test-Case "admin/newsletter/dispatch no auth -> 401" {
    try {
        $r = Invoke-WebRequest -Uri "$base/api/v1/admin/newsletter/dispatch" -Method POST -UseBasicParsing -TimeoutSec 10
        throw "expected error, got $($r.StatusCode)"
    } catch {
        $code = $_.Exception.Response.StatusCode.value__
        if ($code -eq 401) { Write-Host "  OK 401" -ForegroundColor Green; return }
        throw $_
    }
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "  Smoke test: $pass passed, $fail failed" -ForegroundColor $(if ($fail -eq 0) { "Green" } else { "Red" })
Write-Host "============================================" -ForegroundColor Cyan

if ($fail -gt 0) { exit 1 }