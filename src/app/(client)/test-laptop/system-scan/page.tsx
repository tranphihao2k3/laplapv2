"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Battery,
  Wifi,
  RefreshCw,
  FileDown,
  CheckCircle2,
  Loader2,
  Terminal,
  AlertCircle,
  Link as LinkIcon,
  Zap,
  Cpu,
  MemoryStick,
  HardDrive,
  Monitor,
  MonitorCog,
  ArrowLeft,
  Download,
  ExternalLink,
} from "lucide-react";

type Scalar = string | number | null;

type GpuInfo = { name: string; vram: Scalar; driver: string; temp: Scalar };

type StorageInfo = {
  name: string;
  capacity: Scalar;
  type: string;
  free: Scalar;
  temp: Scalar;
  health?: Scalar;
  performance?: Scalar;
  powerOnTime?: Scalar;
  status?: Scalar;
  source?: Scalar;
  // === SMART details (smartmontools) ===
  reallocated?: Scalar;       // Reallocated sector count (HDD) hoac media errors (NVMe)
  pending?: Scalar;           // Current pending sector (HDD) hoac media_and_data_integrity_errors (NVMe)
  wearLevel?: Scalar;         // SSD: Media_Wearout_Indicator (ID 233) hoac Wear_Leveling_Count (ID 177)
  criticalWarning?: Scalar;   // NVMe critical_warning byte
  rotationRate?: Scalar;      // HDD RPM (5400/7200/10000/15000)
  modelFamily?: Scalar;       // smartctl model_family string
  smartSerial?: Scalar;       // Serial tu smartctl (chinh xac hon WMI)
  // === WMI SMART (khong can admin, fallback khi smartctl fail) ===
  // MSStorageDriver_FailurePredictStatus: PredictFailure=True -> o sap hong
  wmiPredictFailure?: Scalar; // boolean (true/false) hoac null neu khong doc duoc
  wmiReason?: Scalar;         // So thu tu attribute gay ra loi (vd: 5 = reallocated)
  // MSStorageDriver_ATAPISmartData: raw bytes hex -> parse ra Reallocated/Pending
  wmiReallocated?: Scalar;    // ID 5 Reallocated_Sector_Ct
  wmiWearLevel?: Scalar;      // ID 177 Wear_Leveling_Count hoac ID 233 Media_Wearout
  wmiPending?: Scalar;        // ID 197 Current_Pending_Sector
  wmiPowerOnHours?: Scalar;   // ID 9 Power_On_Hours
  wmiTemp?: Scalar;           // ID 194 Temperature_Celsius
  // === CDI (CrystalDiskInfo DLL binding) ===
  cdiAvailable?: boolean;     // co doc duoc CDI khong
  cdiModel?: Scalar;
  cdiSerial?: Scalar;
  cdiFirmware?: Scalar;
  cdiInterface?: Scalar;      // Serial ATA / NVM Express
  cdiFormFactor?: Scalar;     // 2.5 inch / M.2 / ...
  cdiSsdVendor?: Scalar;      // intel/samsung/...
  cdiDriveMap?: Scalar;       // C: D: E:
  cdiRotationRate?: Scalar;
  cdiTemperature?: Scalar;    // °C
  cdiPowerOnHours?: Scalar;
  cdiPowerOnCount?: Scalar;
  cdiLife?: Scalar;           // NVMe % life (100 = moi, 0 = sap hong)
  cdiWearLevel?: Scalar;      // SSD % wear (100 = moi)
  cdiHostWrites?: Scalar;     // GB da ghi
  cdiHostReads?: Scalar;      // GB da doc
  cdiTransferMode?: Scalar;   // SATA/600, PCIe 4.0 x4
  cdiAlarmTemp?: Scalar;
  cdiDiskStatus?: Scalar;     // 0=Good, 1=Bad, ...
  // Debug info: thong tin loi tu scanner (vd: smartctl exit code, deviceArg)
  debug?: {
    deviceArg?: string;
    typeArg?: string;
    exitCode?: number;
    hint?: string;
    error?: string;
    outputPreview?: string;
  };
};

type SystemInfo = {
  cpu: {
    name: string;
    cores: number;
    threads: number;
    baseClock: Scalar;
    boostClock: Scalar;
    tdp: Scalar;
    temp: Scalar;
  };
  // PowerShell trả về mảng GPU (có thể 1 hoặc nhiều card)
  gpu: GpuInfo[];
  ram: {
    total: Scalar;
    type: Scalar;
    speed: Scalar;
    slots: number;
    used: number;
    free: number;
    maxUpgrade: Scalar;
    // Chi tiết từng khe RAM đang gắn
    modules: Array<{
      slot: string;
      capacity: Scalar;
      manufacturer: string;
      type: Scalar;
      speed: Scalar;
      partNumber: string;
    }>;
  };
  // Một đĩa trả về object đơn, nhiều đĩa trả về mảng — chuẩn hoá khi render
  storage: StorageInfo | StorageInfo[];
  battery: {
    designed: Scalar;
    current: Scalar;
    health: Scalar;
    cycles: Scalar;
  };
  screen: {
    resolution: Scalar;
    refreshRate: Scalar;
    panel: Scalar;
    size: Scalar;
  };
  system: {
    name: string;
    serial: string;
    windowsKey: string;
    wifiSaved: Array<{ ssid: string; security: string }>;
    wifiNearby: Array<{ ssid: string; signal: number }>;
  };
};

