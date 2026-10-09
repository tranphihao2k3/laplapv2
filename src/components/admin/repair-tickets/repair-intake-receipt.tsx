"use client";

import { forwardRef, useEffect, useRef } from "react";
import { Printer, AlertTriangle, Clock, ShieldCheck, Phone, MapPin, Mail, Globe } from "lucide-react";
import { Button } from "@/components/ui/button";

export type IntakeReceiptData = {
  ticketCode: string;
  createdAt: string | null;
  statusLabel: string;
  // Khách hàng
  customerName: string | null;
  customerPhone: string | null;
  customerAddress?: string | null;
  // Thiết bị
  deviceName: string;
  deviceBrand?: string | null;
  serialNumber: string | null;
  accessories?: string | null;
  // Tình trạng
  issueDescription: string | null;
  conditionDescription: string | null;
  // Chi phí & thời gian
  estimatedCost: number | null;
  estimatedCompletionDate?: string | null; // deadline dự kiến
  warrantyMonths?: number | null;
  // Shop
  shopName: string | null;
  shopAddress?: string | null;
  shopPhone?: string | null;
  shopEmail?: string | null;
  shopWebsite?: string | null;
  // Ảnh
  images: string[] | null;
  // Người tiếp nhận
  technicianName?: string | null;
  // Ngày hết hạn hiệu lực của phiếu (vd: 30 ngày sau khi sửa xong)
  pickupDeadlineDays?: number; // mặc định 30
};

type Props = {
  data: IntakeReceiptData | null;
  variant?: "button" | "icon" | "hidden";
  className?: string;
};

function fmtCurrency(v: number | null | undefined) {
  if (v == null) return "—";
  return new Intl.NumberFormat("vi-VN").format(v) + " ₫";
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return d;
  }
}

