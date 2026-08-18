#requires -Version 5.1
<#
.SYNOPSIS
  Doi ten may tinh qua Rename-Computer.

.DESCRIPTION
  Can QUYEN ADMIN. Neu khong co -> return error JSON.
  Ten moi phai: khong rong, <=15 ky tu (NetBIOS limit), chi [A-Za-z0-9-].
  Restart moi co hieu luc (RestartRequired = true luon).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$NewName
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
        Write-ErrLine "[rename-pc] json-error: $($_.Exception.Message)"
        return '{"ok":false,"error":"json-serialize-failed"}'
    }
}

function Fail-Out([string]$msg) {
    $payload = @{ ok = $false; newName = $NewName; error = $msg }
    Write-ErrLine "[rename-pc] FAIL: $msg"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 1
}

try {
    # Validate NewName
    $cleanName = $NewName.Trim()
    if ([string]::IsNullOrWhiteSpace($cleanName)) {
        Fail-Out 'Ten may khong duoc rong'
    }
    if ($cleanName.Length -gt 15) {
        Fail-Out 'Ten may qua dai (toi da 15 ky tu NetBIOS)'
    }
    if ($cleanName -notmatch '^[A-Za-z0-9\-]+$') {
        Fail-Out 'Ten may chi duoc chua [A-Za-z0-9-], khong co khoang trang/ky tu dac biet'
    }
    if ($cleanName -match '^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$') {
        Fail-Out 'Ten may trung voi ten reserved cua Windows'
    }

    # Check admin
    $isAdmin = ([Security.Principal.WindowsPrincipal]([Security.Principal.WindowsIdentity]::GetCurrent())).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    if (-not $isAdmin) {
        Fail-Out 'Can quyen admin - chay lai voi Run as Administrator'
    }

    # Kiem tra ten moi co khac ten hien tai khong
    try {
        $current = (Get-CimInstance Win32_ComputerSystem -ErrorAction SilentlyContinue).Name
        if ($current -and $current -eq $cleanName) {
            $payload = @{
                ok             = $true
                newName        = $cleanName
                restartRequired = $true
                note           = 'Ten giong ten hien tai'
            }
            Write-ErrLine "[rename-pc] name unchanged, skip rename"
            [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
            exit 0
        }
    } catch {}

    Write-ErrLine "[rename-pc] Rename-Computer -NewName $cleanName"
    Rename-Computer -NewName $cleanName -Force -ErrorAction Stop
    Write-ErrLine "[rename-pc] success, restart required"

    $payload = @{
        ok              = $true
        newName         = $cleanName
        restartRequired = $true
    }
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 0
}
catch {
    Fail-Out $_.Exception.Message
}
