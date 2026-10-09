/**
 * Pure-function compatibility check giữa các linh kiện trong build.
 * Không I/O, không side-effect — chỉ nhận state + specs rồi trả về danh sách issue.
 *
 * Quy tắc (xem SPEC của task):
 *  - cpu + mainboard: socket phải khớp (error nếu lệch).
 *  - mainboard + ram: ram_type khả khớp (error nếu lệch).
 *  - mainboard + case: form_factor mainboard phải nằm trong case hỗ trợ (info nếu
 *    case.extras.supported_form_factors chứa mainboard.form_factor, error nếu ngược lại).
 *  - gpu + case: gpu.length_mm <= case.length_mm (warning nếu >).
 *  - cpu + gpu + psu: warning nếu psu.wattage_w < (cpu.tdp_w + gpu.tdp_w + 150W).
 *
 * Lưu ý: khi spec thiếu trường → bỏ qua rule đó (không phát sinh issue).
 */

import type {
  BuildState,
  CompatibilityIssue,
  ComponentSpecSummary,
  SlotKey,
} from "./types";

/** Lấy danh sách spec theo productId trong 1 slot (mặc định qty=1). */
function specsOf(
  state: BuildState,
  specs: Record<string, ComponentSpecSummary>,
  slot: SlotKey,
): ComponentSpecSummary[] {
  const items = state[slot] ?? [];
  const out: ComponentSpecSummary[] = [];
  for (const item of items) {
    const spec = specs[item.productId];
    if (spec) out.push(spec);
  }
  return out;
}

/** Lấy spec đầu tiên trong slot (hầu hết slot chỉ có 1 linh kiện). */
function firstSpec(
  state: BuildState,
  specs: Record<string, ComponentSpecSummary>,
  slot: SlotKey,
): ComponentSpecSummary | null {
  const list = specsOf(state, specs, slot);
  return list[0] ?? null;
}

/**
 * Đọc `supported_form_factors` từ `case.extras`.
 * Chấp nhận cả dạng string[] (case literal) và các alias phổ biến.
 */
function getSupportedFormFactors(spec: ComponentSpecSummary): string[] | null {
  const extras = spec.extras ?? null;
  if (!extras) return null;
  const raw =
    (extras.supported_form_factors as unknown) ??
    (extras.supportedFormFactors as unknown) ??
    (extras.supported_form_factor as unknown);
  if (Array.isArray(raw)) {
    return raw.filter((x): x is string => typeof x === "string");
  }
  return null;
}

export function checkCompatibility(
  build: BuildState,
  specs: Record<string, ComponentSpecSummary>,
): CompatibilityIssue[] {
  const issues: CompatibilityIssue[] = [];

  const cpu = firstSpec(build, specs, "cpu");
  const mainboard = firstSpec(build, specs, "mainboard");
  const ram = firstSpec(build, specs, "ram");
  const gpu = firstSpec(build, specs, "gpu");
  const psu = firstSpec(build, specs, "psu");
  const pcCase = firstSpec(build, specs, "case");

  // 1) cpu + mainboard: socket phải khớp
  if (cpu && mainboard && cpu.socket && mainboard.socket) {
    if (cpu.socket !== mainboard.socket) {
      issues.push({
        severity: "error",
        slot: "cpu",
        relatedSlot: "mainboard",
        message: `Socket CPU (${cpu.socket}) không khớp với mainboard (${mainboard.socket}).`,
      });
    }
  }

  // 2) mainboard + ram: ram_type khớp
  if (mainboard && ram && mainboard.ramType && ram.ramType) {
    if (mainboard.ramType !== ram.ramType) {
      issues.push({
        severity: "error",
        slot: "ram",
        relatedSlot: "mainboard",
        message: `RAM ${ram.ramType} không tương thích với mainboard (${mainboard.ramType}).`,
      });
    }
  }

  // 3) mainboard + case: form_factor mainboard nằm trong case hỗ trợ
  if (mainboard && pcCase && mainboard.formFactor) {
    const supported = getSupportedFormFactors(pcCase);
    if (supported && supported.length > 0) {
      const supported_norm = supported.map((s) => s.toUpperCase());
      const mf = mainboard.formFactor.toUpperCase();
      if (supported_norm.includes(mf)) {
        issues.push({
          severity: "info",
          slot: "mainboard",
          relatedSlot: "case",
          message: `Mainboard ${mainboard.formFactor} tương thích với case đã chọn.`,
        });
      } else {
        issues.push({
          severity: "error",
          slot: "case",
          relatedSlot: "mainboard",
          message: `Case không hỗ trợ mainboard ${mainboard.formFactor} (chỉ hỗ trợ: ${supported.join(
            ", ",
          )}).`,
        });
      }
    }
  }

  // 4) gpu + case: chiều dài GPU <= chiều dài tối đa của case
  if (gpu && pcCase && typeof gpu.lengthMm === "number" && typeof pcCase.lengthMm === "number") {
    if (gpu.lengthMm > pcCase.lengthMm) {
      issues.push({
        severity: "warning",
        slot: "gpu",
        relatedSlot: "case",
        message: `Card đồ họa dài ${gpu.lengthMm}mm có thể không lắp vừa case (tối đa ${pcCase.lengthMm}mm).`,
      });
    }
  }

  // 5) cpu + gpu + psu: warning nếu psu.wattage_w < (cpu.tdp_w + gpu.tdp_w + 150W)
  if (psu && typeof psu.wattageW === "number") {
    const cpuTdp = cpu && typeof cpu.tdpW === "number" ? cpu.tdpW : 0;
    const gpuTdp = gpu && typeof gpu.tdpW === "number" ? gpu.tdpW : 0;
    const required = cpuTdp + gpuTdp + 150;
    if (required > 0 && psu.wattageW < required) {
      issues.push({
        severity: "warning",
        slot: "psu",
        relatedSlot: cpuTdp > 0 && gpuTdp > 0 ? "cpu" : "gpu",
        message: `Nguồn ${psu.wattageW}W có thể không đủ (cần ≥ ${required}W với CPU + GPU hiện tại).`,
      });
    }
  }

  return issues;
}
