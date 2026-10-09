# GPU debug script
$ErrorActionPreference = 'SilentlyContinue'

$gpus = @(Get-CimInstance Win32_VideoController -ErrorAction SilentlyContinue)
if ($gpus.Count -eq 0) {
  Write-Host "No GPU found"
  exit
}

foreach ($g in $gpus) {
  Write-Host "=== GPU ==="
  Write-Host "Name: $($g.Name)"
  Write-Host "AdapterRAM: $($g.AdapterRAM)"
  Write-Host "DriverVersion: $($g.DriverVersion)"
  Write-Host "DriverDate: $($g.DriverDate)"
  Write-Host "PNPDeviceID: $($g.PNPDeviceID)"
  Write-Host "VideoProcessor: $($g.VideoProcessor)"
  Write-Host "VideoModeDescription: $($g.VideoModeDescription)"
  Write-Host "CurrentRefreshRate: $($g.CurrentRefreshRate)"
  Write-Host "MaxRefreshRate: $($g.MaxRefreshRate)"
  Write-Host "MinRefreshRate: $($g.MinRefreshRate)"
  Write-Host "CurrentHorizontalResolution: $($g.CurrentHorizontalResolution)"
  Write-Host "CurrentVerticalResolution: $($g.CurrentVerticalResolution)"
  Write-Host "CurrentNumberOfColors: $($g.CurrentNumberOfColors)"
  Write-Host "DeviceID: $($g.DeviceID)"
  Write-Host "Status: $($g.Status)"
}
