#requires -Version 5.1
<#
.SYNOPSIS
  Don dep temp files (%TEMP%, %LOCALAPPDATA%\Temp, C:\Windows\Temp, Recycle Bin).

.DESCRIPTION
  Output JSON 1 dong: { ok, freedMb, actions[] }.
  Moi action wrap try/catch rieng -> fail 1 cho khong lam dung script.
  KHONG bao gio xoa Documents/Desktop.
#>
[CmdletBinding()]
param()

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
        Write-ErrLine "[cleanup] json-error: $($_.Exception.Message)"
        return '{"ok":false,"error":"json-serialize-failed"}'
    }
}

function Fail-Out([string]$msg) {
    $payload = @{ ok = $false; error = $msg; freedMb = 0; actions = @() }
    Write-ErrLine "[cleanup] FAIL: $msg"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 1
}

# Tinh tong bytes freed (gan dung qua Length cua cac file da delete).
function Remove-DirContents {
    param([string]$Path, [string]$Label)
    if (-not (Test-Path -LiteralPath $Path)) {
        Write-ErrLine "[cleanup] skip $Label (not found: $Path)"
        return 0
    }
    $bytes = 0
    try {
        $files = Get-ChildItem -LiteralPath $Path -Recurse -Force -File -ErrorAction SilentlyContinue
        foreach ($f in $files) {
            try { $bytes += [int64]$f.Length } catch {}
        }
        Get-ChildItem -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue |
            Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
        Write-ErrLine "[cleanup] cleared $Label ($([math]::Floor($bytes / 1MB)) MB)"
        return $bytes
    } catch {
        Write-ErrLine "[cleanup] clear $Label error: $($_.Exception.Message)"
        return $bytes
    }
}

try {
    Write-ErrLine "[cleanup] starting..."
    $actions = New-Object System.Collections.Generic.List[string]
    $totalBytes = 0

    # 1. User temp
    $tempUser = $env:TEMP
    if ($tempUser) {
        $b = Remove-DirContents -Path $tempUser -Label "user TEMP ($tempUser)"
        if ($b -gt 0) { $actions.Add('cleared user TEMP') | Out-Null; $totalBytes += $b }
    }

    # 2. LocalAppData\Temp
    $localTemp = Join-Path $env:LOCALAPPDATA 'Temp'
    if ($localTemp -and (Test-Path -LiteralPath $localTemp)) {
        $b = Remove-DirContents -Path $localTemp -Label "LocalAppData\Temp"
        if ($b -gt 0) { $actions.Add('cleared LocalAppData\\Temp') | Out-Null; $totalBytes += $b }
    }

    # 3. C:\Windows\Temp
    $winTemp = Join-Path $env:SystemRoot 'Temp'
    if ($winTemp -and (Test-Path -LiteralPath $winTemp)) {
        $b = Remove-DirContents -Path $winTemp -Label "Windows Temp"
        if ($b -gt 0) { $actions.Add('cleared Windows\\Temp') | Out-Null; $totalBytes += $b }
    }

    # 4. Recycle Bin
    try {
        # Clear-RecycleBin co san Win10/11. Force = khong hoi confirm.
        $rbErr = $null
        Clear-RecycleBin -Force -ErrorAction SilentlyContinue
        if ($?) {
            $actions.Add('empty recycle bin') | Out-Null
            Write-ErrLine "[cleanup] recycle bin cleared"
        } else {
            Write-ErrLine "[cleanup] recycle bin: Clear-RecycleBin returned false"
        }
    } catch {
        Write-ErrLine "[cleanup] recycle bin error: $($_.Exception.Message)"
    }

    $freedMb = [int]([math]::Floor($totalBytes / 1MB))

    $payload = @{
        ok      = $true
        freedMb = $freedMb
        actions = @($actions.ToArray())
    }
    Write-ErrLine "[cleanup] done. freed ~${freedMb} MB across $($actions.Count) actions"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 0
}
catch {
    Fail-Out $_.Exception.Message
}
