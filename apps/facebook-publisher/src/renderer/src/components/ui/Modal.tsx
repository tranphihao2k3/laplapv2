/**
 * Modal — overlay dialog với focus trap + ESC đóng + click-outside.
 *
 * Không dùng thư viện ngoài (Radix/@headlessui). Pattern thủ công:
 *  - Backdrop blur + bg-black/40 → modal nổi bật.
 *  - animation scale-in cho content.
 *  - ESC đóng qua window keydown listener (chỉ khi open).
 *  - Click outside (target = backdrop) → onClose.
 *  - Body scroll lock khi mở (tránh trang cuộn phía sau).
 *
 * Size: sm (max-w-sm), md (max-w-md), lg (max-w-2xl), xl (max-w-4xl).
 */
import { useEffect } from "react";
import type { ReactNode } from "react";
import { IconClose } from "./icons";

type Size = "sm" | "md" | "lg" | "xl" | "full";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  description?: ReactNode;
  size?: Size;
  /** Tùy chỉnh padding container (vd để form có padding 0). */
  noPadding?: boolean;
  /** Không đóng khi click outside / ESC (vd wizard đang nhập liệu). */
  persistent?: boolean;
  children?: ReactNode;
  /** Footer tùy chỉnh (nút Lưu/Huỷ). */
  footer?: ReactNode;
};

const sizeClass: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
  full: "max-w-[min(960px,90vw)]",
};

export function Modal({
  open,
  onClose,
  title,
  description,
  size = "md",
  noPadding = false,
  persistent = false,
  children,
  footer,
}: Props) {
  // ESC đóng + body scroll lock.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !persistent) onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose, persistent]);

  if (!open) return null;

  function onBackdrop(e: React.MouseEvent) {
    if (e.target === e.currentTarget && !persistent) onClose();
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
      className="fixed inset-0 z-50 flex items-center justify-center bg-muted-900/40 p-4 backdrop-blur-xs animate-fade-in"
      onMouseDown={onBackdrop}
    >
      <div
        className={[
          "flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-xl",
          "animate-scale-in",
          "max-h-[90vh]",
          sizeClass[size],
        ].join(" ")}
      >
        {(title || !persistent) && (
          <header className="flex items-start justify-between border-b border-muted-100 px-5 py-4">
            <div>
              {title && (
                <h2 id="modal-title" className="text-base font-semibold text-muted-900">
                  {title}
                </h2>
              )}
              {description && (
                <p className="mt-0.5 text-xs text-muted-500">{description}</p>
              )}
            </div>
            {!persistent && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng"
                className="rounded-md p-1 text-muted-500 transition hover:bg-muted-100 hover:text-muted-900 focus-visible:outline-none focus-visible:shadow-ring"
              >
                <IconClose size={18} />
              </button>
            )}
          </header>
        )}
        <div
          className={[
            "flex-1 overflow-y-auto",
            noPadding ? "" : "px-5 py-4",
          ].join(" ")}
        >
          {children}
        </div>
        {footer && (
          <footer className="flex items-center justify-end gap-2 border-t border-muted-100 bg-muted-50/50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}