$ErrorActionPreference = 'Stop'
$dest = Join-Path $PSScriptRoot '..\public\cdi'
$dest = [System.IO.Path]::GetFullPath($dest)
New-Item -ItemType Directory -Path $dest -Force | Out-Null

# Do PowerShell resolves aliases strangely, use full cmdlet names
$urls = @{
    'CDI_x64.rar' = 'https://github.com/ftyszyx/CrystalDiskInfo_dll_lib/releases/download/1.0.1/Releasex64.rar'
    'CDI_x86.rar' = 'https://github.com/ftyszyx/CrystalDiskInfo_dll_lib/releases/download/1.0.1/ReleaseWin32.rar'
}
foreach ($name in $urls.Keys) {
    $out = Join-Path $dest $name
    Write-Host "Downloading $name ..."
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    Invoke-WebRequest -Uri $urls[$name] -OutFile $out -UseBasicParsing -Headers @{"User-Agent"="Mozilla/5.0"} -TimeoutSec 90 -MaximumRedirection 5
    $size = (Get-Item $out).Length
    Write-Host "  -> $out ($size bytes)"
}
Write-Host "Done."
Get-ChildItem $dest | Format-Table Name, Length -AutoSize
