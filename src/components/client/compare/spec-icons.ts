import {
  Battery,
  BatteryCharging,
  CircuitBoard,
  Cpu,
  Gauge,
  HardDrive,
  Keyboard,
  MemoryStick,
  Monitor,
  MonitorSmartphone,
  RotateCcw,
  Ruler,
  Scan,
  ShieldCheck,
  Tag,
  Usb,
  Weight,
  Wifi,
  type LucideIcon,
} from "lucide-react";

/**
 * Map iconName (string) trong spec-registry sang component lucide.
 *
 * Registry để tên icon dạng string để src/lib/compare/ không phải import
 * lucide-react — thư mục đó chạy trong API route trên Cloudflare Worker.
 */
const ICONS: Record<string, LucideIcon> = {
  Battery,
  BatteryCharging,
  CircuitBoard,
  Cpu,
  Gauge,
  HardDrive,
  Keyboard,
  MemoryStick,
  Monitor,
  MonitorSmartphone,
  RotateCcw,
  Ruler,
  Scan,
  ShieldCheck,
  Tag,
  Usb,
  Weight,
  Wifi,
};

export function specIcon(iconName: string | undefined): LucideIcon {
  return (iconName && ICONS[iconName]) || Tag;
}
