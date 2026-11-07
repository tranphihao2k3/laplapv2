/**
 * Seed linh kiện PC (CPU / GPU / RAM / SSD) vào catalog shop.
 * Idempotent theo slug sản phẩm.
 *
 * Chạy: node scripts/seed-pc-parts.mjs
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("Thiếu NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const ORG_CODE = "LAPLAP-ADMIN";

const CHILD_CATEGORIES = [
  { slug: "cpu", name: "CPU", position: 1 },
  { slug: "mainboard", name: "Mainboard", position: 2 },
  { slug: "ram", name: "RAM", position: 3 },
  { slug: "gpu", name: "VGA / GPU", position: 4 },
  { slug: "ssd", name: "SSD", position: 5 },
  { slug: "hdd", name: "HDD", position: 6 },
  { slug: "psu", name: "Nguồn PSU", position: 7 },
  { slug: "case", name: "Case", position: 8 },
  { slug: "cooler", name: "Tản nhiệt", position: 9 },
];

const BRANDS = [
  "Intel",
  "AMD",
  "NVIDIA",
  "ASUS",
  "MSI",
  "Gigabyte",
  "Corsair",
  "Kingston",
  "Samsung",
  "WD",
  "Crucial",
  "G.Skill",
  "TeamGroup",
  "Lexar",
  "Colorful",
  "PNY",
];

/** @typedef {{
 *  slot: 'cpu'|'gpu'|'ram'|'ssd',
 *  brand: string,
 *  name: string,
 *  slug: string,
 *  short?: string,
 *  spec: Record<string, unknown>
 * }} Part */

