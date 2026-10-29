"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  deriveVariantDraft,
  type VariantDraft,
  type VariantDraftField,
  type VariantDraftVariant,
} from "./variant-autofill";

const EMPTY_DRAFT: VariantDraft = {
  sku: "",
  name: "",
  sellingPrice: 0,
  costPrice: 0,
  initialStock: 0,
};

export type UseVariantDraftOptions = {
  /** Tên sản phẩm — dùng sinh SKU khi chưa có slug. */
  productName: string;
  /** Slug sản phẩm. */
  productSlug: string;
  /** "Giá bán nhanh" ở phần trên form. */
  quickPrice: number | "";
  /** "Tồn kho ban đầu" ở phần trên form. */
  quickStock: number | "";
  /** Biến thể đang có trong form (đã thêm hoặc đã tồn tại trong DB). */
  existingVariants: VariantDraftVariant[];
};

/**
 * Quản lý dòng nhập "biến thể" của form sản phẩm.
 *
 * - Tự động điền SKU / tên / giá bán / giá vốn / tồn kho dựa trên thông tin
 *   đã nhập ở phần trên form (tên sản phẩm, giá bán nhanh, tồn kho nhanh) và
 *   dựa trên biến thể vừa thêm.
 * - Ô nào người dùng đã sửa tay thì không bị tự động điền đè lên.
 * - Sau khi thêm một biến thể, dòng nhập được điền lại (SKU kế tiếp, giá vốn
 *   và tồn kho kế thừa từ biến thể vừa thêm) để thêm biến thể tiếp theo chỉ
 *   cần sửa phần khác nhau.
 */
export function useVariantDraft(options: UseVariantDraftOptions) {
  const [draft, setDraft] = useState<VariantDraft>(EMPTY_DRAFT);
  // Những field người dùng đã gõ tay → auto-fill không được đè lên.
  const manualFieldsRef = useRef<Set<VariantDraftField>>(new Set());

  const derived = useMemo(
    () =>
      deriveVariantDraft({
        productName: options.productName,
        productSlug: options.productSlug,
        quickPrice: options.quickPrice,
        quickStock: options.quickStock,
        existingVariants: options.existingVariants,
      }),
    [
      options.productName,
      options.productSlug,
      options.quickPrice,
      options.quickStock,
      options.existingVariants,
    ],
  );

  const sync = useCallback(() => {
    setDraft((prev) => {
      const next: VariantDraft = { ...prev };
      let changed = false;
      (Object.keys(derived) as VariantDraftField[]).forEach((field) => {
        if (manualFieldsRef.current.has(field)) return;
        if (prev[field] === derived[field]) return;
        // `field` là union của các key → gán theo index cần ép kiểu.
        (next as Record<VariantDraftField, string | number>)[field] = derived[field];
        changed = true;
      });
      return changed ? next : prev;
    });
  }, [derived]);

  // Đồng bộ khi thông tin nguồn bên trên form thay đổi (tên, slug, giá nhanh,
  // tồn nhanh) hoặc khi danh sách biến thể vừa thay đổi.
  useEffect(() => {
    sync();
  }, [sync]);

  /** Gán giá trị khi người dùng tự sửa một ô. */
  const setField = useCallback((field: VariantDraftField, value: string | number) => {
    manualFieldsRef.current.add(field);
    setDraft((prev) => ({ ...prev, [field]: value }) as VariantDraft);
  }, []);

  /** Bỏ dấu vết chỉnh sửa tay — các ô sẽ được tự động điền lại. */
  const clearManualEdits = useCallback(() => {
    manualFieldsRef.current.clear();
  }, []);

  /**
   * Bắt đầu lại dòng nhập cho biến thể tiếp theo: bỏ chỉnh sửa tay và nạp lại
   * giá trị tự động (SKU kế tiếp, giá vốn/tồn kho kế thừa biến thể trước).
   */
  const reset = useCallback(() => {
    manualFieldsRef.current.clear();
    setDraft(derived);
  }, [derived]);

  return { draft, setField, reset, clearManualEdits, derived };
}
