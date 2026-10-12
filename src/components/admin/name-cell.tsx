"use client";

import { ReactNode } from "react";
import { useLookupMap, type EntityKind, type LookupEntry } from "@/lib/api/lookups";
import { IdCell } from "./table-cells";
import { cn } from "@/lib/utils";

type Props = {
  /** ID để resolve name. Nếu null/undefined sẽ hiển thị fallback. */
  id: string | null | undefined;
  /** Entity kind để lookup (vd "customers", "products") */
  kind: EntityKind;
  /** Nếu parent đã query sẵn name, truyền thẳng để tránh fetch lại. */
  name?: string | null;
  /** Hiển thị UUID ở dòng dưới name (mặc định true). */
  showId?: boolean;
  /** Text/JSX hiển thị khi không có id/name. */
  fallback?: ReactNode;
  /** Custom href — nếu không truyền sẽ tự build từ kind. */
  href?: string;
  className?: string;
};

/**
 * Cell hiển thị tên (resolve từ ID) + UUID ở dòng dưới.
 * Ưu tiên `name` prop nếu có, fallback tự động lookup qua useLookupMap.
 * Click tên sẽ mở link detail.
 */
export function NameCell({
  id,
  kind,
  name: preResolved,
  showId = true,
  fallback = "—",
  href,
  className,
}: Props) {
  // Nếu đã có name truyền sẵn thì khỏi lookup
  const lookup = useLookupMap(kind, preResolved ? [] : id ? [id] : []);
  const entry: LookupEntry | undefined =
    preResolved
      ? { name: preResolved, href }
      : id
        ? lookup.data?.get(id)
        : undefined;

  if (!id) {
    return <span className="text-muted-foreground italic">{fallback}</span>;
  }

  return (
    <div className={cn("min-w-0 leading-tight", className)}>
      {entry?.name ? (
        <a
          href={entry.href ?? href}
          className="font-medium hover:underline truncate block text-foreground"
          title={entry.name}
        >
          {entry.name}
        </a>
      ) : lookup.isLoading ? (
        <span className="text-muted-foreground italic text-xs">Đang tải…</span>
      ) : (
        <span className="text-muted-foreground italic text-xs">Không tìm thấy</span>
      )}
      {showId && <IdCell id={id} />}
    </div>
  );
}