/** @type {Part[]} */
const PARTS = [
  // ===== Intel CPU gen 9+ =====
  { slot: "cpu", brand: "Intel", name: "Intel Core i3-9100F", slug: "cpu-intel-i3-9100f", short: "4 nhân / 4 luồng, Coffee Lake Refresh", spec: { socket: "LGA1151", tdp_w: 65, extras: { cores: 4, threads: 4, generation: 9, series: "i3" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i3-10100F", slug: "cpu-intel-i3-10100f", short: "4 nhân / 8 luồng, Comet Lake", spec: { socket: "LGA1200", tdp_w: 65, extras: { cores: 4, threads: 8, generation: 10, series: "i3" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i3-12100F", slug: "cpu-intel-i3-12100f", short: "4 nhân / 8 luồng, Alder Lake", spec: { socket: "LGA1700", tdp_w: 58, extras: { cores: 4, threads: 8, generation: 12, series: "i3" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i3-13100F", slug: "cpu-intel-i3-13100f", short: "4 nhân / 8 luồng, Raptor Lake", spec: { socket: "LGA1700", tdp_w: 58, extras: { cores: 4, threads: 8, generation: 13, series: "i3" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i3-14100F", slug: "cpu-intel-i3-14100f", short: "4 nhân / 8 luồng, Raptor Lake Refresh", spec: { socket: "LGA1700", tdp_w: 58, extras: { cores: 4, threads: 8, generation: 14, series: "i3" } } },

  { slot: "cpu", brand: "Intel", name: "Intel Core i5-9400F", slug: "cpu-intel-i5-9400f", short: "6 nhân / 6 luồng, gen 9", spec: { socket: "LGA1151", tdp_w: 65, extras: { cores: 6, threads: 6, generation: 9, series: "i5" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i5-10400F", slug: "cpu-intel-i5-10400f", short: "6 nhân / 12 luồng, gen 10", spec: { socket: "LGA1200", tdp_w: 65, extras: { cores: 6, threads: 12, generation: 10, series: "i5" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i5-11400F", slug: "cpu-intel-i5-11400f", short: "6 nhân / 12 luồng, gen 11", spec: { socket: "LGA1200", tdp_w: 65, extras: { cores: 6, threads: 12, generation: 11, series: "i5" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i5-12400F", slug: "cpu-intel-i5-12400f", short: "6 nhân / 12 luồng, gen 12", spec: { socket: "LGA1700", tdp_w: 65, extras: { cores: 6, threads: 12, generation: 12, series: "i5" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i5-13400F", slug: "cpu-intel-i5-13400f", short: "10 nhân / 16 luồng, gen 13", spec: { socket: "LGA1700", tdp_w: 65, extras: { cores: 10, threads: 16, generation: 13, series: "i5" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i5-14400F", slug: "cpu-intel-i5-14400f", short: "10 nhân / 16 luồng, gen 14", spec: { socket: "LGA1700", tdp_w: 65, extras: { cores: 10, threads: 16, generation: 14, series: "i5" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i5-14600K", slug: "cpu-intel-i5-14600k", short: "14 nhân / 20 luồng, gen 14 unlocked", spec: { socket: "LGA1700", tdp_w: 125, extras: { cores: 14, threads: 20, generation: 14, series: "i5" } } },

  { slot: "cpu", brand: "Intel", name: "Intel Core i7-9700F", slug: "cpu-intel-i7-9700f", short: "8 nhân / 8 luồng, gen 9", spec: { socket: "LGA1151", tdp_w: 65, extras: { cores: 8, threads: 8, generation: 9, series: "i7" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i7-10700F", slug: "cpu-intel-i7-10700f", short: "8 nhân / 16 luồng, gen 10", spec: { socket: "LGA1200", tdp_w: 65, extras: { cores: 8, threads: 16, generation: 10, series: "i7" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i7-11700F", slug: "cpu-intel-i7-11700f", short: "8 nhân / 16 luồng, gen 11", spec: { socket: "LGA1200", tdp_w: 65, extras: { cores: 8, threads: 16, generation: 11, series: "i7" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i7-12700F", slug: "cpu-intel-i7-12700f", short: "12 nhân / 20 luồng, gen 12", spec: { socket: "LGA1700", tdp_w: 65, extras: { cores: 12, threads: 20, generation: 12, series: "i7" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i7-13700F", slug: "cpu-intel-i7-13700f", short: "16 nhân / 24 luồng, gen 13", spec: { socket: "LGA1700", tdp_w: 65, extras: { cores: 16, threads: 24, generation: 13, series: "i7" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i7-14700F", slug: "cpu-intel-i7-14700f", short: "20 nhân / 28 luồng, gen 14", spec: { socket: "LGA1700", tdp_w: 65, extras: { cores: 20, threads: 28, generation: 14, series: "i7" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i7-14700K", slug: "cpu-intel-i7-14700k", short: "20 nhân / 28 luồng, gen 14 unlocked", spec: { socket: "LGA1700", tdp_w: 125, extras: { cores: 20, threads: 28, generation: 14, series: "i7" } } },

  { slot: "cpu", brand: "Intel", name: "Intel Core i9-9900K", slug: "cpu-intel-i9-9900k", short: "8 nhân / 16 luồng, gen 9", spec: { socket: "LGA1151", tdp_w: 95, extras: { cores: 8, threads: 16, generation: 9, series: "i9" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i9-10900K", slug: "cpu-intel-i9-10900k", short: "10 nhân / 20 luồng, gen 10", spec: { socket: "LGA1200", tdp_w: 125, extras: { cores: 10, threads: 20, generation: 10, series: "i9" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i9-11900K", slug: "cpu-intel-i9-11900k", short: "8 nhân / 16 luồng, gen 11", spec: { socket: "LGA1200", tdp_w: 125, extras: { cores: 8, threads: 16, generation: 11, series: "i9" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i9-12900K", slug: "cpu-intel-i9-12900k", short: "16 nhân / 24 luồng, gen 12", spec: { socket: "LGA1700", tdp_w: 125, extras: { cores: 16, threads: 24, generation: 12, series: "i9" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i9-13900K", slug: "cpu-intel-i9-13900k", short: "24 nhân / 32 luồng, gen 13", spec: { socket: "LGA1700", tdp_w: 125, extras: { cores: 24, threads: 32, generation: 13, series: "i9" } } },
  { slot: "cpu", brand: "Intel", name: "Intel Core i9-14900K", slug: "cpu-intel-i9-14900k", short: "24 nhân / 32 luồng, gen 14", spec: { socket: "LGA1700", tdp_w: 125, extras: { cores: 24, threads: 32, generation: 14, series: "i9" } } },

  // ===== AMD CPU =====
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 3 3100", slug: "cpu-amd-ryzen-3-3100", short: "4 nhân / 8 luồng, Zen 2", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 4, threads: 8, series: "Ryzen 3" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 3 4100", slug: "cpu-amd-ryzen-3-4100", short: "4 nhân / 8 luồng, Zen 2", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 4, threads: 8, series: "Ryzen 3" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 5 3600", slug: "cpu-amd-ryzen-5-3600", short: "6 nhân / 12 luồng, Zen 2", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 6, threads: 12, series: "Ryzen 5" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 5 5500", slug: "cpu-amd-ryzen-5-5500", short: "6 nhân / 12 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 6, threads: 12, series: "Ryzen 5" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 5 5600", slug: "cpu-amd-ryzen-5-5600", short: "6 nhân / 12 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 6, threads: 12, series: "Ryzen 5" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 5 5600X", slug: "cpu-amd-ryzen-5-5600x", short: "6 nhân / 12 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 6, threads: 12, series: "Ryzen 5" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 5 7600", slug: "cpu-amd-ryzen-5-7600", short: "6 nhân / 12 luồng, Zen 4", spec: { socket: "AM5", tdp_w: 65, extras: { cores: 6, threads: 12, series: "Ryzen 5" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 5 7600X", slug: "cpu-amd-ryzen-5-7600x", short: "6 nhân / 12 luồng, Zen 4", spec: { socket: "AM5", tdp_w: 105, extras: { cores: 6, threads: 12, series: "Ryzen 5" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 7 3700X", slug: "cpu-amd-ryzen-7-3700x", short: "8 nhân / 16 luồng, Zen 2", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 8, threads: 16, series: "Ryzen 7" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 7 5700X", slug: "cpu-amd-ryzen-7-5700x", short: "8 nhân / 16 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 65, extras: { cores: 8, threads: 16, series: "Ryzen 7" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 7 5800X", slug: "cpu-amd-ryzen-7-5800x", short: "8 nhân / 16 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 105, extras: { cores: 8, threads: 16, series: "Ryzen 7" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 7 7700", slug: "cpu-amd-ryzen-7-7700", short: "8 nhân / 16 luồng, Zen 4", spec: { socket: "AM5", tdp_w: 65, extras: { cores: 8, threads: 16, series: "Ryzen 7" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 7 7700X", slug: "cpu-amd-ryzen-7-7700x", short: "8 nhân / 16 luồng, Zen 4", spec: { socket: "AM5", tdp_w: 105, extras: { cores: 8, threads: 16, series: "Ryzen 7" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 9 3900X", slug: "cpu-amd-ryzen-9-3900x", short: "12 nhân / 24 luồng, Zen 2", spec: { socket: "AM4", tdp_w: 105, extras: { cores: 12, threads: 24, series: "Ryzen 9" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 9 5900X", slug: "cpu-amd-ryzen-9-5900x", short: "12 nhân / 24 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 105, extras: { cores: 12, threads: 24, series: "Ryzen 9" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 9 5950X", slug: "cpu-amd-ryzen-9-5950x", short: "16 nhân / 32 luồng, Zen 3", spec: { socket: "AM4", tdp_w: 105, extras: { cores: 16, threads: 32, series: "Ryzen 9" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 9 7900X", slug: "cpu-amd-ryzen-9-7900x", short: "12 nhân / 24 luồng, Zen 4", spec: { socket: "AM5", tdp_w: 170, extras: { cores: 12, threads: 24, series: "Ryzen 9" } } },
  { slot: "cpu", brand: "AMD", name: "AMD Ryzen 9 7950X", slug: "cpu-amd-ryzen-9-7950x", short: "16 nhân / 32 luồng, Zen 4", spec: { socket: "AM5", tdp_w: 170, extras: { cores: 16, threads: 32, series: "Ryzen 9" } } },

  // ===== GPU từ GTX 1650 trở lên =====
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce GTX 1650 4GB", slug: "gpu-gtx-1650-4gb", short: "Entry gaming 1080p", spec: { tdp_w: 75, length_mm: 170, extras: { vram_gb: 4, series: "GTX 1650" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce GTX 1650 Super 4GB", slug: "gpu-gtx-1650-super-4gb", short: "Entry+ 1080p", spec: { tdp_w: 100, length_mm: 180, extras: { vram_gb: 4, series: "GTX 1650 Super" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce GTX 1660 6GB", slug: "gpu-gtx-1660-6gb", short: "1080p gaming", spec: { tdp_w: 120, length_mm: 220, extras: { vram_gb: 6, series: "GTX 1660" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce GTX 1660 Super 6GB", slug: "gpu-gtx-1660-super-6gb", short: "1080p high", spec: { tdp_w: 125, length_mm: 230, extras: { vram_gb: 6, series: "GTX 1660 Super" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce GTX 1660 Ti 6GB", slug: "gpu-gtx-1660-ti-6gb", short: "1080p high", spec: { tdp_w: 120, length_mm: 230, extras: { vram_gb: 6, series: "GTX 1660 Ti" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 2060 6GB", slug: "gpu-rtx-2060-6gb", short: "Ray tracing entry", spec: { tdp_w: 160, length_mm: 240, extras: { vram_gb: 6, series: "RTX 2060" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 3060 12GB", slug: "gpu-rtx-3060-12gb", short: "1080p/1440p phổ biến", spec: { tdp_w: 170, length_mm: 242, extras: { vram_gb: 12, series: "RTX 3060" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 3060 Ti 8GB", slug: "gpu-rtx-3060-ti-8gb", short: "1440p gaming", spec: { tdp_w: 200, length_mm: 242, extras: { vram_gb: 8, series: "RTX 3060 Ti" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 3070 8GB", slug: "gpu-rtx-3070-8gb", short: "1440p high", spec: { tdp_w: 220, length_mm: 242, extras: { vram_gb: 8, series: "RTX 3070" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 4060 8GB", slug: "gpu-rtx-4060-8gb", short: "1080p/1440p hiệu năng/watt tốt", spec: { tdp_w: 115, length_mm: 240, extras: { vram_gb: 8, series: "RTX 4060" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 4060 Ti 8GB", slug: "gpu-rtx-4060-ti-8gb", short: "1440p", spec: { tdp_w: 160, length_mm: 240, extras: { vram_gb: 8, series: "RTX 4060 Ti" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 4070 12GB", slug: "gpu-rtx-4070-12gb", short: "1440p cao cấp", spec: { tdp_w: 200, length_mm: 285, extras: { vram_gb: 12, series: "RTX 4070" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 4070 Super 12GB", slug: "gpu-rtx-4070-super-12gb", short: "1440p/4K nhẹ", spec: { tdp_w: 220, length_mm: 285, extras: { vram_gb: 12, series: "RTX 4070 Super" } } },
  { slot: "gpu", brand: "NVIDIA", name: "NVIDIA GeForce RTX 4080 16GB", slug: "gpu-rtx-4080-16gb", short: "4K gaming", spec: { tdp_w: 320, length_mm: 304, extras: { vram_gb: 16, series: "RTX 4080" } } },
  { slot: "gpu", brand: "AMD", name: "AMD Radeon RX 6600 8GB", slug: "gpu-rx-6600-8gb", short: "1080p AMD", spec: { tdp_w: 132, length_mm: 190, extras: { vram_gb: 8, series: "RX 6600" } } },
  { slot: "gpu", brand: "AMD", name: "AMD Radeon RX 6700 XT 12GB", slug: "gpu-rx-6700-xt-12gb", short: "1440p AMD", spec: { tdp_w: 230, length_mm: 267, extras: { vram_gb: 12, series: "RX 6700 XT" } } },
  { slot: "gpu", brand: "AMD", name: "AMD Radeon RX 7600 8GB", slug: "gpu-rx-7600-8gb", short: "1080p/1440p AMD mới", spec: { tdp_w: 165, length_mm: 204, extras: { vram_gb: 8, series: "RX 7600" } } },
  { slot: "gpu", brand: "AMD", name: "AMD Radeon RX 7700 XT 12GB", slug: "gpu-rx-7700-xt-12gb", short: "1440p AMD", spec: { tdp_w: 245, length_mm: 267, extras: { vram_gb: 12, series: "RX 7700 XT" } } },
  { slot: "gpu", brand: "AMD", name: "AMD Radeon RX 7800 XT 16GB", slug: "gpu-rx-7800-xt-16gb", short: "1440p/4K AMD", spec: { tdp_w: 263, length_mm: 267, extras: { vram_gb: 16, series: "RX 7800 XT" } } },

  // ===== RAM phổ biến =====
  { slot: "ram", brand: "Corsair", name: "Corsair Vengeance LPX 8GB DDR4-3200", slug: "ram-corsair-lpx-8gb-ddr4-3200", short: "1x8GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 8, speed_mhz: 3200, modules: 1 } } },
  { slot: "ram", brand: "Corsair", name: "Corsair Vengeance LPX 16GB (2x8) DDR4-3200", slug: "ram-corsair-lpx-16gb-ddr4-3200", short: "Kit 16GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 16, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "Corsair", name: "Corsair Vengeance LPX 32GB (2x16) DDR4-3200", slug: "ram-corsair-lpx-32gb-ddr4-3200", short: "Kit 32GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 32, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "Corsair", name: "Corsair Vengeance 16GB (2x8) DDR5-5600", slug: "ram-corsair-vengeance-16gb-ddr5-5600", short: "Kit 16GB DDR5", spec: { ram_type: "DDR5", extras: { capacity_gb: 16, speed_mhz: 5600, modules: 2 } } },
  { slot: "ram", brand: "Corsair", name: "Corsair Vengeance 32GB (2x16) DDR5-5600", slug: "ram-corsair-vengeance-32gb-ddr5-5600", short: "Kit 32GB DDR5", spec: { ram_type: "DDR5", extras: { capacity_gb: 32, speed_mhz: 5600, modules: 2 } } },
  { slot: "ram", brand: "Kingston", name: "Kingston Fury Beast 8GB DDR4-3200", slug: "ram-kingston-fury-8gb-ddr4-3200", short: "1x8GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 8, speed_mhz: 3200, modules: 1 } } },
  { slot: "ram", brand: "Kingston", name: "Kingston Fury Beast 16GB (2x8) DDR4-3200", slug: "ram-kingston-fury-16gb-ddr4-3200", short: "Kit 16GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 16, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "Kingston", name: "Kingston Fury Beast 32GB (2x16) DDR4-3200", slug: "ram-kingston-fury-32gb-ddr4-3200", short: "Kit 32GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 32, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "Kingston", name: "Kingston Fury Beast 16GB (2x8) DDR5-5600", slug: "ram-kingston-fury-16gb-ddr5-5600", short: "Kit 16GB DDR5", spec: { ram_type: "DDR5", extras: { capacity_gb: 16, speed_mhz: 5600, modules: 2 } } },
  { slot: "ram", brand: "Kingston", name: "Kingston Fury Beast 32GB (2x16) DDR5-6000", slug: "ram-kingston-fury-32gb-ddr5-6000", short: "Kit 32GB DDR5", spec: { ram_type: "DDR5", extras: { capacity_gb: 32, speed_mhz: 6000, modules: 2 } } },
  { slot: "ram", brand: "Samsung", name: "Samsung DDR4 8GB-3200", slug: "ram-samsung-8gb-ddr4-3200", short: "OEM / desktop DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 8, speed_mhz: 3200, modules: 1 } } },
  { slot: "ram", brand: "Samsung", name: "Samsung DDR4 16GB-3200", slug: "ram-samsung-16gb-ddr4-3200", short: "OEM / desktop DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 16, speed_mhz: 3200, modules: 1 } } },
  { slot: "ram", brand: "Samsung", name: "Samsung DDR5 16GB-5600", slug: "ram-samsung-16gb-ddr5-5600", short: "OEM / desktop DDR5", spec: { ram_type: "DDR5", extras: { capacity_gb: 16, speed_mhz: 5600, modules: 1 } } },
  { slot: "ram", brand: "Crucial", name: "Crucial DDR4 16GB (2x8) 3200", slug: "ram-crucial-16gb-ddr4-3200", short: "Kit 16GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 16, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "Crucial", name: "Crucial Pro DDR5 32GB (2x16) 5600", slug: "ram-crucial-pro-32gb-ddr5-5600", short: "Kit 32GB DDR5", spec: { ram_type: "DDR5", extras: { capacity_gb: 32, speed_mhz: 5600, modules: 2 } } },
  { slot: "ram", brand: "G.Skill", name: "G.Skill Ripjaws V 16GB (2x8) DDR4-3200", slug: "ram-gskill-ripjaws-16gb-ddr4-3200", short: "Kit 16GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 16, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "G.Skill", name: "G.Skill Trident Z5 32GB (2x16) DDR5-6000", slug: "ram-gskill-trident-z5-32gb-ddr5-6000", short: "Kit 32GB DDR5 RGB", spec: { ram_type: "DDR5", extras: { capacity_gb: 32, speed_mhz: 6000, modules: 2 } } },
  { slot: "ram", brand: "TeamGroup", name: "TeamGroup T-Force Vulcan Z 16GB (2x8) DDR4-3200", slug: "ram-teamgroup-vulcan-16gb-ddr4-3200", short: "Kit 16GB DDR4", spec: { ram_type: "DDR4", extras: { capacity_gb: 16, speed_mhz: 3200, modules: 2 } } },
  { slot: "ram", brand: "TeamGroup", name: "TeamGroup T-Force Delta RGB 32GB (2x16) DDR5-6000", slug: "ram-teamgroup-delta-32gb-ddr5-6000", short: "Kit 32GB DDR5 RGB", spec: { ram_type: "DDR5", extras: { capacity_gb: 32, speed_mhz: 6000, modules: 2 } } },

  // ===== SSD phổ biến =====
  { slot: "ssd", brand: "Samsung", name: "Samsung 980 500GB NVMe", slug: "ssd-samsung-980-500gb", short: "NVMe PCIe 3.0", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 500, pcie: 3 } } },
  { slot: "ssd", brand: "Samsung", name: "Samsung 980 1TB NVMe", slug: "ssd-samsung-980-1tb", short: "NVMe PCIe 3.0", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 3 } } },
  { slot: "ssd", brand: "Samsung", name: "Samsung 990 EVO 1TB NVMe", slug: "ssd-samsung-990-evo-1tb", short: "NVMe PCIe 4.0/5.0", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "Samsung", name: "Samsung 990 PRO 1TB NVMe", slug: "ssd-samsung-990-pro-1tb", short: "NVMe PCIe 4.0 cao cấp", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "Samsung", name: "Samsung 990 PRO 2TB NVMe", slug: "ssd-samsung-990-pro-2tb", short: "NVMe PCIe 4.0 cao cấp", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 2000, pcie: 4 } } },
  { slot: "ssd", brand: "WD", name: "WD Blue SN580 500GB NVMe", slug: "ssd-wd-sn580-500gb", short: "NVMe PCIe 4.0 phổ thông", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 500, pcie: 4 } } },
  { slot: "ssd", brand: "WD", name: "WD Black SN770 1TB NVMe", slug: "ssd-wd-sn770-1tb", short: "NVMe PCIe 4.0", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "WD", name: "WD Black SN850X 1TB NVMe", slug: "ssd-wd-sn850x-1tb", short: "NVMe PCIe 4.0 gaming", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "WD", name: "WD Black SN850X 2TB NVMe", slug: "ssd-wd-sn850x-2tb", short: "NVMe PCIe 4.0 gaming", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 2000, pcie: 4 } } },
  { slot: "ssd", brand: "Kingston", name: "Kingston NV2 500GB NVMe", slug: "ssd-kingston-nv2-500gb", short: "NVMe giá tốt", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 500, pcie: 4 } } },
  { slot: "ssd", brand: "Kingston", name: "Kingston NV2 1TB NVMe", slug: "ssd-kingston-nv2-1tb", short: "NVMe giá tốt", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "Kingston", name: "Kingston NV3 1TB NVMe", slug: "ssd-kingston-nv3-1tb", short: "NVMe PCIe 4.0", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "Crucial", name: "Crucial P3 500GB NVMe", slug: "ssd-crucial-p3-500gb", short: "NVMe phổ thông", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 500, pcie: 3 } } },
  { slot: "ssd", brand: "Crucial", name: "Crucial P3 Plus 1TB NVMe", slug: "ssd-crucial-p3-plus-1tb", short: "NVMe PCIe 4.0", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "Crucial", name: "Crucial T500 1TB NVMe", slug: "ssd-crucial-t500-1tb", short: "NVMe PCIe 4.0 cao cấp", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 4 } } },
  { slot: "ssd", brand: "Lexar", name: "Lexar NM620 512GB NVMe", slug: "ssd-lexar-nm620-512gb", short: "NVMe phổ biến", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 512, pcie: 3 } } },
  { slot: "ssd", brand: "Lexar", name: "Lexar NM620 1TB NVMe", slug: "ssd-lexar-nm620-1tb", short: "NVMe phổ biến", spec: { storage_interface: "NVMe", form_factor: "M.2 2280", extras: { capacity_gb: 1000, pcie: 3 } } },
  { slot: "ssd", brand: "Samsung", name: "Samsung 870 EVO 500GB SATA", slug: "ssd-samsung-870-evo-500gb", short: "SATA 2.5\"", spec: { storage_interface: "SATA", form_factor: "2.5 inch", extras: { capacity_gb: 500 } } },
  { slot: "ssd", brand: "Samsung", name: "Samsung 870 EVO 1TB SATA", slug: "ssd-samsung-870-evo-1tb", short: "SATA 2.5\"", spec: { storage_interface: "SATA", form_factor: "2.5 inch", extras: { capacity_gb: 1000 } } },
  { slot: "ssd", brand: "Crucial", name: "Crucial BX500 480GB SATA", slug: "ssd-crucial-bx500-480gb", short: "SATA 2.5\" giá rẻ", spec: { storage_interface: "SATA", form_factor: "2.5 inch", extras: { capacity_gb: 480 } } },
  { slot: "ssd", brand: "Kingston", name: "Kingston A400 480GB SATA", slug: "ssd-kingston-a400-480gb", short: "SATA 2.5\" phổ thông", spec: { storage_interface: "SATA", form_factor: "2.5 inch", extras: { capacity_gb: 480 } } },
];

function slugify(name) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

async function ensureBrand(orgId, name) {
  const slug = slugify(name);
  const { data: existing } = await sb
    .from("brands")
    .select("id,name")
    .eq("organization_id", orgId)
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return existing.id;

  const { data: byName } = await sb
    .from("brands")
    .select("id")
    .eq("organization_id", orgId)
    .ilike("name", name)
    .maybeSingle();
  if (byName) return byName.id;

  const { data, error } = await sb
    .from("brands")
    .insert({ organization_id: orgId, name, slug, show_on_homepage: false })
    .select("id")
    .single();
  if (error) throw Object.assign(error, { context: `brand ${name}` });
  return data.id;
}

async function ensureCategory(orgId, { name, slug, parentId = null, position = 0 }) {
  let q = sb
    .from("categories")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", slug);
  const { data: existing } = await q.maybeSingle();
  if (existing) {
    // Đảm bảo gắn đúng parent nếu trước đó bị orphan
    if (parentId) {
      await sb.from("categories").update({ parent_id: parentId, name, position }).eq("id", existing.id);
    }
    return existing.id;
  }
  const { data, error } = await sb
    .from("categories")
    .insert({
      organization_id: orgId,
      name,
      slug,
      parent_id: parentId,
      position,
    })
    .select("id")
    .single();
  if (error) throw Object.assign(error, { context: `category ${slug}` });
  return data.id;
}

async function ensureProduct(orgId, part, categoryId, brandId) {
  const { data: existing } = await sb
    .from("products")
    .select("id")
    .eq("organization_id", orgId)
    .eq("slug", part.slug)
    .maybeSingle();

  let productId = existing?.id ?? null;
  let created = false;

  if (!productId) {
    const { data, error } = await sb
      .from("products")
      .insert({
        organization_id: orgId,
        name: part.name,
        slug: part.slug,
        category_id: categoryId,
        brand_id: brandId,
        status: "active",
        short_description: part.short ?? null,
        tags: ["pc-parts", part.slot, "tham-khao"],
        is_new: true,
      })
      .select("id")
      .single();
    if (error) throw Object.assign(error, { context: `product ${part.slug}` });
    productId = data.id;
    created = true;
  } else {
    await sb
      .from("products")
      .update({
        name: part.name,
        category_id: categoryId,
        brand_id: brandId,
        status: "active",
        short_description: part.short ?? null,
        tags: ["pc-parts", part.slot, "tham-khao"],
      })
      .eq("id", productId);
  }

  // Variant mặc định — giá 0 (chỉ tham khảo)
  const { data: variant } = await sb
    .from("product_variants")
    .select("id")
    .eq("product_id", productId)
    .eq("is_active", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!variant) {
    const sku = part.slug.toUpperCase().replace(/[^A-Z0-9]+/g, "-").slice(0, 40);
    const { error: vErr } = await sb.from("product_variants").insert({
      product_id: productId,
      sku,
      name: "Mặc định",
      selling_price: 0,
      cost_price: 0,
      is_active: true,
    });
    if (vErr) throw Object.assign(vErr, { context: `variant ${part.slug}` });
  }

  // Spec cho PC Builder
  const { error: sErr } = await sb.from("pc_components_specs").upsert(
    {
      product_id: productId,
      category_slug: part.slot,
      socket: part.spec.socket ?? null,
      ram_type: part.spec.ram_type ?? null,
      form_factor: part.spec.form_factor ?? null,
      tdp_w: part.spec.tdp_w ?? null,
      length_mm: part.spec.length_mm ?? null,
      wattage_w: part.spec.wattage_w ?? null,
      storage_interface: part.spec.storage_interface ?? null,
      extras: part.spec.extras ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "product_id" },
  );
  if (sErr) throw Object.assign(sErr, { context: `spec ${part.slug}` });

  return { productId, created };
}

async function main() {
  console.log("=== Seed linh kiện PC (CPU / GPU / RAM / SSD) ===");

  const { data: org, error: orgErr } = await sb
    .from("organizations")
    .select("id")
    .eq("code", ORG_CODE)
    .maybeSingle();
  if (orgErr) throw orgErr;
  if (!org) throw new Error(`Chưa có organization ${ORG_CODE}`);
  const orgId = org.id;
  console.log("org", orgId);

  // Brands
  const brandIds = {};
  for (const name of BRANDS) {
    brandIds[name] = await ensureBrand(orgId, name);
  }
  console.log(`✓ brands: ${Object.keys(brandIds).length}`);

  // Categories
  const pcPartsId = await ensureCategory(orgId, {
    name: "Linh kiện PC",
    slug: "pc-parts",
    parentId: null,
    position: 50,
  });
  const catIds = {};
  for (const c of CHILD_CATEGORIES) {
    catIds[c.slug] = await ensureCategory(orgId, {
      name: c.name,
      slug: c.slug,
      parentId: pcPartsId,
      position: c.position,
    });
  }
  console.log(`✓ categories: pc-parts + ${Object.keys(catIds).length} con`);

  let created = 0;
  let updated = 0;
  const bySlot = { cpu: 0, gpu: 0, ram: 0, ssd: 0 };

  for (const part of PARTS) {
    const brandId = brandIds[part.brand];
    if (!brandId) throw new Error(`Thiếu brand ${part.brand}`);
    const categoryId = catIds[part.slot];
    if (!categoryId) throw new Error(`Thiếu category ${part.slot}`);
    const res = await ensureProduct(orgId, part, categoryId, brandId);
    if (res.created) created += 1;
    else updated += 1;
    bySlot[part.slot] += 1;
    process.stdout.write(".");
  }
  console.log("");
  console.log("════════════════════════════════════════");
  console.log(`✓ Xong — tạo mới ${created}, cập nhật ${updated}`);
  console.log(`  CPU ${bySlot.cpu} | GPU ${bySlot.gpu} | RAM ${bySlot.ram} | SSD ${bySlot.ssd}`);
  console.log("════════════════════════════════════════");
}

main().catch((e) => {
  console.error("✗", e.context || "", e.message || e);
  process.exit(1);
});
