"use client";

/**
 * Helper xuất PDF từ một DOM element (receipt).
 *
 * Dùng html2canvas để chụp element thành canvas → nhúng vào jsPDF.
 *
 * Lưu ý:
 *  - Phải gọi trong client component.
 *  - Element cần có `position: relative` và `background: white` để ảnh sạch.
 *  - File PDF xuất ra dạng A4 portrait, canh theo width.
 */

import html2canvas from "html2canvas";
import jsPDF from "jspdf";

export type PdfExportOptions = {
  /** Tên file xuất ra (không cần .pdf). */
  filename?: string;
  /** Margin quanh nội dung PDF, đơn vị mm. Mặc định 8. */
  marginMm?: number;
};

export async function exportElementToPdf(
  element: HTMLElement,
  options: PdfExportOptions = {},
): Promise<void> {
  const { filename = "phieu-cau-hinh-pc", marginMm = 8 } = options;

  // Đợi 1 frame để Tailwind/layout ổn định trước khi chụp.
  await new Promise<void>((r) => requestAnimationFrame(() => r()));

  const canvas = await html2canvas(element, {
    scale: 2, // tăng DPI cho PDF sắc nét
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
    // Tránh chụp các phần tử có class `print:hidden` bị Tailwind ẩn.
    // html2canvas vẫn thấy được DOM, nhưng nếu dùng `visibility: hidden` thì tốt hơn.
    windowWidth: element.scrollWidth,
    windowHeight: element.scrollHeight,
  });

  const imgData = canvas.toDataURL("image/png");

  // jsPDF đơn vị mm. Khổ A4 portrait: 210 x 297.
  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  const usableWidth = pageWidth - marginMm * 2;
  const usableHeight = pageHeight - marginMm * 2;

  // Tỉ lệ width ảnh theo chiều rộng khả dụng.
  const ratio = usableWidth / canvas.width;
  const imgHeightMm = canvas.height * ratio;

  if (imgHeightMm <= usableHeight) {
    pdf.addImage(imgData, "PNG", marginMm, marginMm, usableWidth, imgHeightMm);
  } else {
    // Nội dung dài — chia nhiều trang, cắt canvas theo từng phần.
    // Tính chiều cao canvas (px) tương ứng với 1 trang PDF.
    const pageHeightPx = usableHeight / ratio;
    let yOffsetPx = 0;
    let pageIndex = 0;

    while (yOffsetPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - yOffsetPx);

      const sliceCanvas = document.createElement("canvas");
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext("2d");
      if (!ctx) break;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
      ctx.drawImage(
        canvas,
        0,
        yOffsetPx,
        canvas.width,
        sliceHeightPx,
        0,
        0,
        canvas.width,
        sliceHeightPx,
      );

      const sliceImg = sliceCanvas.toDataURL("image/png");
      if (pageIndex > 0) pdf.addPage();
      pdf.addImage(
        sliceImg,
        "PNG",
        marginMm,
        marginMm,
        usableWidth,
        sliceHeightPx * ratio,
      );

      yOffsetPx += sliceHeightPx;
      pageIndex += 1;
    }
  }

  pdf.save(`${filename}.pdf`);
}
