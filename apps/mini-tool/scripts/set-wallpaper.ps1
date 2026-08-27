#requires -Version 5.1
<#
.SYNOPSIS
  Doi wallpaper qua registry + SystemParametersInfo (P/Invoke).

.DESCRIPTION
  Set:
    HKCU:\Control Panel\Desktop\Wallpaper  -> -ImagePath
    TileWallpaper = 0
    WallpaperStyle = 10  (fill)
  Sau do goi SystemParametersInfo SPI_SETDESKWALLPAPER voi
    SPIF_UPDATEINIFILE | SPIF_SENDCHANGE de Windows apply ngay.
  Validate: file ton tai + la image (.jpg/.jpeg/.png/.bmp).
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)]
    [string]$ImagePath
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

function Write-ErrLine([string]$msg) {
    try { [Console]::Error.WriteLine($msg) } catch { Write-Host $msg }
}

function ConvertTo-JsonLine($obj) {
    try {
        if ($null -eq $obj) { return 'null' }
        return ($obj | ConvertTo-Json -Depth 10 -Compress)
    } catch {
        Write-ErrLine "[wallpaper] json-error: $($_.Exception.Message)"
        return '{"ok":false,"error":"json-serialize-failed"}'
    }
}

function Fail-Out([string]$msg) {
    $payload = @{ ok = $false; path = $ImagePath; error = $msg }
    Write-ErrLine "[wallpaper] FAIL: $msg"
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 1
}

try {
    # Validate path ton tai
    if (-not (Test-Path -LiteralPath $ImagePath)) {
        Fail-Out "File khong ton tai: $ImagePath"
    }
    if (-not (Test-Path -LiteralPath $ImagePath -PathType Leaf)) {
        Fail-Out "Duong dan phai la file, khong phai thu muc: $ImagePath"
    }

    # Validate extension image
    $ext = [System.IO.Path]::GetExtension($ImagePath).ToLower()
    if ($ext -notin @('.jpg', '.jpeg', '.png', '.bmp', '.webp')) {
        Fail-Out "Dinh dang khong ho tro: $ext (chi .jpg/.jpeg/.png/.bmp/.webp)"
    }

    # Resolve full path (PSScriptRoot/relative -> absolute)
    $fullPath = [System.IO.Path]::GetFullPath($ImagePath)

    Write-ErrLine "[wallpaper] setting: $fullPath"

    # 1. Set registry (HKCU)
    $desktopKey = 'HKCU:\Control Panel\Desktop'
    if (-not (Test-Path -LiteralPath $desktopKey)) {
        Fail-Out "Registry key khong ton tai: $desktopKey"
    }
    Set-ItemProperty -LiteralPath $desktopKey -Name 'Wallpaper' -Value $fullPath -Force
    Set-ItemProperty -LiteralPath $desktopKey -Name 'TileWallpaper' -Value '0' -Force
    Set-ItemProperty -LiteralPath $desktopKey -Name 'WallpaperStyle' -Value '10' -Force

    # 2. P/Invoke SystemParametersInfo(SPI_SETDESKWALLPAPER)
    Add-Type -Namespace Win32 -Name Native -MemberDefinition @"
[DllImport("user32.dll", CharSet = CharSet.Unicode)]
public static extern int SystemParametersInfo(
    uint uiAction,
    uint uiParam,
    string pvParam,
    uint fWinIni);

public const uint SPI_SETDESKWALLPAPER = 0x0014;
public const uint SPIF_UPDATEINIFILE  = 0x01;
public const uint SPIF_SENDCHANGE     = 0x02;
"@ -ErrorAction Stop

    $flags = [Win32.Native]::SPIF_UPDATEINIFILE -bor [Win32.Native]::SPIF_SENDCHANGE
    $ret = [Win32.Native]::SystemParametersInfo(
        [Win32.Native]::SPI_SETDESKWALLPAPER,
        0,
        $fullPath,
        $flags
    )
    if ($ret -eq 0) {
        # That bai - co the do duong dan khong hop le (vd: co dau cach, unicode).
        # Van set registry thanh cong nhung Windows khong refresh.
        Write-ErrLine "[wallpaper] SystemParametersInfo returned 0 (Windows might not refresh, but registry is set)"
    } else {
        Write-ErrLine "[wallpaper] SystemParametersInfo OK"
    }

    $payload = @{
        ok   = $true
        path = $fullPath
    }
    [Console]::Out.WriteLine((ConvertTo-JsonLine $payload))
    exit 0
}
catch {
    Fail-Out $_.Exception.Message
}
