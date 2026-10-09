"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ZoomIn,
  ChevronLeft,
  ChevronRight,
  Flame,
  Sparkles,
  Image as ImageIcon,
  Eye,
} from "lucide-react";
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
  const [loaded, setLoaded] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  // Spotlight that follows the mouse inside the gallery hero.
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * 100;
    const my = ((e.clientY - rect.top) / rect.height) * 100;
    el.style.setProperty("--mx", `${mx}%`);
    el.style.setProperty("--my", `${my}%`);
  }, []);

  // Keyboard nav: ← / →
  useEffect(() => {
    if (open) return;
    const handler = (e: KeyboardEvent) => {
      if (!images.length) return;
      if (e.key === "ArrowLeft") {
        setIndex((i) => (i - 1 + images.length) % images.length);
      } else if (e.key === "ArrowRight") {
        setIndex((i) => (i + 1) % images.length);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [images.length, open]);

  if (!images.length) {
    return (
      <div className="flex aspect-square items-center justify-center rounded-2xl border bg-muted">
        <span className="text-muted-foreground">Chưa có ảnh</span>
      </div>
    );
  }

  const current = images[index];
  const slides = images.map((img) => ({ src: img.url, alt: img.alt }));
  const isFirst = index === 0;
  const isLast = index === images.length - 1;

  return (
    <>
      <div
        ref={galleryRef}
        onMouseMove={onMouseMove}
        className="group relative aspect-[4/3] cursor-zoom-in overflow-hidden rounded-2xl border bg-gradient-to-br from-muted/40 via-background to-muted/30 shadow-sm sm:aspect-square"
      >
        {/* Animated gradient background that pans */}
        <div className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100">
          <div className="absolute inset-0 animate-gradient-pan bg-gradient-to-br from-primary/5 via-fuchsia-500/5 to-rose-500/5" />
        </div>

        {/* Floating decorative blobs */}
        <div className="pointer-events-none absolute -left-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl transition-all duration-700 group-hover:scale-125 group-hover:bg-primary/15" />
        <div className="pointer-events-none absolute -right-12 -bottom-12 h-40 w-40 rounded-full bg-fuchsia-500/10 blur-3xl transition-all duration-700 group-hover:scale-125" />

        {/* Main image with smooth swap */}
        <div
          className="spotlight relative h-full w-full"
          onClick={() => setOpen(true)}
        >
          {images.map((img, idx) => (
            <Image
              key={img.url}
              src={img.url}
              alt={img.alt}
              fill
              priority={idx === 0}
              quality={95}
              sizes="(max-width: 768px) 100vw, 50vw"
              onLoad={() => idx === 0 && setLoaded(true)}
              className={cn(
                "object-contain p-6 transition-all duration-700 ease-out sm:p-8",
                idx === index
                  ? "opacity-100 scale-100"
                  : "opacity-0 scale-105 pointer-events-none",
                "group-hover:[&[data-active=true]]:scale-110",
              )}
              data-active={idx === index}
            />
          ))}

          {/* Skeleton while loading */}
          {!loaded && (
            <div className="absolute inset-0 m-6 animate-shimmer rounded-xl sm:m-8" />
          )}

          {/* Hover zoom CTA */}
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-transparent transition-colors group-hover:bg-foreground/[0.02]">
            <div className="flex translate-y-2 items-center gap-2 rounded-full bg-background/90 px-4 py-2 text-sm font-medium text-foreground opacity-0 shadow-lg ring-1 ring-border backdrop-blur-md transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
              <ZoomIn className="h-4 w-4" />
              <span>Phóng to</span>
            </div>
          </div>
        </div>

        {/* Top-left decorative badge — rotating "HOT" style */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 sm:left-4 sm:top-4">
          <div className="animate-badge-flip">
            <div className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-rose-500 via-red-500 to-orange-500 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider text-white shadow-md sm:px-3 sm:text-xs">
              <Flame className="h-3 w-3" />
              Hot
            </div>
          </div>
        </div>

        {/* Top-right — image counter badge */}
        <div className="absolute right-3 top-3 z-20 sm:right-4 sm:top-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-background/90 px-2.5 py-1 text-xs font-semibold text-foreground shadow-md ring-1 ring-border backdrop-blur-md">
            <ImageIcon className="h-3 w-3" />
            <span>
              {index + 1}<span className="text-muted-foreground">/{images.length}</span>
            </span>
          </div>
        </div>

        {/* Bottom-left — view count hint */}
        <div className="absolute bottom-3 left-3 z-20 sm:bottom-4 sm:left-4">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-background/85 px-2.5 py-1 text-[11px] font-medium text-muted-foreground shadow-sm ring-1 ring-border/60 backdrop-blur-sm">
            <Eye className="h-3 w-3" />
            <span>Ảnh thực tế</span>
          </div>
        </div>

        {/* Nav arrows (desktop) */}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i - 1 + images.length) % images.length);
              }}
              className={cn(
                "absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-md ring-1 ring-border backdrop-blur-md transition-all sm:left-4",
                isFirst
                  ? "opacity-0 group-hover:opacity-100"
                  : "opacity-0 group-hover:opacity-100 hover:scale-110",
              )}
              aria-label="Ảnh trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIndex((i) => (i + 1) % images.length);
              }}
              className={cn(
                "absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-background/90 p-2 text-foreground shadow-md ring-1 ring-border backdrop-blur-md transition-all sm:right-4",
                isLast
                  ? "opacity-0 group-hover:opacity-100"
                  : "opacity-0 group-hover:opacity-100 hover:scale-110",
              )}
              aria-label="Ảnh sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}

        {/* Dot indicators (mobile-first) */}
        {images.length > 1 && (
          <div className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 gap-1.5 sm:hidden">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex(idx);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300",
                  idx === index ? "w-6 bg-primary" : "w-1.5 bg-foreground/30 hover:bg-foreground/50",
                )}
                aria-label={`Ảnh ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {images.length > 1 && (
        <div className="mt-3 -mx-1 flex gap-2.5 overflow-x-auto px-1 pb-1 scrollbar-none sm:mt-4">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setIndex(idx)}
              className={cn(
                "relative h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-background transition-all duration-300 sm:h-20 sm:w-20",
                idx === index
                  ? "scale-105 border-primary shadow-md ring-2 ring-primary/20"
                  : "border-border opacity-60 hover:opacity-100 hover:border-primary/40",
              )}
            >
              <Image
                src={img.url}
                alt={`${productName} ${idx + 1}`}
                fill
                className="object-contain p-1.5"
                sizes="80px"
              />
              {idx === index && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-gradient-to-r from-primary to-fuchsia-500" />
              )}
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
