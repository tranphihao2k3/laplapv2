#requires -Version 5.1
<#
.SYNOPSIS
  Tat BitLocker tren o dia (mac dinh C:).

.DESCRIPTION
  Can QUYEN ADMIN. Neu khong co -> return error JSON (tool se tu elevate).
  Output JSON: { ok, drive, status } hoac { ok:false, error }.
#>
[CmdletBinding()]
param(
    [string]$Drive = 'C:'
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'SilentlyContinue'

function Write-ErrLine([string]$msg) {
    try { [Console]::Error.WriteLine($msg) } catch { Write-Host $msg }
}

function ConvertTo-JsonLine($obj) {
    try {
        if ($null -eq $obj) { return 'null' }
        return ($obj | ConvertTo-Json -Depth 10 -Compress)
    } catch {
        Write-ErrLine "[bitlocker] json-error: $($_.Exception.Message)"
        return '{"ok":false,"error":"json-serialize-failed"}'
    }
}

function Fail-Out([string]$msg) {
    $payload = @{ ok = $false; drive = $Drive; error = $msg }
    Write-ErrLine "[bitlocker] FAIL: $msg"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 1
}

try {
    # Normalize drive format -> "C:"
    $Drive = ($Drive -replace '[^A-Za-z:]', '').ToUpper()
    if ($Drive -notmatch '^[A-Z]:$') {
        $Drive = 'C:'
    }

    # Kiem tra admin
    $isAdmin = ([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Fail-Out 'Can quyen admin - chay lai voi Run as Administrator'
    }

    # Kiem tra manage-bde co ton tai (Home edition khong co BitLocker tool).
    $mbde = Get-Command manage-bde.exe -ErrorAction SilentlyContinue
    if (-not $mbde) {
        Fail-Out 'BitLocker khong kha dung tren Windows nay'
    }

    Write-ErrLine "[bitlocker] running: manage-bde -off $Drive (canh bao: se mat du lieu neu mat dien)"

    # Chay manage-bde. -off co the lau tren o lon. Timeout 30 phut.
    $output = & manage-bde.exe -off $Drive 2>&1
    $exitCode = $LASTEXITCODE
    $joined = ($output -join "`n")
    Write-ErrLine "[bitlocker] exit=$exitCode output-preview: $($joined.Substring(0, [Math]::Min(400, $joined.Length)))"

    # Parse status. "Conversion Status:" line ben canh co "Fully Decrypted" / "Decryption in Progress".
    $status = $null
    foreach ($line in $output) {
        if ($line -match 'Conversion Status:\s*(.+)') {
            $raw = $matches[1].Trim()
            if ($raw -match 'Fully Decrypted') {
                $status = 'Decrypted'
            } elseif ($raw -match 'Decryption in Progress|Decryption\s*Paused') {
                $status = 'DecryptionInProgress'
            } else {
                $status = $raw
            }
            break
        }
    }

    # Neu exitCode=0 va status rong -> fallback query manage-bde -status.
    if ($exitCode -eq 0 -and -not $status) {
        try {
            $statusOut = & manage-bde.exe -status $Drive 2>&1
            foreach ($line in $statusOut) {
                if ($line -match 'Conversion Status:\s*(.+)') {
                    $raw = $matches[1].Trim()
                    if ($raw -match 'Fully Decrypted') { $status = 'Decrypted' }
                    elseif ($raw -match 'Decryption in Progress|Decryption\s*Paused') { $status = 'DecryptionInProgress' }
                    else { $status = $raw }
                    break
                }
            }
        } catch {}
    }

    # Parse first useful error line (BitLocker messages can be long).
    $errMsg = ($output | Select-String -Pattern 'ERROR:|error:' -CaseSensitive:$false | Select-Object -First 1).ToString().Trim()
    if (-not $errMsg) { $errMsg = $joined.Substring(0, [Math]::Min(200, $joined.Length)) }
    if ($exitCode -ne 0) {
        Fail-Out "manage-bde exit=$exitCode. $errMsg"
    }

    $payload = @{
        ok     = $true
        drive  = $Drive
        status = if ($status) { $status } else { 'Unknown' }
    }
    Write-ErrLine "[bitlocker] done. drive=$Drive status=$status"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 0
}
catch {
    Fail-Out $_.Exception.Message
}
