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
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const savedInfo = localStorage.getItem("laptop-test-system-info");
    if (savedInfo) {
      try {
        setInfo(JSON.parse(savedInfo));
        setStatus("complete");
      } catch (e) {
        console.error("Failed to parse saved info", e);
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
          clearInterval(pollingRef.current!);
          setStatus("complete");
          setInfo(payload.data);
          localStorage.setItem("laptop-test-system-info", JSON.stringify(payload.data));
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
    setStatus("downloading");
    addLog("Đang tạo file quét tự động...");
    
    await new Promise((resolve) => setTimeout(resolve, 800));
    
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
    addLog(`Da tai goi Toolcheck: laplap-toolcheck-${scanToken}.zip`);
    addLog("Giai nen file zip, chay LapLap-Scanner.bat de bat dau quet.");
    toast.success("Da tai goi Toolcheck!");
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
    }
    setInfo(null);
    setStatus("idle");
    setLog([]);
    setToken("");
    localStorage.removeItem("laptop-test-system-info");
  };

  const getStatusInfo = () => {
    switch (status) {
      case "downloading":
        return { color: "text-blue-600", icon: Loader2, label: "Đang tạo gói Toolcheck...", spin: true };
      case "waiting":
        return { color: "text-amber-600", icon: FileDown, label: "Chờ chạy Toolcheck...", spin: false };
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
              Tải gói Toolcheck kèm scanner, HD Sentinel, FurMark, GPU-Z và BatteryMon
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {status === "complete" ? (
              <Button variant="outline" onClick={resetScan}>
                <RefreshCw className="mr-2 h-4 w-4" /> Quét lại
              </Button>
            ) : status === "idle" ? (
              <Button onClick={generateAgent} className="bg-zinc-900 text-white hover:bg-zinc-700">
                <FileDown className="mr-2 h-4 w-4" />
                Tải Toolcheck
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
                    {status === "waiting" && "Giải nén gói Toolcheck rồi chạy LapLap-Scanner.bat để bắt đầu quét"}
                    {status === "connected" && "File scanner đang thu thập thông tin máy tính..."}
                    {status === "scanning" && "Đang đọc CPU, GPU, RAM, ổ cứng, pin, màn hình..."}
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
                <AlertCircle className="h-4 w-4" /> Cách sử dụng (Tự động 100%)
              </h3>
              <ol className="space-y-3 text-sm">
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">1</span>
                  <div>
                    <p className="font-medium">Nhấn nút "Tải Toolcheck"</p>
                    <p className="text-zinc-500">File .zip chứa scanner và thư mục Toolcheck sẽ tự động tải về máy bạn</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">2</span>
                  <div>
                    <p className="font-medium">Giải nén zip và chạy LapLap-Scanner.bat</p>
                    <p className="text-zinc-500">Scanner sẽ tự kết nối với trang web, sau đó hiện menu mở HD Sentinel, FurMark, GPU-Z và BatteryMon</p>
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-xs text-white">3</span>
                  <div>
                    <p className="font-medium">Xem kết quả tự động</p>
                    <p className="text-zinc-500">Dữ liệu sẽ tự động hiển thị trên trang web trong vài giây</p>
                  </div>
                </li>
              </ol>
            </div>
          )}

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
                  ? "Nhấn nút tải trình quét để bắt đầu"
                  : "Vui lòng đợi file scanner hoàn tất"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
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
                    return (
                      <div key={i} className={i > 0 ? "mt-3 border-t border-zinc-100 pt-3" : ""}>
                        <p className="text-base font-bold leading-tight text-zinc-900">
                          {drive.capacity === "N/A" || drive.capacity === null ? "N/A" : `${drive.capacity} GB`}{" "}
                          {show(drive.type)}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-zinc-500" title={show(drive.name)}>
                          {show(drive.name)}
                        </p>

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

                        {/* Giờ chạy & trạng thái — dạng chip */}
                        {(show(drive.powerOnTime) !== "N/A" || show(drive.status) !== "N/A") && (
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            {show(drive.powerOnTime) !== "N/A" && (
                              <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-600">
                                ⏱ Giờ chạy: {show(drive.powerOnTime)}
                              </span>
                            )}
                            {show(drive.status) !== "N/A" && (() => {
                              const st = show(drive.status).toLowerCase();
                              const bad = /(bad|fail|unhealth|critical|warning|caution)/.test(st);
                              const cls = bad
                                ? "bg-red-50 text-red-600"
                                : "bg-emerald-50 text-emerald-600";
                              return (
                                <span className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${cls}`}>
                                  {show(drive.status)}
                                </span>
                              );
                            })()}
                          </div>
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
    </div>
  );
}
