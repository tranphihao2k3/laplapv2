/**
 * BlockRenderer — switch trên `block_type` để render component tương ứng.
 *
 * Extensible: thêm block mới chỉ cần:
 *  1. Thêm type vào `BlockType` union trong `lib/page-blocks.ts`.
 *  2. Tạo component mới trong folder này.
 *  3. Thêm case vào switch dưới đây.
 */

import { Heart } from "lucide-react";
import type { PageBlock } from "@/lib/page-blocks";
import { HeroBlock } from "./hero-block";
import { RichTextBlock } from "./richtext-block";

type Props = {
  blocks: PageBlock[];
};

export function BlockRenderer({ blocks }: Props) {
  if (blocks.length === 0) {
    return (
      <div className="container py-20 text-center text-sm text-muted-foreground">
        <Heart className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
        Trang này chưa có nội dung. Vào{" "}
        <span className="font-semibold text-foreground">/quanly/about-page</span>{" "}
        để thêm khối.
      </div>
    );
  }
  return (
    <>
      {blocks.map((b) => {
        switch (b.blockType) {
          case "hero":
            return <HeroBlock key={b.id} data={b.data} />;
          case "richtext":
            return <RichTextBlock key={b.id} data={b.data} />;
          default:
            return (
              <div
                key={b.id}
                className="container my-4 rounded border border-dashed border-amber-300 bg-amber-50 p-4 text-xs text-amber-800"
              >
                Block không xác định: <code>{b.blockType}</code>
              </div>
            );
        }
      })}
    </>
  );
}
