import si from "systeminformation";

type Systeminformation = {
  CpuData: unknown;
  MemData: unknown;
  DiskLayoutData: unknown;
  GraphicsData: unknown;
  SystemData: unknown;
  BatteryData: unknown;
  OsData: unknown;
  NetworkInterfacesData: unknown;
  BaseboardData: unknown;
  BiosData: unknown;
};

export interface CollectedHardware {
  cpu: Systeminformation["CpuData"] | null;
  memory: Systeminformation["MemData"] | null;
  diskLayout: Systeminformation["DiskLayoutData"][] | null;
  graphics: Systeminformation["GraphicsData"] | null;
  system: Systeminformation["SystemData"] | null;
  battery: Systeminformation["BatteryData"] | null;
  osInfo: Systeminformation["OsData"] | null;
  networkInterfaces: Systeminformation["NetworkInterfacesData"][] | null;
  baseboard: Systeminformation["BaseboardData"] | null;
  bios: Systeminformation["BiosData"] | null;
  collectedAt: string;
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

export async function collectHardware(): Promise<CollectedHardware> {
  const [
    cpu,
    memory,
    diskLayout,
    graphics,
    system,
    battery,
    osInfo,
    networkInterfaces,
    baseboard,
    bios,
  ] = await Promise.all([
    safe(() => si.cpu()),
    safe(() => si.mem()),
    safe(() => si.diskLayout()),
    safe(() => si.graphics()),
    safe(() => si.system()),
    safe(() => si.battery()),
    safe(() => si.osInfo()),
    safe(() => si.networkInterfaces()),
    safe(() => si.baseboard()),
    safe(() => si.bios()),
  ]);

  return {
    cpu: cpu ?? null,
    memory: memory ?? null,
    diskLayout: diskLayout ?? null,
    graphics: graphics ?? null,
    system: system ?? null,
    battery: battery ?? null,
    osInfo: osInfo ?? null,
    networkInterfaces: networkInterfaces ?? null,
    baseboard: baseboard ?? null,
    bios: bios ?? null,
    collectedAt: new Date().toISOString(),
  };
}