function fmtDateTime(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return d;
  }
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export const RepairIntakeReceipt = forwardRef<HTMLDivElement, Props>(function RepairIntakeReceipt(
  { data, variant = "button", className },
  ref,
) {
  const internalRef = useRef<HTMLDivElement | null>(null);
  const mergedRef = (ref as React.RefObject<HTMLDivElement>) || internalRef;

  function handlePrint() {
    if (!data) return;
    window.print();
  }

  if (!data) return null;

  // Ngày hết hạn nhận máy (sau khi báo sửa xong) — mặc định 30 ngày
  const pickupDays = data.pickupDeadlineDays ?? 30;
  const pickupDeadline = addDays(new Date(), pickupDays);
  // Ngày máy dự kiến xong (nếu có)
  const completionDate = data.estimatedCompletionDate
    ? new Date(data.estimatedCompletionDate)
    : null;

  return (
    <>
      {variant === "button" ? (
        <Button type="button" variant="outline" size="sm" onClick={handlePrint} className={className}>
          <Printer className="h-4 w-4 mr-1" /> In phiếu A5
        </Button>
      ) : variant === "icon" ? (
        <Button type="button" variant="ghost" size="icon" onClick={handlePrint} className={className}>
          <Printer className="h-4 w-4" />
        </Button>
      ) : null}

      <div ref={mergedRef} className="repair-intake-receipt">
        <div className="receipt-root">
          {/* === HEADER === */}
          <header className="rpt-header">
            <div className="rpt-shop">
              <div className="rpt-logo">[LOGO]</div>
              <div className="rpt-shop-info">
                <div className="rpt-shop-name">{data.shopName ?? "LapLap Service Center"}</div>
                {data.shopAddress ? (
                  <div className="rpt-shop-line"><MapPin className="ic" />{data.shopAddress}</div>
                ) : null}
                <div className="rpt-shop-line">
                  {data.shopPhone ? <><Phone className="ic" />{data.shopPhone}</> : <><Phone className="ic" />Hotline: 0292.xxx.xxxx</>}
                  {data.shopEmail ? <span className="rpt-sep">·</span> : null}
                  {data.shopEmail ? <><Mail className="ic" />{data.shopEmail}</> : null}
                </div>
                {data.shopWebsite ? (
                  <div className="rpt-shop-line"><Globe className="ic" />{data.shopWebsite}</div>
                ) : null}
              </div>
            </div>
            <div className="rpt-title">
              <div className="rpt-title-main">PHIẾU BIÊN NHẬN</div>
              <div className="rpt-title-sub">SỬA CHỮA &amp; BẢO HÀNH</div>
              <div className="rpt-title-en">Repair Intake Ticket</div>
            </div>
          </header>

          {/* === MÃ PHIẾU + THỜI GIAN === */}
          <section className="rpt-meta">
            <div className="rpt-meta-item">
              <div className="rpt-meta-label">Mã phiếu</div>
              <div className="rpt-meta-value rpt-code">{data.ticketCode}</div>
            </div>
            <div className="rpt-meta-item">
              <div className="rpt-meta-label">Tiếp nhận lúc</div>
              <div className="rpt-meta-value">{fmtDateTime(data.createdAt)}</div>
            </div>
            <div className="rpt-meta-item">
              <div className="rpt-meta-label">Dự kiến xong</div>
              <div className="rpt-meta-value">
                {completionDate ? fmtDate(completionDate.toISOString()) : "Sẽ thông báo"}
              </div>
            </div>
            <div className="rpt-meta-item">
              <div className="rpt-meta-label">Trạng thái</div>
              <div className="rpt-meta-value">
                <span className="rpt-status-pill">{data.statusLabel}</span>
              </div>
            </div>
          </section>

          {/* === KHÁCH HÀNG === */}
          <section className="rpt-block">
            <div className="rpt-block-title">I. Thông tin khách hàng</div>
            <div className="rpt-grid-2">
              <div className="rpt-field">
                <span className="rpt-label">Họ tên:</span>
                <span className="rpt-value">{data.customerName ?? "—"}</span>
              </div>
              <div className="rpt-field">
                <span className="rpt-label">Số điện thoại:</span>
                <span className="rpt-value">{data.customerPhone ?? "—"}</span>
              </div>
              {data.customerAddress ? (
                <div className="rpt-field rpt-col-2">
                  <span className="rpt-label">Địa chỉ:</span>
                  <span className="rpt-value">{data.customerAddress}</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* === THIẾT BỊ === */}
          <section className="rpt-block">
            <div className="rpt-block-title">II. Thông tin thiết bị</div>
            <div className="rpt-grid-2">
              <div className="rpt-field">
                <span className="rpt-label">Tên thiết bị:</span>
                <span className="rpt-value rpt-strong">{data.deviceName}</span>
              </div>
              <div className="rpt-field">
                <span className="rpt-label">Hãng / Model:</span>
                <span className="rpt-value">{data.deviceBrand ?? "—"}</span>
              </div>
              <div className="rpt-field rpt-col-2">
                <span className="rpt-label">Serial / IMEI:</span>
                <span className="rpt-value rpt-mono">{data.serialNumber ?? "—"}</span>
              </div>
              {data.accessories ? (
                <div className="rpt-field rpt-col-2">
                  <span className="rpt-label">Phụ kiện kèm theo:</span>
                  <span className="rpt-value">{data.accessories}</span>
                </div>
              ) : null}
            </div>
          </section>

          {/* === TÌNH TRẠNG === */}
          <section className="rpt-block">
            <div className="rpt-block-title">III. Tình trạng &amp; lỗi</div>
            <div className="rpt-sub">
              <div className="rpt-sub-label">Mô tả lỗi do khách báo:</div>
              <div className="rpt-text">{data.issueDescription ?? "—"}</div>
            </div>
            {data.conditionDescription ? (
              <div className="rpt-sub">
                <div className="rpt-sub-label">Hiện trạng máy khi tiếp nhận:</div>
                <div className="rpt-text rpt-muted">{data.conditionDescription}</div>
              </div>
            ) : null}
            {data.images && data.images.length > 0 ? (
              <div className="rpt-images">
                {data.images.slice(0, 4).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={i} src={url} alt={`Ảnh ${i + 1}`} />
                ))}
              </div>
            ) : null}
          </section>

          {/* === CHI PHÍ & BẢO HÀNH === */}
          <section className="rpt-block rpt-cost-block">
            <div className="rpt-cost-row">
              <span>Chi phí dự kiến:</span>
              <strong>{fmtCurrency(data.estimatedCost)}</strong>
            </div>
            {data.warrantyMonths ? (
              <div className="rpt-warranty">
                <ShieldCheck className="ic" />
                <span>Bảo hành sau sửa: <strong>{data.warrantyMonths} tháng</strong></span>
              </div>
            ) : null}
            <div className="rpt-cost-note">
              * Chi phí có thể phát sinh sau chẩn đoán. Shop sẽ liên hệ &amp; chỉ sửa khi khách đồng ý.
            </div>
          </section>

          {/* === ĐIỀU KHOẢN === */}
          <section className="rpt-block">
            <div className="rpt-block-title">IV. Điều khoản &amp; cam kết</div>
            <ol className="rpt-terms">
              <li>Shop chỉ tiến hành sửa chữa khi đã báo giá và <strong>được khách hàng đồng ý</strong> bằng lời hoặc tin nhắn.</li>
              <li>Mọi thay thế linh kiện đều dùng hàng <strong>chính hãng hoặc tương đương</strong>; thông báo giá trước khi thay.</li>
              <li>Thời gian dự kiến ở mục <em>Dự kiến xong</em>; quá thời hạn 7 ngày mà chưa xong, shop sẽ chủ động báo lý do.</li>
              <li>Nếu máy <strong>không sửa được</strong>, shop trả lại máy nguyên trạng và chỉ thu phí chẩn đoán (nếu có thỏa thuận trước).</li>
              <li>Phiếu này là căn cứ duy nhất để nhận máy. <strong>Mất phiếu</strong>: khách cần xuất trình giấy tờ tùy thân &amp; chịu trách nhiệm.</li>
              <li>Sau khi sửa xong, khách nhận máy trong vòng <strong>{pickupDays} ngày</strong>. Quá hạn, shop không chịu trách nhiệm về máy.</li>
              <li>Shop <strong>không chịu trách nhiệm</strong> với dữ liệu lưu trong máy (ảnh, danh bạ, tài khoản…). Khách tự sao lưu trước khi giao máy.</li>
              <li>Trường hợp khiếu nại, tranh chấp phát sinh từ phiếu sửa chữa này sẽ được giải quyết theo <strong>pháp luật Việt Nam</strong> tại Tòa án có thẩm quyền nơi shop đặt trụ sở.</li>
            </ol>
          </section>

          {/* === HẠN HIỆU LỰC === */}
          <div className="rpt-validity">
            <Clock className="ic" />
            <div>
              <strong>Hiệu lực phiếu:</strong> có giá trị đến hết ngày <strong>{fmtDate(pickupDeadline.toISOString())}</strong>.
              Sau thời hạn trên, phiếu được coi như <em>không còn giá trị nhận máy/bảo hành</em>.
            </div>
          </div>

          {/* === KÝ TÊN === */}
          <section className="rpt-signatures">
            <div className="rpt-sig">
              <div className="rpt-sig-title">Khách hàng</div>
              <div className="rpt-sig-note">(Ký, ghi rõ họ tên)</div>
              <div className="rpt-sig-line" />
            </div>
            <div className="rpt-sig">
              <div className="rpt-sig-title">Kỹ thuật viên tiếp nhận</div>
              <div className="rpt-sig-note">(Ký, ghi rõ họ tên)</div>
              <div className="rpt-sig-line">{data.technicianName ?? ""}</div>
            </div>
          </section>

          {/* === FOOTER === */}
          <footer className="rpt-footer">
            <div className="rpt-footer-icon"><AlertTriangle className="ic" /> Vui lòng giữ phiếu cẩn thận — đây là căn cứ duy nhất để nhận máy và yêu cầu bảo hành.</div>
            <div className="rpt-footer-thanks">Cảm ơn quý khách đã tin tưởng dịch vụ của chúng tôi!</div>
          </footer>
        </div>
      </div>
    </>
  );
});

