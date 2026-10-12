/**
 * Helper build file Excel (.xlsx) dùng chung cho 8 báo cáo.
 * - buildWorkbook: tạo workbook có 2 sheet (Tổng quan + Chi tiết), format sẵn
 * - excelResponse: wrap Buffer thành NextResponse với Content-Disposition
 *
 * Style áp dụng:
 * - Header row 1: bold + fill xanh FF1E40AF + text trắng
 * - Freeze row 1 cho cả 2 sheet
 * - Auto-filter toàn bảng chi tiết
 * - Cột money: format `#,##0`
 * - Cột date: format `dd/mm/yyyy`
 * - Cột datetime: format `dd/mm/yyyy hh:mm`
 * - Cột percent: format `0.00%`
 */
import ExcelJS from "exceljs";

export type ExcelColumnFormat = "money" | "date" | "datetime" | "number" | "percent" | "text";

export type ExcelColumn<T> = {
  /** Tiêu đề cột trong Excel */
  header: string;
  /** Key trong row object */
  key: keyof T | string;
  /** Độ rộng cột (mặc định 18) */
  width?: number;
  /** Format cell */
  format?: ExcelColumnFormat;
  /** Custom value transformer — trả về giá trị cell */
  transform?: (row: T) => unknown;
};

export type BuildWorkbookOpts<T> = {
  /** Tên file (chỉ để log server, không dùng cho response) */
  fileName: string;
  summarySheet: {
    title: string;
    /** Mỗi tuple [label, value] = 1 dòng trong sheet Tổng quan */
    rows: Array<[string, string | number]>;
  };
  detailSheet: {
    title: string;
    columns: ExcelColumn<T>[];
    rows: T[];
  };
  /** Locale cho định dạng tiền (mặc định "vi-VN") */
  locale?: string;
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF1E40AF" },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

function styleHeaderRow(row: ExcelJS.Row) {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: "middle", horizontal: "left" };
  row.height = 22;
}

function setNumberFormat(col: ExcelJS.Column, format?: ExcelColumnFormat) {
  if (!format) return;
  switch (format) {
    case "money":
      col.numFmt = "#,##0";
      col.alignment = { horizontal: "right" };
      break;
    case "date":
      col.numFmt = "dd/mm/yyyy";
      col.alignment = { horizontal: "center" };
      break;
    case "datetime":
      col.numFmt = "dd/mm/yyyy hh:mm";
      col.alignment = { horizontal: "center" };
      break;
    case "number":
      col.numFmt = "#,##0";
      col.alignment = { horizontal: "right" };
      break;
    case "percent":
      col.numFmt = "0.00%";
      col.alignment = { horizontal: "right" };
      break;
    case "text":
    default:
      col.alignment = { horizontal: "left", wrapText: true };
      break;
  }
}

/** Tạo workbook từ data + metadata, trả về Buffer. */
export async function buildWorkbook<T>(opts: BuildWorkbookOpts<T>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "LapLap Admin";
  wb.lastModifiedBy = "LapLap Admin";
  wb.created = new Date();
  wb.modified = new Date();

  // ===== Sheet 1: Tổng quan =====
  const sum = wb.addWorksheet(opts.summarySheet.title, {
    properties: { tabColor: { argb: "FF1E40AF" } },
  });
  sum.columns = [
    { header: "Chỉ tiêu", key: "label", width: 35 },
    { header: "Giá trị", key: "value", width: 28 },
  ];
  sum.addRows(opts.summarySheet.rows);
  styleHeaderRow(sum.getRow(1));
  // Format cột "Giá trị" — nếu là số thì áp dụng numFmt #,##0
  sum.getColumn("value").numFmt = "#,##0";
  sum.getColumn("value").alignment = { horizontal: "right" };
  sum.views = [{ state: "frozen", ySplit: 1 }];

  // ===== Sheet 2: Chi tiết =====
  const det = wb.addWorksheet(opts.detailSheet.title, {
    properties: { tabColor: { argb: "FF10B981" } },
  });
  det.columns = opts.detailSheet.columns.map((c) => ({
    header: c.header,
    key: c.key as string,
    width: c.width ?? 18,
  }));
  // Gán format cho từng cột
  opts.detailSheet.columns.forEach((c, i) => {
    setNumberFormat(det.getColumn(i + 1), c.format);
  });
  // Thêm rows (transform hoặc lấy trực tiếp key)
  det.addRows(
    opts.detailSheet.rows.map((row) => {
      const out: Record<string, unknown> = {};
      for (const c of opts.detailSheet.columns) {
        const key = c.key as string;
        out[key] = c.transform ? c.transform(row) : (row as Record<string, unknown>)[key];
      }
      return out;
    }),
  );
  styleHeaderRow(det.getRow(1));
  det.views = [{ state: "frozen", ySplit: 1 }];
  // Auto-filter toàn bảng
  if (opts.detailSheet.columns.length > 0) {
    det.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: opts.detailSheet.columns.length },
    };
  }
  // Border nhẹ cho data rows (tăng tính dễ đọc)
  det.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return; // header đã style riêng
    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E7EB" } },
        bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
        left: { style: "thin", color: { argb: "FFE5E7EB" } },
        right: { style: "thin", color: { argb: "FFE5E7EB" } },
      };
    });
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Wrap Buffer thành NextResponse với Content-Disposition filename. */
export function excelResponse(buf: Buffer, filename: string): Response {
  // Loại bỏ ký tự không an toàn cho header
  const safe = filename.replace(/[^\w.\-]+/g, "_");
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
      "Content-Length": String(buf.byteLength),
      "Cache-Control": "no-store",
    },
  });
}
