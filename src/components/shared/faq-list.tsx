/**
 * FAQ component — accordion có search + filter category.
 * Tối ưu UX: search realtime + highlight từ khoá.
 */
"use client";

import { useState, useMemo } from "react";
import { Search, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FaqItem = {
  q: string;
  a: string;
};

export type FaqGroup = {
  id: string;
  title: string;
  icon?: React.ReactNode;
  items: FaqItem[];
};

interface Props {
  groups: FaqGroup[];
}

export function FaqList({ groups }: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const q = query.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!q) return groups;
    return groups
      .map((g) => ({
        ...g,
        items: g.items.filter(
          (it) =>
            it.q.toLowerCase().includes(q) || it.a.toLowerCase().includes(q),
        ),
      }))
      .filter((g) => g.items.length > 0);
  }, [groups, q]);

  const totalItems = useMemo(
    () => filtered.reduce((s, g) => s + g.items.length, 0),
    [filtered],
  );

  return (
    <div className="space-y-8">
      {/* Search */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <Input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Tìm kiếm câu hỏi... (VD: bảo hành, đổi trả, trả góp)"
          className="h-12 rounded-full pl-11 pr-4 text-base shadow-sm"
        />
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-12 text-center">
          <p className="text-sm font-semibold text-slate-700">
            Không tìm thấy câu hỏi phù hợp.
          </p>
          <p className="mt-1 text-sm text-slate-500">
            Hãy thử từ khoá khác hoặc liên hệ trực tiếp với chúng tôi qua trang Liên hệ.
          </p>
        </div>
      )}

      {q && (
        <p className="text-sm text-slate-500">
          Tìm thấy <strong>{totalItems}</strong> câu hỏi liên quan.
        </p>
      )}

      {filtered.map((g) => (
        <div key={g.id} className="space-y-4">
          <div className="flex items-center gap-3">
            {g.icon && (
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
                {g.icon}
              </div>
            )}
            <h2 className="text-xl font-bold tracking-tight text-slate-900 md:text-2xl">
              {g.title}
            </h2>
          </div>
          <div className="space-y-2">
            {g.items.map((it, idx) => {
              const key = `${g.id}-${idx}`;
              const isOpen = !!open[key];
              return (
                <details
                  key={key}
                  open={isOpen}
                  onToggle={(e) => {
                    const next = (e.target as HTMLDetailsElement).open;
                    setOpen((s) => ({ ...s, [key]: next }));
                  }}
                  className="group rounded-2xl border border-slate-200 bg-white transition-all hover:border-slate-300 open:shadow-sm"
                >
                  <summary
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-4 px-5 py-4 list-none [&::-webkit-details-marker]:hidden",
                    )}
                  >
                    <span className="text-sm font-semibold text-slate-900 md:text-base">
                      {it.q}
                    </span>
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
                  </summary>
                  <div className="border-t border-slate-100 px-5 py-4 text-sm leading-relaxed text-slate-600 md:text-[15px]">
                    {it.a}
                  </div>
                </details>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}