/**
 * Style cho phiếu in A5 (148mm × 210mm).
 * - 1 trang A5 = 1 phiếu
 * - @media print: ẩn UI, chỉ in .repair-intake-receipt
 * - @page A5 portrait, margin 0 (vì đã pad trong .receipt-root)
 */
export function RepairReceiptStyles() {
  useEffect(() => {
    const styleId = "repair-intake-receipt-styles";
    if (document.getElementById(styleId)) return;
    const style = document.createElement("style");
    style.id = styleId;
    style.innerHTML = `
      .repair-intake-receipt { display: none; }
      @media print {
        @page { size: A5 portrait; margin: 0; }
        body * { visibility: hidden !important; }
        .repair-intake-receipt, .repair-intake-receipt * { visibility: visible !important; }
        .repair-intake-receipt {
          display: block !important;
          position: absolute;
          inset: 0;
          background: #fff;
          color: #000;
        }
      }

      .receipt-root {
        width: 148mm;
        min-height: 210mm;
        margin: 0 auto;
        padding: 8mm 10mm 8mm 10mm;
        font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
        font-size: 9pt;
        line-height: 1.4;
        color: #000;
        background: #fff;
        box-sizing: border-box;
      }

      /* ===== HEADER ===== */
      .rpt-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 6mm;
        border-bottom: 1.5pt solid #000;
        padding-bottom: 3mm;
        margin-bottom: 3mm;
      }
      .rpt-shop { display: flex; gap: 2mm; flex: 1; min-width: 0; }
      .rpt-logo {
        width: 14mm; height: 14mm;
        border: 1pt dashed #999;
        display: flex; align-items: center; justify-content: center;
        font-size: 7pt; color: #999;
        flex-shrink: 0;
      }
      .rpt-shop-info { font-size: 8.5pt; line-height: 1.35; min-width: 0; }
      .rpt-shop-name { font-weight: 700; font-size: 10pt; margin-bottom: 1mm; }
      .rpt-shop-line { display: flex; align-items: center; gap: 1mm; color: #333; }
      .rpt-sep { margin: 0 1.5mm; color: #999; }
      .ic { width: 3mm; height: 3mm; flex-shrink: 0; }
      .rpt-title { text-align: right; flex-shrink: 0; }
      .rpt-title-main { font-size: 14pt; font-weight: 800; letter-spacing: 0.5pt; line-height: 1.1; }
      .rpt-title-sub { font-size: 10pt; font-weight: 600; letter-spacing: 0.3pt; margin-top: 0.5mm; }
      .rpt-title-en { font-size: 8pt; font-style: italic; color: #555; margin-top: 1mm; }

      /* ===== META ===== */
      .rpt-meta {
        display: grid;
        grid-template-columns: 1.4fr 1fr 1fr 1fr;
        gap: 2mm;
        border: 0.7pt solid #000;
        padding: 2mm 3mm;
        margin-bottom: 3mm;
      }
      .rpt-meta-label { font-size: 7.5pt; color: #555; text-transform: uppercase; letter-spacing: 0.3pt; }
      .rpt-meta-value { font-size: 10pt; font-weight: 600; margin-top: 0.5mm; }
      .rpt-code { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 11pt; letter-spacing: 0.5pt; }
      .rpt-status-pill {
        display: inline-block; padding: 0.5mm 2mm;
        background: #e6f4ea; color: #1e7a3a;
        border: 0.5pt solid #1e7a3a;
        border-radius: 1.5mm; font-size: 9pt;
      }

      /* ===== BLOCKS ===== */
      .rpt-block { margin-bottom: 2.5mm; }
      .rpt-block-title {
        font-size: 9pt; font-weight: 700; text-transform: uppercase;
        letter-spacing: 0.3pt;
        border-bottom: 0.5pt solid #000;
        padding-bottom: 0.8mm;
        margin-bottom: 1.5mm;
      }
      .rpt-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1mm 4mm; }
      .rpt-field { display: flex; gap: 1mm; font-size: 9pt; min-width: 0; }
      .rpt-field.rpt-col-2 { grid-column: span 2; }
      .rpt-label { color: #555; white-space: nowrap; flex-shrink: 0; }
      .rpt-value { color: #000; word-break: break-word; }
      .rpt-strong { font-weight: 700; }
      .rpt-mono { font-family: ui-monospace, "SF Mono", Menlo, Consolas, monospace; font-size: 9pt; }

      .rpt-sub { margin-top: 1.5mm; }
      .rpt-sub-label { font-size: 8.5pt; color: #555; font-style: italic; margin-bottom: 0.5mm; }
      .rpt-text { font-size: 9pt; white-space: pre-wrap; line-height: 1.45; }
      .rpt-muted { color: #444; }

      .rpt-images {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 1mm;
        margin-top: 1.5mm;
      }
      .rpt-images img { width: 100%; aspect-ratio: 1/1; object-fit: cover; border: 0.5pt solid #999; }

      /* ===== COST ===== */
      .rpt-cost-block {
        border: 1pt solid #000;
        padding: 2mm 3mm;
        background: #fafafa;
      }
      .rpt-cost-row {
        display: flex; justify-content: space-between; align-items: baseline;
        font-size: 10pt;
      }
      .rpt-cost-row strong { font-size: 12pt; }
      .rpt-warranty {
        display: flex; align-items: center; gap: 1mm;
        margin-top: 1mm; font-size: 9pt;
        color: #1e7a3a;
      }
      .rpt-cost-note { font-size: 7.5pt; color: #666; font-style: italic; margin-top: 1mm; }

      /* ===== TERMS ===== */
      .rpt-terms {
        font-size: 8pt; line-height: 1.5;
        margin: 0; padding-left: 5mm;
      }
      .rpt-terms li { margin-bottom: 0.6mm; }
      .rpt-terms strong { font-weight: 700; }

      /* ===== VALIDITY ===== */
      .rpt-validity {
        display: flex; align-items: flex-start; gap: 2mm;
        background: #fff8e1; border: 0.7pt solid #b58900;
        padding: 2mm 3mm; margin: 2.5mm 0;
        font-size: 8.5pt;
      }
      .rpt-validity .ic { color: #b58900; margin-top: 0.5mm; }

      /* ===== SIGNATURES ===== */
      .rpt-signatures {
        display: grid; grid-template-columns: 1fr 1fr;
        gap: 8mm; margin-top: 4mm;
      }
      .rpt-sig { text-align: center; }
      .rpt-sig-title { font-weight: 700; font-size: 9.5pt; }
      .rpt-sig-note { font-size: 7.5pt; color: #666; font-style: italic; margin-bottom: 8mm; }
      .rpt-sig-line {
        border-top: 0.7pt solid #000;
        padding-top: 1mm;
        min-height: 12mm;
        font-size: 9pt;
      }

      /* ===== FOOTER ===== */
      .rpt-footer {
        margin-top: 4mm;
        padding-top: 2mm;
        border-top: 0.5pt dashed #999;
        text-align: center;
        font-size: 7.5pt;
        color: #555;
      }
      .rpt-footer-icon { display: flex; align-items: center; justify-content: center; gap: 1.5mm; margin-bottom: 1mm; }
      .rpt-footer-thanks { font-style: italic; font-weight: 600; color: #333; }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);
  return null;
}
