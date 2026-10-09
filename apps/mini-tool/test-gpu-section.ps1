# GPU section from PS_HARDWARE_SCRIPT - extracted and tested
$ErrorActionPreference = 'SilentlyContinue'

function Convert-AdapterRamToGB($bytes) {
  if (-not $bytes -or $bytes -le 0) { return 0 }
  $gb = $bytes / 1073741824.0
  if ($gb -lt 1) { return 0 }
  return [math]::Round($gb, 1)
}

function Get-GpuVramBytes($pnpDevId, $name, $vendor, $ram) {
  if ($pnpDevId) {
    $wql = @(Get-CimInstance -Namespace 'root\WMI' -Query "SELECT * FROM MSDisplay_Memory WHERE InstanceName LIKE '%$pnpDevId%'" -ErrorAction SilentlyContinue)
    foreach ($w in $wql) {
      if ($w.AllocatedMemory) { return [int64]$w.AllocatedMemory }
      if ($w.TurboMemoryAllocated) { return [int64]$w.TurboMemoryAllocated }
    }
  }
  # DirectX fallback
  try {
    $ds = New-Object System.Drawing.Design.ToolboxItem('Dummy')
  } catch {}
  $di = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
  foreach ($d in $di) {
    if ($ram -and $ram -gt 0) { return [int64]$ram }
  }
  return 0
}

Add-Type -ReferencedAssemblies System.Windows.Forms,System.Drawing @'
using System;using System.Runtime.InteropServices;
public class DispHlp{
    [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Auto)]public struct DEVMODE{public string dmDeviceName;public ushort dmSpecVersion,dmDriverVersion,dmSize,dmDriverExtra;public uint dmFields;
        public int dmPositionX,dmPositionY,dmDisplayOrientation,dmDisplayFixedOutput;public short dmColor,dmDuplex,dmYResolution,dmTTOption,dmCollate;public ushort dmFormSize,dmLogPixels,dmBitsPerPel,dmPelsWidth,dmPelsHeight;public uint dmDisplayFlags,dmDisplayFrequency,dmNup,dmPanningWidth,dmPanningHeight;}
    [DllImport("user32.dll",CharSet=CharSet.Auto,SetLastError=true)]static extern int ChangeDisplaySettings(ref DEVMODE devMode,uint flags);
    static extern int EnumDisplaySettings(string deviceName,int modeIndex,ref DEVMODE devMode);
    public static int GetMaxHz(string dev){DEVMODE d=new DEVMODE();d.dmSize=(ushort)Marshal.SizeOf(typeof(DEVMODE));int m=0,i=0;
        while(EnumDisplaySettings(dev,i++,ref d)!=0){if((int)d.dmPelsWidth>0&&(int)d.dmPelsHeight>0&&(int)d.dmDisplayFrequency>m)m=(int)d.dmDisplayFrequency;}return m;}
    public static string GetMaxRes(){DEVMODE d=new DEVMODE();d.dmSize=(ushort)Marshal.SizeOf(typeof(DEVMODE));int w=0,h=0,i=0;
        while(EnumDisplaySettings(null,i++,ref d)!=0){if((int)d.dmPelsWidth>w){w=(int)d.dmPelsWidth;h=(int)d.dmPelsHeight;}else if((int)d.dmPelsWidth==w&&(int)d.dmPelsHeight>h){h=(int)d.dmPelsHeight;}}return w+"x"+h;}
    public static int GetMaxHzAt(int w,int h){DEVMODE d=new DEVMODE();d.dmSize=(ushort)Marshal.SizeOf(typeof(DEVMODE));int mhz=0,i=0;
        while(EnumDisplaySettings(null,i++,ref d)!=0){int cw=(int)d.dmPelsWidth,ch=(int)d.dmPelsHeight,hz=(int)d.dmDisplayFrequency;if(cw==w&&ch==h&&hz>mhz)mhz=hz;}return mhz;}
    public static int GetMaxHzAll(){DEVMODE d=new DEVMODE();d.dmSize=(ushort)Marshal.SizeOf(typeof(DEVMODE));int i=0,mhz=0;
        while(EnumDisplaySettings(null,i++,ref d)!=0){int hz=(int)d.dmDisplayFrequency;if(hz>mhz)mhz=hz;}return mhz;}
}
'@

