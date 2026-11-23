import { describe, expect, it } from "vitest";
import {
  hasAnyVariantSpecs,
  hasSpecs,
  normalizeSpecs,
  resolveVariantSpecs,
} from "./resolve-variant-specs";

describe("normalizeSpecs", () => {
  it("loại bỏ giá trị rỗng và giữ nguyên giá trị còn lại", () => {
    expect(normalizeSpecs({ cpu: "i5", ram: "   ", ssd: "" })).toEqual({ cpu: "i5" });
  });

  it("trả về object rỗng khi specs null / không phải object", () => {
    expect(normalizeSpecs(null)).toEqual({});
    expect(normalizeSpecs(undefined)).toEqual({});
  });

  it("chuyển số / boolean thành chuỗi", () => {
    expect(normalizeSpecs({ weight: 1.5, warranty: true })).toEqual({
      weight: "1.5",
      warranty: "true",
    });
  });
});

describe("hasSpecs", () => {
  it("true khi có ít nhất một giá trị không rỗng", () => {
    expect(hasSpecs({ cpu: "i5" })).toBe(true);
    expect(hasSpecs({ cpu: "  " })).toBe(false);
    expect(hasSpecs(null)).toBe(false);
  });
});

describe("hasAnyVariantSpecs", () => {
  it("true nếu có biến thể bất kỳ có thông số", () => {
    expect(hasAnyVariantSpecs([{ specs: null }, { specs: { cpu: "i7" } }])).toBe(true);
    expect(hasAnyVariantSpecs([{ specs: null }, { specs: {} }])).toBe(false);
  });
});

describe("resolveVariantSpecs", () => {
  const variants = [
    { specs: { cpu: "i5-1240P", ram: "16GB" } },
    { specs: { cpu: "i7-13620H", ram: "32GB" } },
  ];

  it("trả về specs riêng của biến thể đang chọn", () => {
    expect(resolveVariantSpecs(variants, 1)).toEqual({ cpu: "i7-13620H", ram: "32GB" });
    expect(resolveVariantSpecs(variants, 0)).toEqual({ cpu: "i5-1240P", ram: "16GB" });
  });

  it("fallback sang specs gộp khi biến thể đang chọn không có specs riêng", () => {
    const withEmpty = [{ specs: { cpu: "i5", ram: "16GB" } }, { specs: null }];
    expect(resolveVariantSpecs(withEmpty, 1)).toEqual({ cpu: "i5", ram: "16GB" });
  });

  it("gộp specs từ mọi biến thể khi không biến thể nào có specs riêng đầy đủ", () => {
    const partial = [{ specs: { cpu: "i5" } }, { specs: { ram: "16GB" } }];
    expect(resolveVariantSpecs(partial, 0)).toEqual({ cpu: "i5", ram: "16GB" });
  });

  it("trả về null khi không biến thể nào có thông số", () => {
    expect(resolveVariantSpecs([{ specs: null }, { specs: {} }], 0)).toBeNull();
  });

  it("trả về null khi danh sách biến thể rỗng", () => {
    expect(resolveVariantSpecs([], 0)).toBeNull();
  });
});
