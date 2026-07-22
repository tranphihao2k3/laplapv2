"use client";

import { useState } from "react";
import Image from "next/image";
import { ZoomIn } from "lucide-react";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import Counter from "yet-another-react-lightbox/plugins/counter";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";
import "yet-another-react-lightbox/plugins/counter.css";
import { cn } from "@/lib/utils";

type Props = {
  images: { url: string; alt: string }[];
  productName: string;
};

export function ProductGallery({ images, productName }: Props) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);

  if (!images.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-xl bg-muted">
        <span className="text-muted-foreground">Chưa có ảnh</span>
      </div>
    );
  }

  const current = images[index];
  const slides = images.map((img) => ({ src: img.url, alt: img.alt }));

  return (
    <>
      <div
        className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-xl border bg-white sm:aspect-square"
        onClick={() => setOpen(true)}
      >
        <Image
          src={current.url}
          alt={current.alt}
          fill
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(max-width: 768px) 100vw, 50vw"
          priority
          quality={100}
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition-colors group-hover:bg-black/5">
          <div className="rounded-full bg-background/90 p-2 opacity-0 shadow transition-opacity group-hover:opacity-100">
            <ZoomIn className="h-5 w-5" />
          </div>
        </div>
      </div>

      {images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setIndex(idx)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2 bg-white transition-colors",
                idx === index ? "border-primary" : "border-border hover:border-muted-foreground/40",
              )}
            >
              <Image src={img.url} alt={`${productName} ${idx + 1}`} fill className="object-contain p-1" sizes="64px" />
            </button>
          ))}
        </div>
      )}

      <Lightbox
        open={open}
        close={() => setOpen(false)}
        index={index}
        on={{ view: ({ index: i }) => setIndex(i) }}
        slides={slides}
        plugins={[Zoom, Thumbnails, Counter]}
        zoom={{ maxZoomPixelRatio: 3, scrollToZoom: true }}
        thumbnails={{ position: "bottom", width: 80, height: 60 }}
      />
    </>
  );
}