$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
if ($gpus.Count -eq 0) { Write-Output "[]"; exit }

Write-Host "Found $($gpus.Count) GPUs"

$list = New-Object System.Collections.Generic.List[object]

foreach ($g in $gpus) {
  Write-Host "Processing: $($g.Name)"
  $name = if ($g.Name) { $g.Name.Trim() } else { $null }
  $ram = $g.AdapterRAM
  $vramBytes = 0
  $pnpDevId = [string]$g.PNPDeviceID
  if ($pnpDevId) {
    $wql = @(Get-CimInstance -Namespace 'root\WMI' -Query "SELECT * FROM MSDisplay_Memory WHERE InstanceName LIKE '%$pnpDevId%'" -ErrorAction SilentlyContinue)
    foreach ($w in $wql) {
      if ($w.AllocatedMemory) { $vramBytes = [int64]$w.AllocatedMemory; break }
      if ($w.TurboMemoryAllocated) { $vramBytes = [int64]$w.TurboMemoryAllocated; break }
    }
  }
  if ($vramBytes -eq 0 -and $ram -and $ram -gt 0) { $vramBytes = [int64]$ram }
  $vramGB = if ($vramBytes -gt 0) { [math]::Round($vramBytes / 1073741824.0, 1) } else { 0 }
  $vramMb = [int][math]::Round($vramBytes / 1048576.0)

  Write-Host "  VRAM bytes: $vramBytes, GB: $vramGB, MB: $vramMb"

  # VRAM detection - try DirectX
  try {
    $dd = New-Object System.Drawing.Design.ToolboxItem('Dummy')
  } catch {}
  $adapters = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
  $dxVram = 0
  foreach ($ad in $adapters) {
    if ($ad.AdapterRAM -and $ad.AdapterRAM -gt $dxVram) { $dxVram = [int64]$ad.AdapterRAM }
  }
  if ($dxVram -gt 0) { $vramBytes = $dxVram; $vramGB = [math]::Round($dxVram / 1073741824.0, 1); $vramMb = [int][math]::Round($dxVram / 1048576.0) }
  Write-Host "  After DX fallback - VRAM bytes: $vramBytes, GB: $vramGB"

  # Driver
  $driverVer = if ($g.DriverVersion) { $g.DriverVersion.Trim() } else { $null }
  if (-not $driverVer) {
    if ($g.PNPDeviceID) {
      try {
        $key = "HKLM:\SYSTEM\CurrentControlSet\Enum\$($g.PNPDeviceID)\Driver"
        $drv = Get-ItemProperty $key -ErrorAction SilentlyContinue
        if ($drv) {
          $verKey = "HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}\$($drv.CurrentDriver)"
          $vprop = Get-ItemProperty $verKey -ErrorAction SilentlyContinue
          if ($vprop -and $vprop.DriverVersion) { $driverVer = $vprop.DriverVersion }
        }
      } catch {}
    }
  }
  Write-Host "  Driver: $driverVer"

  # Display resolution
  try {
    $scr = [DispHlp]::GetMaxRes()
    $maxRefreshAll = [DispHlp]::GetMaxHzAll()
    $maxRefreshAt = [DispHlp]::GetMaxHzAt(1920, 1080)
    Write-Host "  MaxRes: $scr, MaxRefresh: $maxRefreshAll, MaxRefreshAt1080p: $maxRefreshAt"
  } catch {
    Write-Host "  Display error: $_"
  }

  $list.Add(@{
    name = $name
    adapterRAMGB = $vramGB
    vramGb = $vramGB
    vramMb = $vramMb
    driverVersion = $driverVer
  }) | Out-Null
}

Write-Host ""
Write-Host "=== JSON ==="
@($list) | ConvertTo-Json -Depth 5