export default function SystemScanPage() {
  const router = useRouter();
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [status, setStatus] = useState<"idle" | "downloading" | "waiting" | "connected" | "scanning" | "complete">("idle");
  const [log, setLog] = useState<string[]>([]);
  const [token, setToken] = useState<string>("");
  // Thong tin cache de canh bao "du lieu cu"
  const [cachedSavedAt, setCachedSavedAt] = useState<number | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Load cache tu localStorage nhung KHONG tu dong setStatus("complete").
    // Ly do: neu user F5 ngay khi dang quet may khac, hoac may moi so huu
    // khac may cu (serial khac), localStorage dang giu data may cu ->
    // setStatus("complete") ngay se "lua" UI hien thi data cu nhu moi.
    //
    // Cache chi duoc dung lam fallback UI (nen xam) khi chua co scan moi.
    // User phai nhan "Quet lai" hoac "Tai trinh quet" de tao token moi
    // va lay data that tu server.
    const saved = localStorage.getItem("laptop-test-system-info");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.info) {
          setInfo(parsed.info);
          setCachedSavedAt(parsed.savedAt ?? null);
          // Khong setStatus("complete") - giu trang thai idle de user scan moi.
        }
      } catch (e) {
        console.error("Failed to parse saved info", e);
        localStorage.removeItem("laptop-test-system-info");
      }
    }
  }, []);

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  const generateToken = () => {
    return `SCAN-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
  };

  const startPolling = (scanToken: string) => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
    }
    // Luu token hien tai vao ref de polling callback kiem tra stale response.
    // Neu server tra data cua token khac (do bug upstream hoac race condition),
    // ta se ignore de tranh "lot" data cu vao UI.
    const activeTokenRef = { value: scanToken };

    pollingRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/v1/system-scan/poll?token=${scanToken}`);
        const json = await res.json();
        // API wraps payloads as { ok: true, data: <payload> }.
        const payload = json?.data ?? json;

        // Heartbeat: scanner đã mở và đang quét -> đồng bộ trạng thái web.
        if (payload.status === "scanning") {
          setStatus((prev) => {
            if (prev === "waiting" || prev === "connected") {
              addLog("✅ File scanner đã kết nối — đang quét cấu hình...");
              return "scanning";
            }
            return prev;
          });
        }

        if (payload.status === "complete" && payload.data) {
          // Kiem tra token trong payload (neu server co tra ve) khop voi scan hien tai.
          // Mot so server khong tra token -> van tin tuong absolute timestamp
          // moi hon cache.
          const payloadToken = payload.token ?? payload.data?.token;
          if (payloadToken && payloadToken !== activeTokenRef.value) {
            console.warn("Stale poll response - token mismatch");
            return;
          }
          setInfo(payload.data);
          setCachedSavedAt(Date.now());
          try {
            localStorage.setItem(
              "laptop-test-system-info",
              JSON.stringify({ info: payload.data, savedAt: Date.now() }),
            );
          } catch (e) {
            console.error("Failed to save info", e);
          }
          setStatus("complete");
          if (pollingRef.current) clearInterval(pollingRef.current);
          pollingRef.current = null;
          addLog("✅ Nhận dữ liệu thành công!");
          toast.success("Quét hệ thống hoàn tất!");
        }
      } catch (e) {
        console.error("Polling error:", e);
      }
    }, 2000);
  };

  const addLog = (message: string) => {
    setLog((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const generateAgent = async () => {
    // QUAN TRONG: clear cache cu TRUOC khi start polling moi.
    // Neu user moi chay scanner tren may khac ma localStorage van giu data may cu,
    // thi trong khoang thoi gian cho (cho scanner chay xong), UI se hien thi
    // data may cu lam user tuong "scan xong nhung gia tri van cu".
    // Fix: set info=null ngay khi bat dau tao token moi.
    setInfo(null);
    setCachedSavedAt(null);
    setStatus("downloading");
    addLog("Đang tạo trình quét...");

    await new Promise((resolve) => setTimeout(resolve, 600));

    const scanToken = generateToken();
    setToken(scanToken);

    const downloadUrl = `/api/v1/system-scan/download?token=${encodeURIComponent(scanToken)}`;
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;
    downloadLink.download = `laplap-toolcheck-${scanToken}.zip`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    setStatus("waiting");
    addLog(`Đã tải trình quét: laplap-toolcheck-${scanToken}.zip`);
    addLog("Giải nén zip rồi chạy LapLap-Scanner.bat để bắt đầu quét.");
    toast.success("Đã tải trình quét!");
    startPolling(scanToken);
    return;

    const serverUrl = window.location.origin;

    // PowerShell script sạch (KHÔNG escape kiểu batch). Sẽ được encode Base64
    // để batch không can thiệp vào ký tự đặc biệt (* | > % { } ...).
    const submitUrl = `${serverUrl}/api/v1/system-scan/submit?token=${scanToken}`;
    const psScript = `
$ErrorActionPreference = 'SilentlyContinue'
$OutputEncoding = [System.Text.Encoding]::UTF8
function NZ($v, $d) { if ($null -ne $v -and [string]$v -ne '') { $v } else { $d } }
try { Invoke-RestMethod -Uri '${submitUrl}&status=scanning' -Method Post -TimeoutSec 10 | Out-Null } catch {}
Write-Host '[3/8] Dang quet CPU...' -ForegroundColor Cyan
$cpu = Get-CimInstance -ClassName Win32_Processor | Select-Object -First 1
$cpuTempC = 'N/A'
try { $tz = Get-CimInstance -Namespace 'root/wmi' -ClassName MSAcpi_ThermalZoneTemperature; if ($tz -and $tz.CurrentTemperature) { $cpuTempC = [string]([math]::Round(($tz.CurrentTemperature / 10) - 273.15, 1)) + ' C' } } catch {}
Write-Host '[4/8] Dang quet GPU...' -ForegroundColor Cyan
$gpus = @(Get-CimInstance -ClassName Win32_VideoController | Where-Object { $_.Name -and $_.Name -ne '' })
$regGpus = @(Get-ItemProperty 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Class\\{4d36e968-e325-11ce-bfc1-08002be10318}\\*' -ErrorAction SilentlyContinue | Where-Object { $_.'HardwareInformation.qwMemorySize' })
$gpuArr = @()
foreach ($g in $gpus) {
  $vram = 'N/A'
  $match = $regGpus | Where-Object { $_.DriverDesc -eq $g.Name } | Select-Object -First 1
  if (-not $match) { $match = $regGpus | Where-Object { $g.Name -like ('*' + $_.DriverDesc + '*') -or $_.DriverDesc -like ('*' + $g.Name + '*') } | Select-Object -First 1 }
  if ($match -and $match.'HardwareInformation.qwMemorySize') { $vram = [math]::Round([int64]$match.'HardwareInformation.qwMemorySize' / 1GB, 1) }
  elseif ($g.AdapterRAM -gt 0) { $vram = [math]::Round($g.AdapterRAM / 1GB, 1) }
  $gpuArr += @{ name = (NZ $g.Name 'N/A'); vram = $vram; driver = (NZ $g.DriverVersion 'N/A'); temp = 'N/A' }
}
Write-Host '[5/8] Dang quet RAM...' -ForegroundColor Cyan
$ram = @(Get-CimInstance -ClassName Win32_PhysicalMemory)
$ramArray = Get-CimInstance -ClassName Win32_PhysicalMemoryArray | Select-Object -First 1
$totalRAM = if ($ram) { ($ram | Measure-Object -Property Capacity -Sum).Sum / 1GB } else { 0 }
$memTypeMap = @{ 20 = 'DDR'; 21 = 'DDR2'; 24 = 'DDR3'; 26 = 'DDR4'; 34 = 'DDR5' }
$ramType = 'N/A'
if ($ram -and $ram[0].SMBIOSMemoryType -and $memTypeMap.ContainsKey([int]$ram[0].SMBIOSMemoryType)) { $ramType = $memTypeMap[[int]$ram[0].SMBIOSMemoryType] }
$ramSpeed = if ($ram -and $ram[0].Speed) { [int]$ram[0].Speed } else { 'N/A' }
if ($ramType -eq 'N/A' -and $ramSpeed -ne 'N/A') { if ([int]$ramSpeed -ge 4000) { $ramType = 'DDR5' } elseif ([int]$ramSpeed -ge 1600) { $ramType = 'DDR4' } elseif ([int]$ramSpeed -ge 800) { $ramType = 'DDR3' } }
$ramModules = @()
foreach ($m in $ram) {
  $mType = 'N/A'
  if ($m.SMBIOSMemoryType -and $memTypeMap.ContainsKey([int]$m.SMBIOSMemoryType)) { $mType = $memTypeMap[[int]$m.SMBIOSMemoryType] }
  if ($mType -eq 'N/A' -and $m.Speed) { if ([int]$m.Speed -ge 4000) { $mType = 'DDR5' } elseif ([int]$m.Speed -ge 1600) { $mType = 'DDR4' } elseif ([int]$m.Speed -ge 800) { $mType = 'DDR3' } }
  $slotName = if ($m.BankLabel -and $m.DeviceLocator) { [string]$m.BankLabel + ' / ' + [string]$m.DeviceLocator } else { (NZ $m.DeviceLocator (NZ $m.BankLabel 'N/A')) }
  $ramModules += @{ slot = $slotName; capacity = [math]::Round($m.Capacity / 1GB, 0); manufacturer = (NZ ([string]$m.Manufacturer).Trim() 'N/A'); type = $mType; speed = if ($m.Speed) { [string][int]$m.Speed + ' MHz' } else { 'N/A' }; partNumber = (NZ ([string]$m.PartNumber).Trim() 'N/A') }
}
$slots = if ($ramArray -and $ramArray.MemoryDevices) { [int]$ramArray.MemoryDevices } else { $ram.Count }
$used = $ram.Count
$maxUp = if ($ramArray -and $ramArray.MaxCapacity) { [string]([math]::Round($ramArray.MaxCapacity / 1MB, 0)) + ' GB' } else { 'N/A' }
Write-Host '[6/8] Dang quet o cung...' -ForegroundColor Cyan
$disks = @(Get-CimInstance -ClassName Win32_DiskDrive)
$phys = @(); try { $phys = @(Get-PhysicalDisk) } catch {}
$logical = @(Get-CimInstance -ClassName Win32_LogicalDisk -Filter 'DriveType=3')
$freeTotal = if ($logical) { ($logical | Measure-Object -Property FreeSpace -Sum).Sum / 1GB } else { 0 }
Write-Host '[7/8] Dang quet pin...' -ForegroundColor Cyan
$designedmWh = 'N/A'; $fullmWh = 'N/A'; $health = 'N/A'; $cycles = 'N/A'
$dCap = 0; $fCap = 0
# Cách 1: WMI (chỉ chạy khi co quyen admin)
try {
  $bStatic = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryStaticData
  $bFull = Get-CimInstance -Namespace 'root/wmi' -ClassName BatteryFullChargedCapacity
  $dCap = [int]($bStatic | Select-Object -First 1).DesignedCapacity
  $fCap = [int]($bFull | Select-Object -First 1).FullChargedCapacity
} catch {}
# Cách 2: powercfg battery report (KHONG can admin) - dung khi cach 1 that bai
if ($dCap -le 0 -or $fCap -le 0) {
  try {
    $rptPath = Join-Path $env:TEMP ('battreport_' + [guid]::NewGuid().ToString() + '.xml')
    powercfg /batteryreport /xml /output $rptPath | Out-Null
    if (Test-Path $rptPath) {
      [xml]$rpt = Get-Content $rptPath -Encoding UTF8
      $bat = $rpt.BatteryReport.Batteries.Battery
      if ($bat -is [array]) { $bat = $bat[0] }
      if ($bat) {
        if ([int]$bat.DesignCapacity -gt 0) { $dCap = [int]$bat.DesignCapacity }
        if ([int]$bat.FullChargeCapacity -gt 0) { $fCap = [int]$bat.FullChargeCapacity }
        if ([int]$bat.CycleCount -gt 0) { $cycles = [int]$bat.CycleCount }
      }
      Remove-Item $rptPath -Force -ErrorAction SilentlyContinue
    }
  } catch {}
}
if ($dCap -gt 0) { $designedmWh = $dCap }
if ($fCap -gt 0) { $fullmWh = $fCap }
if ($dCap -gt 0 -and $fCap -gt 0) { $health = [string]([math]::Round(($fCap / $dCap) * 100, 1)) + '%' }
if ($cycles -eq 'N/A') { try { $wb = Get-CimInstance -ClassName Win32_Battery | Select-Object -First 1; if ($wb -and $wb.CycleCount) { $cycles = [int]$wb.CycleCount } } catch {} }
Write-Host '[8/8] Dang lay thong tin he thong...' -ForegroundColor Cyan
$sysInfo = Get-CimInstance -ClassName Win32_ComputerSystem
$bios = Get-CimInstance -ClassName Win32_BIOS
$vc = $gpus | Where-Object { $_.CurrentHorizontalResolution -gt 0 } | Select-Object -First 1
if (-not $vc) { $vc = $gpus | Select-Object -First 1 }
$resolution = if ($vc -and $vc.CurrentHorizontalResolution) { [string]$vc.CurrentHorizontalResolution + ' x ' + [string]$vc.CurrentVerticalResolution } else { 'N/A' }
$refresh = if ($vc -and $vc.CurrentRefreshRate) { [string]$vc.CurrentRefreshRate + ' Hz' } else { 'N/A' }
$screenSize = 'N/A'
try { $mon = Get-CimInstance -Namespace 'root/wmi' -ClassName WmiMonitorBasicDisplayParams | Select-Object -First 1; if ($mon -and $mon.MaxHorizontalImageSize -gt 0) { $diag = [math]::Sqrt([math]::Pow($mon.MaxHorizontalImageSize, 2) + [math]::Pow($mon.MaxVerticalImageSize, 2)) / 2.54; $screenSize = [string][math]::Round($diag, 1) + ' inch' } } catch {}
$wifiProfiles = @()
try { $profileLines = netsh wlan show profiles | Select-String 'All User Profile'; if ($profileLines) { $wifiProfiles = $profileLines | ForEach-Object { $_.Line.Split(':')[1].Trim() } } } catch {}
Write-Host ''
Write-Host 'Dang chuan bi du lieu...' -ForegroundColor Yellow
$storageArr = @()
foreach ($d in $disks) {
  $dtype = 'N/A'
  $pd = $phys | Where-Object { $_.DeviceId -eq $d.Index -or $_.FriendlyName -eq $d.Model } | Select-Object -First 1
  $bus = if ($pd) { [string]$pd.BusType } else { '' }
  $media = if ($pd) { [string]$pd.MediaType } else { '' }
  if ($bus -eq 'NVMe' -or $d.Model -like '*NVMe*') { $dtype = 'NVMe SSD' }
  elseif ($media -eq 'SSD' -or $d.Model -like '*SSD*') { $dtype = 'SATA SSD' }
  elseif ($media -eq 'HDD' -or $bus -eq 'SATA') { $dtype = 'HDD' }
  elseif ($d.Model -like '*SSD*') { $dtype = 'SSD' }
  else { $dtype = if ($bus) { $bus } else { 'N/A' } }
  $storageArr += @{ name = $d.Model; capacity = [math]::Round($d.Size / 1GB, 1); type = $dtype; free = 'N/A'; temp = 'N/A' }
}
if ($storageArr.Count -gt 0) { $storageArr[0].free = [math]::Round($freeTotal, 1) }
$wifiArr = @()
foreach ($w in $wifiProfiles) { $wifiArr += @{ ssid = $w; security = 'WPA2' } }
$result = @{
  cpu = @{ name = (NZ $cpu.Name 'Unknown'); cores = (NZ $cpu.NumberOfCores 0); threads = (NZ $cpu.NumberOfLogicalProcessors 0); baseClock = if ($cpu.MaxClockSpeed) { [string]$cpu.MaxClockSpeed + ' MHz' } else { 'N/A' }; boostClock = 'N/A'; tdp = 'N/A'; temp = $cpuTempC }
  gpu = $gpuArr
  ram = @{ total = [string][math]::Round($totalRAM, 1) + ' GB'; type = $ramType; speed = if ($ramSpeed -ne 'N/A') { [string]$ramSpeed + ' MHz' } else { 'N/A' }; slots = $slots; used = $used; free = ($slots - $used); maxUpgrade = $maxUp; modules = $ramModules }
  storage = $storageArr
  battery = @{ designed = if ($designedmWh -ne 'N/A') { [string]$designedmWh + ' mWh' } else { 'N/A' }; current = if ($fullmWh -ne 'N/A') { [string]$fullmWh + ' mWh' } else { 'N/A' }; health = $health; cycles = $cycles }
  screen = @{ resolution = $resolution; refreshRate = $refresh; panel = 'N/A'; size = $screenSize }
  system = @{ name = (NZ $sysInfo.Name 'Unknown'); serial = (NZ $bios.SerialNumber 'N/A'); windowsKey = 'N/A'; wifiSaved = $wifiArr; wifiNearby = @() }
}
$json = $result | ConvertTo-Json -Depth 10 -Compress
Write-Host ''
Write-Host 'Dang gui du lieu len server...' -ForegroundColor Cyan
try {
  $bytes = [System.Text.Encoding]::UTF8.GetBytes($json)
  $response = Invoke-RestMethod -Uri '${submitUrl}' -Method Post -Body $bytes -ContentType 'application/json; charset=utf-8' -TimeoutSec 30
  Write-Host ''
  Write-Host '================================================' -ForegroundColor Green
  Write-Host '  QUET THANH CONG! DA GUI LEN SERVER!' -ForegroundColor Green
  Write-Host '================================================' -ForegroundColor Green
  Write-Host ''
  Write-Host 'Vui long xem ket qua tren trinh duyet.' -ForegroundColor Yellow
} catch {
  Write-Host ''
  Write-Host 'LOI: Khong the gui du lieu len server.' -ForegroundColor Red
  Write-Host $_.Exception.Message -ForegroundColor Red
  Write-Host 'Vui long kiem tra ket noi Internet hoac thu lai.' -ForegroundColor Yellow
}
`;

    // Encode UTF-16LE -> Base64 cho powershell -EncodedCommand (chống lỗi escape của batch)
    const utf16Bytes: number[] = [];
    for (let i = 0; i < psScript.length; i++) {
      const code = psScript.charCodeAt(i);
      utf16Bytes.push(code & 0xff, (code >> 8) & 0xff);
    }
    const encodedCommand = btoa(String.fromCharCode(...utf16Bytes));

    const agentCode = `@echo off
chcp 65001 >nul

title Laptop System Scanner

color 0A
echo.
echo ================================================
echo    LAPTOP SYSTEM SCANNER - AUTO CONNECT
echo ================================================
echo.
echo Token: ${scanToken}
echo Server: ${serverUrl}
echo.
echo ================================================
echo.

echo [1/8] Khoi tao ket noi...
echo [2/8] Bat dau quet he thong...
echo.

powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${encodedCommand}

echo.
echo.
echo Nhan phim bat ky de dong cua so nay...
pause >nul
exit
`;

    const blob = new Blob([agentCode], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `laptop-scanner-${scanToken}.bat`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setStatus("waiting");
    addLog(`File quét đã tải về: laptop-scanner-${scanToken}.bat`);
    addLog("Chờ bạn mở file để kết nối...");
    toast.success("Đã tải file scanner!");

    // Trạng thái "đang quét" / "hoàn tất" được điều khiển bởi heartbeat thật
    // từ scanner qua startPolling — không dùng setTimeout giả lập nữa.
    startPolling(scanToken);
  };

  const resetScan = () => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    setInfo(null);
    setCachedSavedAt(null);
    setStatus("idle");
    setLog([]);
    setToken("");
    try {
      localStorage.removeItem("laptop-test-system-info");
    } catch (e) {
      console.error("Failed to clear cache", e);
    }
  };

  const getStatusInfo = () => {
    switch (status) {
      case "downloading":
        return { color: "text-blue-600", icon: Loader2, label: "Đang tạo trình quét...", spin: true };
      case "waiting":
        return { color: "text-amber-600", icon: FileDown, label: "Chờ chạy LapLap-Scanner.bat...", spin: false };
      case "connected":
        return { color: "text-purple-600", icon: LinkIcon, label: "Đã kết nối! Đang quét...", spin: false };
      case "scanning":
        return { color: "text-purple-600", icon: Zap, label: "Đang quét hệ thống...", spin: true };
      case "complete":
        return { color: "text-green-600", icon: CheckCircle2, label: "Quét thành công!", spin: false };
      default:
        return { color: "text-zinc-500", icon: Terminal, label: "Sẵn sàng", spin: false };
    }
  };

  const statusInfo = getStatusInfo();
  const StatusIcon = statusInfo.icon;

  // Hiển thị giá trị an toàn: null / rỗng / "N/A" -> "N/A"
  const show = (v: Scalar | undefined): string => {
    if (v === null || v === undefined || v === "" || v === "N/A") return "N/A";
    return String(v);
  };
  // Tách số phần trăm từ chuỗi kiểu "100%" / "61 %" -> 100 / 61, không hợp lệ trả null
  const pct = (v: Scalar | undefined): number | null => {
    const s = show(v);
    if (s === "N/A") return null;
    const m = s.match(/(\d+(?:\.\d+)?)/);
    if (!m) return null;
    const n = Number(m[1]);
    return Number.isFinite(n) ? n : null;
  };
  // Màu đánh giá theo % (xanh tốt / vàng khá / đỏ yếu)
  const healthTone = (n: number | null) => {
    if (n === null) return { text: "text-zinc-500", bar: "bg-zinc-300" };
    if (n >= 80) return { text: "text-emerald-600", bar: "bg-emerald-500" };
    if (n >= 50) return { text: "text-amber-600", bar: "bg-amber-500" };
    return { text: "text-red-600", bar: "bg-red-500" };
  };
  // Storage có thể là object đơn hoặc mảng -> luôn chuẩn hoá về mảng
  const drives: StorageInfo[] = info
    ? Array.isArray(info.storage)
      ? info.storage
      : [info.storage]
    : [];

  // GPU có thể là object đơn hoặc mảng -> luôn chuẩn hoá về mảng
  const gpus: GpuInfo[] = info
    ? Array.isArray(info.gpu)
      ? info.gpu
      : [info.gpu]
    : [];

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <Button
        variant="ghost"
        className="mb-4"
        onClick={() => router.push("/test-laptop")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Quay lại
      </Button>
      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle>Quét cấu hình hệ thống</CardTitle>
            <CardDescription>
              Trình quét mini (PowerShell + WMI) — hiển thị CPU, GPU, RAM,
              ổ cứng (kèm SMART), pin và màn hình, không cần tải gói
              công cụ nặng.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {status === "complete" || (status === "idle" && info) ? (
              <Button variant="outline" onClick={resetScan}>
                <RefreshCw className="mr-2 h-4 w-4" /> Quét lại
              </Button>
            ) : status === "idle" ? (
              <Button onClick={generateAgent} className="bg-zinc-900 text-white hover:bg-zinc-700">
                <FileDown className="mr-2 h-4 w-4" />
                Tải trình quét
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent>
          {/* Status Banner + thanh tiến trình các bước (đồng bộ với terminal) */}
          {status !== "idle" && (
            <div className={`mb-6 rounded-lg border p-4 ${
              status === "complete" ? "bg-green-50 border-green-200" : "bg-zinc-50 border-zinc-200"
            }`}>
              <div className="flex items-center gap-3">
                <StatusIcon className={`h-6 w-6 shrink-0 ${statusInfo.color} ${statusInfo.spin ? "animate-spin" : ""}`} />
                <div className="flex-1">
                  <p className={`font-semibold ${statusInfo.color}`}>{statusInfo.label}</p>
                  <p className="text-xs text-zinc-500">
                    {status === "waiting" && "Giải nén zip vừa tải rồi chạy LapLap-Scanner.bat để bắt đầu quét"}
                    {status === "connected" && "File scanner đang thu thập thông tin máy tính..."}
                    {status === "scanning" && "Đang đọc CPU, GPU, RAM, ổ cứng (WMI SMART), pin, màn hình..."}
                    {status === "complete" && "Tất cả dữ liệu đã được tải lên thành công"}
                    {token && ` • Token: ${token}`}
                  </p>
                </div>
              </div>

              {/* Thanh bước: Tải → Mở → Quét → Hoàn tất */}
              {(() => {
                const steps = [
                  { key: "download", label: "Tải file" },
                  { key: "open", label: "Mở file" },
                  { key: "scan", label: "Đang quét" },
                  { key: "done", label: "Hoàn tất" },
                ];
                const activeIndex =
                  status === "downloading" ? 0
                  : status === "waiting" ? 1
                  : status === "connected" || status === "scanning" ? 2
                  : status === "complete" ? 3
                  : 0;
                return (
                  <div className="mt-3 flex items-center gap-1.5">
                    {steps.map((s, i) => {
                      const doneStep = i < activeIndex || status === "complete";
                      const activeStep = i === activeIndex && status !== "complete";
                      return (
                        <div key={s.key} className="flex flex-1 flex-col items-center gap-1">
                          <div className="flex w-full items-center gap-1.5">
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                                doneStep
                                  ? "bg-green-600 text-white"
                                  : activeStep
                                    ? "bg-zinc-900 text-white"
                                    : "bg-zinc-200 text-zinc-500"
                              }`}
                            >
                              {doneStep ? "✓" : i + 1}
                            </span>
                            {i < steps.length - 1 && (
                              <span
                                className={`h-0.5 flex-1 rounded ${
                                  i < activeIndex || status === "complete" ? "bg-green-600" : "bg-zinc-200"
                                }`}
                              />
                            )}
                          </div>
                          <span
                            className={`text-[10px] ${
                              activeStep ? "font-semibold text-zinc-900" : "text-zinc-500"
                            }`}
                          >
                            {s.label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Instructions */}
          {status === "idle" && (
            <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold">
                <AlertCircle className="h-4 w-4" /> Cách sử dụng (3 bước)
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">1</span>
                  <div>
                    <p className="font-medium">Nhấn nút "Tải trình quét"</p>
                    <p className="text-zinc-500">
                      Tải về file zip nhỏ (~20KB) chứa 1 file PowerShell quét
                      bằng WMI — không cần tải thêm 145MB Toolcheck.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">2</span>
                  <div>
                    <p className="font-medium">Giải nén và chạy LapLap-Scanner.bat</p>
                    <p className="text-zinc-500">
                      Cửa sổ PowerShell sẽ hiện và tự quét CPU/GPU/RAM/ổ
                      cứng/pin/màn hình, gửi kết quả về trang này.
                    </p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">3</span>
                  <div>
                    <p className="font-medium">Xem kết quả ngay trên trang</p>
                    <p className="text-zinc-500">
                      Dữ liệu hiện tự động trong vài giây. Sức khỏe ổ cứng được
                      đánh giá từ <strong>3 nguồn độc lập</strong> (smartctl ·
                      WMI SMART · WMI PredictFailure) và hiển thị song song để
                      so sánh. Không cần Admin vẫn đọc được WMI SMART.
                    </p>
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* Canh bao: co data cu trong localStorage tu lan scan truoc.
              Trang thai "idle" (chua scan moi) nhung info != null -> data hien
              thi la CACHE, co the KHONG con chinh xac (user doi may / doi pin /
              nang cap RAM...). Hien banner vang de user biet can quet lai. */}
          {status === "idle" && info && cachedSavedAt && (() => {
            const ageMs = Date.now() - cachedSavedAt;
            const ageMin = Math.floor(ageMs / 60000);
            const ageLabel = ageMin < 1
              ? "vừa xong"
              : ageMin < 60
                ? `${ageMin} phút trước`
                : `${Math.floor(ageMin / 60)} giờ trước`;
            return (
              <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-900">
                      Đang hiển thị dữ liệu cũ (lưu {ageLabel})
                    </p>
                    <p className="mt-1 text-xs text-amber-700">
                      Thông tin bên dưới là kết quả của lần quét trước, có thể
                      không còn chính xác nếu máy đã thay đổi phần cứng (RAM,
                      ổ cứng, pin) hoặc cập nhật hệ thống. Nhấn{" "}
                      <strong>"Quét lại"</strong> để lấy dữ liệu mới nhất từ máy
                      đang kết nối.
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Live Log */}
          {(status === "downloading" || status === "waiting" || status === "connected" || status === "scanning") && (
            <div className="mb-6 overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 p-4 font-mono text-xs">
              <div className="mb-2 flex items-center gap-2 text-zinc-400">
                <Terminal className="h-3 w-3" />
                <span>System Log</span>
              </div>
              <div className="max-h-64 space-y-1 overflow-y-auto">
                {log.map((l, i) => (
                  <div key={i} className="text-zinc-300">{l}</div>
                ))}
                {(status === "waiting" || status === "connected" || status === "scanning") && (
                  <div className="animate-pulse text-blue-400">▋</div>
                )}
              </div>
            </div>
          )}

          {!info ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-zinc-100 text-zinc-400">
                <Terminal className="h-8 w-8" />
              </div>
              <p className="text-lg font-medium">
                {status === "idle" ? "Sẵn sàng quét hệ thống" : "Đang chờ dữ liệu..."}
              </p>
              <p className="text-sm text-zinc-500">
                {status === "idle"
                  ? "Nhấn \"Tải trình quét\" để bắt đầu (file nhỏ ~20KB, không cần tải gói Toolcheck nặng)"
                  : "Vui lòng đợi file scanner hoàn tất"}
              </p>
            </div>
          ) : (
            <div className={status === "idle" ? "space-y-3 opacity-60" : "space-y-3"}>
              {/* Tên máy + serial - 1 dòng gọn */}
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg bg-zinc-50 px-3 py-2 text-sm">
                <span className="font-medium">{show(info.system.name)}</span>
                <span className="font-mono text-xs text-zinc-500">SN: {show(info.system.serial)}</span>
              </div>

              {/* Lưới thông số chính - tất cả trong 1 view */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* CPU */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <Cpu className="h-3.5 w-3.5" /> CPU
                  </div>
                  <p className="text-sm font-medium leading-tight">{show(info.cpu.name).trim()}</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    {info.cpu.cores} nhân / {info.cpu.threads} luồng • {show(info.cpu.baseClock)}
                  </p>
                </div>

                {/* RAM */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <MemoryStick className="h-3.5 w-3.5" /> RAM
                  </div>
                  <p className="text-sm font-medium leading-tight">
                    {show(info.ram.total)} {info.ram.type !== "N/A" && info.ram.type !== null ? show(info.ram.type) : ""}
                  </p>
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {show(info.ram.speed)} • {info.ram.used}/{info.ram.slots} khe đã dùng
                  </p>
                  {/* Chi tiết từng khe */}
                  {info.ram.modules && info.ram.modules.length > 0 && (
                    <div className="mt-2 space-y-1.5 border-t border-zinc-100 pt-2">
                      {info.ram.modules.map((m, i) => (
                        <div key={i} className="text-xs">
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-medium">
                              {m.capacity === "N/A" || m.capacity === null ? "N/A" : `${m.capacity}GB`}{" "}
                              {show(m.type)}
                            </span>
                            <span className="text-zinc-500">{show(m.manufacturer)}</span>
                          </div>
                          <div className="truncate text-[10px] text-zinc-400" title={`${show(m.slot)} • ${show(m.partNumber)}`}>
                            {show(m.slot)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ổ cứng */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <HardDrive className="h-3.5 w-3.5" /> Ổ cứng
                  </div>
                  {drives.map((drive, i) => {
                    const healthN = pct(drive.health);
                    const perfN = pct(drive.performance);
                    const hTone = healthTone(healthN);
                    const pTone = healthTone(perfN);
                    // Co data SMART that (powerOnTime, wear, model_family, serial)
                    // hay khong. Neu khong nhung source bat dau bang "smartctl"
                    // -> canh bao user chay admin.
                    const hasSmartData =
                      (drive.powerOnTime !== null && drive.powerOnTime !== undefined) ||
                      (drive.wearLevel !== null && drive.wearLevel !== undefined) ||
                      (drive.modelFamily !== null && drive.modelFamily !== undefined && drive.modelFamily !== "") ||
                      (drive.smartSerial !== null && drive.smartSerial !== undefined && drive.smartSerial !== "");
                    const isSmartCtl = typeof drive.source === "string" && drive.source.startsWith("smartctl");
                    return (
                      <div key={i} className={i > 0 ? "mt-3 border-t border-zinc-100 pt-3" : ""}>
                        <p className="text-base font-bold leading-tight text-zinc-900">
                          {drive.capacity === "N/A" || drive.capacity === null ? "N/A" : `${drive.capacity} GB`}{" "}
                          {show(drive.type)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500" title={show(drive.name)}>
                          {show(drive.name)}
                        </p>

                        {/* HDD RPM chip */}
                        {(() => {
                          const rpm = drive.rotationRate !== null && drive.rotationRate !== undefined ? Number(drive.rotationRate) : 0;
                          return rpm > 0 ? (
                            <span className="mt-1 inline-block rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600">
                              🔄 {rpm} RPM
                            </span>
                          ) : null;
                        })()}

                        {/* Thong bao neu source la smartctl nhung khong co SMART data
                            (thuong do khong co quyen Admin de doc raw PhysicalDrive).
                            Trong truong hop nay o cung VAN co the OK - ta chi khong
                            doc duoc SMART chi tiet, nen hien thi info-box XANH DUONG
                            (thong tin) thay vi canh bao VANG (canh bao). */}
                        {isSmartCtl && !hasSmartData && (
                          <div className="mt-2 rounded-md border border-sky-200 bg-sky-50 p-2 text-xs text-sky-800">
                            <p className="font-medium text-sky-900">
                              ✓ Ổ cứng có thể đang ổn — chỉ chưa đọc được SMART chi tiết.
                            </p>
                            <p className="mt-1 text-sky-700">
                              Scanner chạy không có quyền Admin nên smartctl không truy cập
                              được SMART raw. Chạy lại <code className="rounded bg-sky-100 px-1 py-0.5 text-[11px]">LapLap-Scanner.bat</code>{" "}
                              với <strong>Run as Administrator</strong> để xem
                              reallocated, wear level, nhiệt độ, RPM.
                            </p>
                          </div>
                        )}

                        {/* Sức khỏe & hiệu năng — hiển thị nổi bật với thanh màu */}
                        {(healthN !== null || perfN !== null) && (
                          <div className={`mt-2 grid gap-2 ${healthN !== null && perfN !== null ? "grid-cols-2" : "grid-cols-1"}`}>
                            {healthN !== null && (
                              <div>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[11px] font-medium text-zinc-500">Sức khỏe</span>
                                  <span className={`text-lg font-bold leading-none ${hTone.text}`}>{healthN}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                                  <div className={`h-full rounded-full ${hTone.bar}`} style={{ width: `${Math.min(100, healthN)}%` }} />
                                </div>
                              </div>
                            )}
                            {perfN !== null && (
                              <div>
                                <div className="flex items-baseline justify-between">
                                  <span className="text-[11px] font-medium text-zinc-500">Hiệu năng</span>
                                  <span className={`text-lg font-bold leading-none ${pTone.text}`}>{perfN}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                                  <div className={`h-full rounded-full ${pTone.bar}`} style={{ width: `${Math.min(100, perfN)}%` }} />
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* === CDI / CrystalDiskInfo section (uu tien cao nhat neu co Admin) ===
                            Cung cấp dữ liệu chuẩn xác như CrystalDiskInfo GUI:
                            nhiệt độ trực tiếp, power on hours, NVMe % life,
                            SSD wear, host writes/reads (GB), transfer mode. */}
                        {drive.cdiAvailable ? (
                          <div className="mt-2 rounded-md border border-sky-200 bg-sky-50/50 p-2 text-xs">
                            <div className="mb-1.5 flex items-center gap-1.5">
                              <span className="font-semibold text-sky-900">CrystalDiskInfo</span>
                              <span className="text-[10px] text-sky-700">(chính xác nhất · cần Admin)</span>
                              <span className="ml-auto rounded bg-sky-200 px-1 text-[10px] text-sky-900">
                                {drive.cdiInterface || "?"}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 sm:grid-cols-3">
                              {drive.cdiTemperature !== null && drive.cdiTemperature !== undefined && (
                                <div>
                                  <span className="text-sky-700">Nhiệt độ: </span>
                                  <span className={Number(drive.cdiTemperature) >= 55 ? "font-bold text-red-700" : Number(drive.cdiTemperature) >= 45 ? "font-bold text-amber-700" : "font-medium text-sky-900"}>
                                    {String(drive.cdiTemperature)} °C
                                  </span>
                                  {drive.cdiAlarmTemp !== null && drive.cdiAlarmTemp !== undefined && Number(drive.cdiAlarmTemp) > 0 && (
                                    <span className="text-[10px] text-zinc-500"> / alarm {String(drive.cdiAlarmTemp)} °C</span>
                                  )}
                                </div>
                              )}
                              {drive.cdiPowerOnHours !== null && drive.cdiPowerOnHours !== undefined && (
                                <div>
                                  <span className="text-sky-700">Power On: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiPowerOnHours)} h</span>
                                </div>
                              )}
                              {drive.cdiPowerOnCount !== null && drive.cdiPowerOnCount !== undefined && (
                                <div>
                                  <span className="text-sky-700">Số lần bật: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiPowerOnCount)}</span>
                                </div>
                              )}
                              {drive.cdiLife !== null && drive.cdiLife !== undefined && (
                                <div>
                                  <span className="text-sky-700">Life còn lại (NVMe): </span>
                                  <span className={Number(drive.cdiLife) <= 20 ? "font-bold text-red-700" : Number(drive.cdiLife) <= 50 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
                                    {String(drive.cdiLife)} %
                                  </span>
                                </div>
                              )}
                              {drive.cdiWearLevel !== null && drive.cdiWearLevel !== undefined && (
                                <div>
                                  <span className="text-sky-700">Wear Level (SSD): </span>
                                  <span className={Number(drive.cdiWearLevel) <= 20 ? "font-bold text-red-700" : Number(drive.cdiWearLevel) <= 50 ? "font-bold text-amber-700" : "font-bold text-emerald-700"}>
                                    {String(drive.cdiWearLevel)} / 100
                                  </span>
                                </div>
                              )}
                              {drive.cdiHostWrites !== null && drive.cdiHostWrites !== undefined && (
                                <div>
                                  <span className="text-sky-700">Đã ghi (Host): </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiHostWrites)} GB</span>
                                </div>
                              )}
                              {drive.cdiHostReads !== null && drive.cdiHostReads !== undefined && (
                                <div>
                                  <span className="text-sky-700">Đã đọc (Host): </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiHostReads)} GB</span>
                                </div>
                              )}
                              {drive.cdiRotationRate !== null && drive.cdiRotationRate !== undefined && Number(drive.cdiRotationRate) > 0 && (
                                <div>
                                  <span className="text-sky-700">RPM: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiRotationRate)}</span>
                                </div>
                              )}
                              {drive.cdiFirmware && (
                                <div className="col-span-2 sm:col-span-3">
                                  <span className="text-sky-700">Serial/Firmware: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiSerial)} · fw {String(drive.cdiFirmware)}</span>
                                </div>
                              )}
                              {drive.cdiDriveMap && (
                                <div>
                                  <span className="text-sky-700">Drive: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiDriveMap)}</span>
                                </div>
                              )}
                              {drive.cdiFormFactor && (
                                <div>
                                  <span className="text-sky-700">Form factor: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiFormFactor)}</span>
                                </div>
                              )}
                              {drive.cdiTransferMode && (
                                <div className="col-span-2 sm:col-span-3">
                                  <span className="text-sky-700">Transfer: </span>
                                  <span className="font-medium text-sky-900">{String(drive.cdiTransferMode)}</span>
                                </div>
                              )}
                              {drive.cdiDiskStatus !== null && drive.cdiDiskStatus !== undefined && (
                                <div>
                                  <span className="text-sky-700">Trạng thái: </span>
                                  <span className={Number(drive.cdiDiskStatus) === 0 ? "font-bold text-emerald-700" : "font-bold text-red-700"}>
                                    {Number(drive.cdiDiskStatus) === 0 ? "GOOD" : "BAD"} ({String(drive.cdiDiskStatus)})
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* === WMI SMART (khong can admin, fallback khi smartctl fail) ===
                            Hien thi chi so raw doc tu MSStorageDriver_ATAPISmartData +
                            MSStorageDriver_FailurePredictStatus. KHONG tinh diem,
                            chi show gia tri de user tu danh gia / so sanh voi smartctl. */}
                        {(drive.wmiReallocated !== null && drive.wmiReallocated !== undefined) ||
                         (drive.wmiPending !== null && drive.wmiPending !== undefined) ||
                         (drive.wmiWearLevel !== null && drive.wmiWearLevel !== undefined) ||
                         (drive.wmiPowerOnHours !== null && drive.wmiPowerOnHours !== undefined) ||
                         (drive.wmiTemp !== null && drive.wmiTemp !== undefined) ||
                         (drive.wmiPredictFailure !== null && drive.wmiPredictFailure !== undefined) ? (
                          <div className="mt-2 rounded-md border border-zinc-200 bg-zinc-50/50 p-2 text-xs">
                            <div className="mb-1 flex items-center gap-1.5">
                              <span className="font-semibold text-zinc-700">WMI SMART</span>
                              <span className="text-[10px] text-zinc-500">(không cần Admin)</span>
                            </div>
                            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-3">
                              {drive.wmiPredictFailure !== null && drive.wmiPredictFailure !== undefined && (
                                <div className="col-span-2 sm:col-span-3">
                                  <span className="text-zinc-500">PredictFailure: </span>
                                  {Number(drive.wmiPredictFailure) === 1 ? (
                                    <span className="font-bold text-red-700">TRUE — ổ sắp hỏng</span>
                                  ) : (
                                    <span className="font-medium text-emerald-700">FALSE — OK</span>
                                  )}
                                </div>
                              )}
                              {drive.wmiReallocated !== null && drive.wmiReallocated !== undefined && (
                                <div>
                                  <span className="text-zinc-500">Reallocated: </span>
                                  <span className={Number(drive.wmiReallocated) > 0 ? "font-bold text-red-700" : "font-medium text-zinc-700"}>
                                    {String(drive.wmiReallocated)}
                                  </span>
                                </div>
                              )}
                              {drive.wmiPending !== null && drive.wmiPending !== undefined && (
                                <div>
                                  <span className="text-zinc-500">Pending: </span>
                                  <span className={Number(drive.wmiPending) > 0 ? "font-bold text-amber-700" : "font-medium text-zinc-700"}>
                                    {String(drive.wmiPending)}
                                  </span>
                                </div>
                              )}
                              {drive.wmiWearLevel !== null && drive.wmiWearLevel !== undefined && (
                                <div>
                                  <span className="text-zinc-500">Wear Level: </span>
                                  <span className="font-medium text-zinc-700">{String(drive.wmiWearLevel)}</span>
                                </div>
                              )}
                              {drive.wmiPowerOnHours !== null && drive.wmiPowerOnHours !== undefined && (
                                <div>
                                  <span className="text-zinc-500">Power On: </span>
                                  <span className="font-medium text-zinc-700">{String(drive.wmiPowerOnHours)} h</span>
                                </div>
                              )}
                              {drive.wmiTemp !== null && drive.wmiTemp !== undefined && (
                                <div>
                                  <span className="text-zinc-500">Nhiệt độ: </span>
                                  <span className="font-medium text-zinc-700">{String(drive.wmiTemp)} °C</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : null}

                        {/* === SMART DETAIL (hien thi TAT CA field de user biet thieu data o dau) === */}
                        {isSmartCtl && (
                          <div className="mt-2 space-y-1 border-t border-zinc-100 pt-2 text-xs">
                            {/* Model family + Serial */}
                            {(show(drive.modelFamily) !== "N/A" || show(drive.smartSerial) !== "N/A") && (
                              <div className="flex justify-between gap-2">
                                <span className="shrink-0 text-zinc-500">SMART:</span>
                                <span className="truncate text-right text-zinc-700" title={`${show(drive.modelFamily)} • ${show(drive.smartSerial)}`}>
                                  {show(drive.modelFamily) !== "N/A" ? show(drive.modelFamily) : ""}
                                  {show(drive.modelFamily) !== "N/A" && show(drive.smartSerial) !== "N/A" ? " • " : ""}
                                  {show(drive.smartSerial) !== "N/A" ? `SN: ${show(drive.smartSerial)}` : ""}
                                </span>
                              </div>
                            )}

                            {/* Power on hours + Temperature */}
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                              <span>
                                <span className="text-zinc-500">⏱ Giờ chạy: </span>
                                <span className="font-medium text-zinc-700">
                                  {show(drive.powerOnTime) !== "N/A" ? show(drive.powerOnTime) : "—"}
                                </span>
                              </span>
                              <span>
                                <span className="text-zinc-500">🌡 Nhiệt độ: </span>
                                <span className="font-medium text-zinc-700">
                                  {show(drive.temp) !== "N/A" ? show(drive.temp) : "—"}
                                </span>
                              </span>
                            </div>

                            {/* Wear Level + Critical Warning */}
                            {(drive.wearLevel !== null && drive.wearLevel !== undefined) ||
                             (drive.criticalWarning !== null && drive.criticalWarning !== undefined && Number(drive.criticalWarning) > 0) ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {drive.wearLevel !== null && drive.wearLevel !== undefined && (
                                  <span>
                                    <span className="text-zinc-500">📊 Wear Level: </span>
                                    <span className="font-medium text-zinc-700">{Number(drive.wearLevel)}%</span>
                                  </span>
                                )}
                                {drive.criticalWarning !== null && drive.criticalWarning !== undefined && Number(drive.criticalWarning) > 0 && (
                                  <span className="font-bold text-red-700">
                                    ⚠ Critical Warning: {Number(drive.criticalWarning)}
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {/* Reallocated + Pending */}
                            {(drive.reallocated !== null && drive.reallocated !== undefined && Number(drive.reallocated) > 0) ||
                             (drive.pending !== null && drive.pending !== undefined && Number(drive.pending) > 0) ? (
                              <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                                {drive.reallocated !== null && drive.reallocated !== undefined && Number(drive.reallocated) > 0 && (
                                  <span className={Number(drive.reallocated) > 10 ? "font-bold text-red-700" : "text-amber-700"}>
                                    ⚠ Reallocated: {Number(drive.reallocated)}
                                  </span>
                                )}
                                {drive.pending !== null && drive.pending !== undefined && Number(drive.pending) > 0 && (
                                  <span className="text-amber-700">
                                    ⚠ Pending: {Number(drive.pending)}
                                  </span>
                                )}
                              </div>
                            ) : null}

                            {/* Status badge */}
                            {show(drive.status) !== "N/A" && (() => {
                              const st = show(drive.status).toLowerCase();
                              const bad = /(bad|fail|unhealth|critical|caution|lỗi)/.test(st);
                              // "warning" khong con la bad mac dinh (co tru hop NVMe critical warning = 0)
                              // tuy nhien van giu "warning" trong nhom do neu khong phai GOOD.
                              const isGood = st === "good" || st === "passed";
                              const isNeutral = isGood === false && bad === false;
                              let cls = "bg-emerald-50 text-emerald-600";
                              if (bad) cls = "bg-red-50 text-red-600";
                              else if (isNeutral) cls = "bg-amber-50 text-amber-700";
                              return (
                                <div className="pt-1">
                                  <span className={`inline-block rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>
                                    {show(drive.status)}
                                  </span>
                                </div>
                              );
                            })()}
                          </div>
                        )}

                        {/* Debug info neu smartctl fail - hien thi ly do de user debug */}
                        {drive.debug && (
                          <details className="mt-2 rounded-md border border-red-200 bg-red-50 p-2 text-xs">
                            <summary className="cursor-pointer font-semibold text-red-800">
                              ⚠ Debug info (Click to expand)
                            </summary>
                            <div className="mt-1.5 space-y-1 text-[11px] text-red-700">
                              {drive.debug.deviceArg && (
                                <div><strong>Device:</strong> <code>{drive.debug.deviceArg}</code></div>
                              )}
                              {drive.debug.typeArg && (
                                <div><strong>Driver:</strong> <code>-d {drive.debug.typeArg}</code></div>
                              )}
                              {drive.debug.exitCode !== undefined && (
                                <div><strong>Exit code:</strong> <code>{drive.debug.exitCode}</code></div>
                              )}
                              {drive.debug.hint && (
                                <div><strong>Hint:</strong> {drive.debug.hint}</div>
                              )}
                              {drive.debug.error && (
                                <div><strong>Error:</strong> {drive.debug.error}</div>
                              )}
                              {drive.debug.outputPreview && (
                                <div>
                                  <strong>Output preview:</strong>
                                  <pre className="mt-0.5 overflow-x-auto rounded bg-red-100 p-1 font-mono text-[10px]">
                                    {drive.debug.outputPreview}
                                  </pre>
                                </div>
                              )}
                            </div>
                          </details>
                        )}
                        {/* Source label (smartctl vs WMI) - luon hien thi */}
                        {show(drive.source) !== "N/A" && (
                          <p className="mt-1.5 text-[10px] text-zinc-400">
                            Nguồn: {show(drive.source)}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* GPU */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <MonitorCog className="h-3.5 w-3.5" /> GPU
                  </div>
                  {gpus.length === 0 || (gpus.length === 1 && !gpus[0]) ? (
                    <p className="text-sm font-medium leading-tight">N/A</p>
                  ) : (
                    gpus.map((g, i) => (
                      <div key={i} className={i > 0 ? "mt-1.5 border-t border-zinc-100 pt-1.5" : ""}>
                        <p className="text-sm font-medium leading-tight">{show(g?.name)}</p>
                        <p className="mt-1 text-xs text-zinc-500">
                          {!g?.vram || g.vram === "N/A" ? "VRAM N/A" : `${g.vram} GB VRAM`}
                        </p>
                      </div>
                    ))
                  )}
                </div>

                {/* Màn hình */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <Monitor className="h-3.5 w-3.5" /> Màn hình
                  </div>
                  <p className="text-sm font-medium leading-tight">
                    {show(info.screen.resolution)}
                    {info.screen.refreshRate !== "N/A" && info.screen.refreshRate !== null
                      ? ` @ ${show(info.screen.refreshRate)}`
                      : ""}
                  </p>
                  <p className="mt-1 text-xs text-zinc-500">{show(info.screen.size)}</p>
                </div>

                {/* Pin */}
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <Battery className="h-3.5 w-3.5" /> Pin
                  </div>
                  {(() => {
                    // health từ scanner là "% sức khỏe còn lại" (Full/Designed).
                    // Độ chai = 100% - sức khỏe.
                    const hStr = show(info.battery.health);
                    const hNum = hStr !== "N/A" ? parseFloat(hStr) : NaN;
                    const wear = !isNaN(hNum) ? Math.round((100 - hNum) * 10) / 10 : null;
                    return (
                      <>
                        <p className="text-sm font-medium leading-tight">
                          {!isNaN(hNum) ? `Sức khỏe pin: ${hNum}%` : "Sức khỏe pin: N/A"}
                        </p>
                        {wear !== null && (
                          <p className="text-xs font-medium text-amber-600">Độ chai: {wear}%</p>
                        )}
                      </>
                    );
                  })()}
                  <div className="mt-1 space-y-0.5 text-xs text-zinc-500">
                    <div className="flex justify-between">
                      <span>Dung lượng gốc:</span>
                      <span className="font-medium text-zinc-700">{show(info.battery.designed)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Hiện tại:</span>
                      <span className="font-medium text-zinc-700">{show(info.battery.current)}</span>
                    </div>
                    {info.battery.cycles !== "N/A" && info.battery.cycles !== null && (
                      <div className="flex justify-between">
                        <span>Chu kỳ sạc:</span>
                        <span className="font-medium text-zinc-700">{show(info.battery.cycles)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* WiFi đã lưu - dạng chip gọn */}
              {info.system.wifiSaved.length > 0 && (
                <div className="rounded-lg border border-zinc-200 p-3">
                  <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-zinc-500">
                    <Wifi className="h-3.5 w-3.5" /> WiFi đã lưu ({info.system.wifiSaved.length})
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {info.system.wifiSaved.map((wifi, i) => (
                      <Badge key={i} variant="secondary" className="font-normal">
                        {wifi.ssid}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* === TOOLS PANEL (Phase 3) === */}
      {/* Chi hien thi khi da scan xong (status=complete). User co the nhan
          tool de server proxy stream file ve client, luu local va yeu cau
          scanner (PS1 background) download + extract + launch. */}
      {status === "complete" && token && (
        <ToolsPanel token={token} />
      )}
    </div>
  );
}

/**
 * ToolsPanel: hien thi danh sach tools (catalog tu server), moi tool co
 * button "Tai va mo". Khi nhan:
 *  1. POST /api/v1/system-scan/command?token=X -> server queue command.
 *  2. Scanner (PS1 background) poll command-poll, nhan command, download file,
 *     extract zip, launch .exe.
 *  3. UI khong can quan ly download truc tiep - scanner lam het.
 */
interface ToolInfo {
  id: string;
  name: string;
  description: string;
  category: string;
  sizeBytes: number;
  sizeLabel: string;
  icon: string;
  requiresAdmin: boolean;
  downloadEndpoint: string;
  sha256: string;
  verifyMode: "verified" | "required" | "skip";
}

type Stage =
  | "idle"
  | "downloading"
  | "verifying"
  | "extracting"
  | "launching"
  | "done"
  | "error";

interface ProgressInfo {
  stage: Stage;
  percent: number;
  message: string;
  actualSha256?: string;
  verifyStatus?: "ok" | "mismatch" | "skipped" | "unverified";
  issuedAt: number;
}

function ToolsPanel({ token }: { token: string }) {
  const [tools, setTools] = useState<ToolInfo[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [recentlyLaunched, setRecentlyLaunched] = useState<string | null>(null);
  // Progress theo toolId: luu stage + percent + message + verify.
  const [progressMap, setProgressMap] = useState<Record<string, ProgressInfo>>({});
  // SHA256 verify result (separate de highlight UI).
  const [verifyMap, setVerifyMap] = useState<Record<string, "ok" | "mismatch" | "unverified" | "skipped" | null>>({});

  // Load catalog 1 lan khi mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/v1/tools");
        const json = await res.json();
        const list = json?.data ?? json;
        if (!cancelled && Array.isArray(list)) setTools(list);
      } catch (e) {
        console.error("Failed to load tools", e);
        toast.error("Khong the tai danh sach cong cu.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Poll progress moi 1.5s khi co it nhat 1 tool dang pending hoac vua launch.
  // Ngung poll sau khi stage="done" hoac "error" va reset 30s sau.
  useEffect(() => {
    if (!token) return;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const tick = async () => {
      if (!active) return;
      try {
        const res = await fetch(
          `/api/v1/system-scan/progress?token=${encodeURIComponent(token)}`,
        );
        const json = await res.json();
        const cur = json?.data?.current;
        if (cur && active) {
          setProgressMap((prev) => ({
            ...prev,
            [cur.toolId]: {
              stage: cur.stage as Stage,
              percent: cur.percent ?? 0,
              message: cur.message ?? "",
              actualSha256: cur.actualSha256,
              verifyStatus: cur.verifyStatus,
              issuedAt: cur.issuedAt ?? Date.now(),
            },
          }));
          // Track verify result.
          if (cur.verifyStatus) {
            setVerifyMap((prev) => ({ ...prev, [cur.toolId]: cur.verifyStatus }));
          }
          // Auto-stop polling sau khi done/error + 5s grace.
          if (cur.stage === "done" || cur.stage === "error") {
            setTimeout(() => {
              setProgressMap((prev) => {
                const next = { ...prev };
                delete next[cur.toolId];
                return next;
              });
            }, 5000);
            return; // stop loop
          }
        }
      } catch (e) {
        // Silent
      }
      if (active) timer = setTimeout(tick, 1500);
    };

    // Chi poll khi co progress dang theo doi (recentlyLaunched != null).
    if (recentlyLaunched) {
      tick();
    }

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [token, recentlyLaunched]);

  const handleLaunch = async (tool: ToolInfo) => {
    if (!token) {
      toast.error("Can quet xong truoc khi su dung cong cu.");
      return;
    }
    if (pending.has(tool.id)) return;

    setPending((prev) => new Set(prev).add(tool.id));

    try {
      // 1. Queue command cho scanner PS1.
      const res = await fetch(
        `/api/v1/system-scan/command?token=${encodeURIComponent(token)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "launch-tool", toolId: tool.id }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json?.ok) {
        throw new Error(json?.error?.message || `HTTP ${res.status}`);
      }
      toast.success(
        `Dang tai ${tool.name}... Scanner se tu dong mo sau 5-30 giay.`,
        { duration: 4000 },
      );
      setRecentlyLaunched(tool.id);

      // 2. Reset "recently launched" sau 30s de user co the nhan lai neu can.
      setTimeout(() => {
        setRecentlyLaunched((cur) => (cur === tool.id ? null : cur));
      }, 30000);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      toast.error(`Khong the yeu cau ${tool.name}: ${msg}`);
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(tool.id);
        return next;
      });
    }
  };

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold text-zinc-900">
            <Download className="h-4 w-4" /> Cong cu kiem tra them
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Nhan tool de tai ve may va mo tu dong. File luu tai{" "}
            <code className="rounded bg-zinc-100 px-1 py-0.5 text-[11px]">%LOCALAPPDATA%\LapLap\Tools\</code>{" "}
            - lan sau khong can tai lai.
          </p>
        </div>
        <a
          href="/api/v1/tools"
          target="_blank"
          rel="noopener"
          className="text-xs text-zinc-400 hover:text-zinc-700"
          title="API endpoint"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-lg border border-zinc-200 bg-zinc-50"
            />
          ))}
        </div>
      ) : !tools || tools.length === 0 ? (
        <p className="text-sm text-zinc-500">Khong co cong cu nao trong catalog.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tools.map((t) => {
            const isPending = pending.has(t.id);
            const isRecent = recentlyLaunched === t.id;
            const progress = progressMap[t.id];
            const verifyState = verifyMap[t.id];
            const stage = progress?.stage;
            const percent = progress?.percent ?? 0;

            // Card border theo state.
            let cardClass = "border-zinc-200 bg-white hover:border-zinc-400";
            if (stage === "error") cardClass = "border-red-300 bg-red-50";
            else if (isRecent && stage === "done") cardClass = "border-green-300 bg-green-50";
            else if (isRecent) cardClass = "border-blue-300 bg-blue-50";

            return (
              <div
                key={t.id}
                className={`group rounded-lg border p-3 transition ${cardClass}`}
              >
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl" aria-hidden>
                      {t.icon}
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-zinc-900">{t.name}</p>
                      <p className="text-[11px] text-zinc-500">
                        {t.sizeLabel}
                        {t.requiresAdmin && (
                          <>
                            {" "}
                            <span className="text-amber-600">• can Admin</span>
                          </>
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Verify badge: hien thi trang thai verify SHA256 */}
                  {t.verifyMode === "verified" && (
                    <Badge variant="outline" className="border-green-300 px-1.5 py-0 text-[10px] text-green-700">
                      Verified
                    </Badge>
                  )}
                  {t.verifyMode === "required" && verifyState == null && (
                    <Badge variant="outline" className="border-amber-300 px-1.5 py-0 text-[10px] text-amber-700">
                      Unverified
                    </Badge>
                  )}
                </div>
                <p className="mb-3 line-clamp-2 text-xs text-zinc-600">
                  {t.description}
                </p>

                {/* Progress bar + status neu dang trong qua trinh */}
                {isRecent && progress && stage !== "idle" && stage !== "done" && (
                  <div className="mb-2">
                    <div className="mb-1 flex items-center justify-between text-[11px]">
                      <span className="text-zinc-600">
                        {progress.message || stage}
                      </span>
                      <span className="font-mono text-zinc-500">{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-200">
                      <div
                        className={`h-full transition-all ${
                          stage === "error"
                            ? "bg-red-500"
                            : stage === "verifying"
                              ? "bg-amber-500"
                              : "bg-blue-500"
                        }`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Verify result message (sau khi hoan tat). */}
                {isRecent && stage === "done" && verifyState === "ok" && (
                  <p className="mb-2 text-[11px] text-green-700">✓ SHA256 verified</p>
                )}
                {isRecent && stage === "done" && verifyState === "unverified" && (
                  <p className="mb-2 text-[11px] text-amber-700">
                    ⚠ File chua co hash chuan trong catalog (nhma tinh nhuan)
                  </p>
                )}
                {isRecent && stage === "error" && (
                  <p className="mb-2 text-[11px] text-red-700">
                    ✗ Loi: {progress?.message || "khong ro"}
                  </p>
                )}

                <Button
                  onClick={() => handleLaunch(t)}
                  disabled={isPending}
                  size="sm"
                  className={`w-full ${
                    isRecent && stage === "done"
                      ? "bg-green-600 hover:bg-green-700"
                      : isRecent
                        ? "bg-blue-600 hover:bg-blue-700"
                        : "bg-zinc-900 hover:bg-zinc-700"
                  } text-white`}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Dang gui lenh...
                    </>
                  ) : isRecent && stage === "downloading" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Dang tai... {percent}%
                    </>
                  ) : isRecent && stage === "verifying" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Verify SHA256...
                    </>
                  ) : isRecent && stage === "extracting" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Giai nen...
                    </>
                  ) : isRecent && stage === "launching" ? (
                    <>
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                      Dang mo...
                    </>
                  ) : isRecent && stage === "done" ? (
                    <>
                      <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                      Da mo!
                    </>
                  ) : isRecent && stage === "error" ? (
                    <>
                      <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
                      Loi - thu lai
                    </>
                  ) : (
                    <>
                      <Download className="mr-1.5 h-3.5 w-3.5" />
                      Tai va mo
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-4 text-[11px] text-zinc-400">
        Scanner (PowerShell) phai dang chay de nhan lenh. Neu cua so PowerShell da dong,
        hay chay lai LapLap-Scanner.bat va scan lai.
      </p>
    </div>
  );
}
