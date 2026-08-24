/**
 * StoreContactInfo — Khối hiển thị thông tin liên hệ + thông tin pháp lý.
 * Dùng cho footer, trang /contact và các trang chính sách.
 *
 * Theo Nghị định 52/2013 (sửa bởi 85/2021) Điều 29:
 *   Website TMĐT bán hàng phải công khai: tên thương nhân, địa chỉ, SĐT,
 *   email, MST, số GCN ĐKDN, họ tên người chịu trách nhiệm nội dung.
 */
import Link from "next/link";
import { MapPin, Phone, Mail, Building2, FileText, User } from "lucide-react";
import { getStoreInfo } from "@/lib/store-info";
import { telHref } from "@/lib/shop-info";
import { TradeBadge } from "@/components/shared/trade-badge";

interface Props {
  /** Biến thể gọn cho footer — bỏ bớt thông tin pháp lý. */
  compact?: boolean;
}

export async function StoreContactInfo({ compact = false }: Props) {
  const store = await getStoreInfo();
  const tel = telHref(store.phone);

  return (
    <div className="space-y-4 text-sm leading-relaxed text-muted-foreground">
      <div className="space-y-2">
        <p className="flex items-start gap-2">
          <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span>{store.address}</span>
        </p>
        <p className="flex items-start gap-2">
          <Phone className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
          <span>
            {tel ? (
              <a href={tel} className="hover:text-foreground">
                {store.phone}
              </a>
            ) : (
              store.phone
            )}
          </span>
        </p>
        <p className="flex items-start gap-2">
          <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
          <a href={`mailto:${store.email}`} className="hover:text-foreground break-all">
            {store.email}
          </a>
        </p>
      </div>

      {!compact && (
        <div className="space-y-1.5 border-t border-border pt-3">
          <p className="flex items-start gap-2">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>{store.legal.business_name}</span>
          </p>
          <p className="flex items-start gap-2">
            <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              MST: <strong className="font-semibold text-foreground">{store.legal.tax_id}</strong>
              {" · "}
              ĐKKD:{" "}
              <strong className="font-semibold text-foreground">
                {store.legal.business_registration_number}
              </strong>
            </span>
          </p>
          <p className="flex items-start gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70" />
            <span>
              Người chịu trách nhiệm nội dung:{" "}
              <strong className="font-semibold text-foreground">
                {store.legal.legal_representative}
              </strong>{" "}
              ({store.legal.legal_representative_title})
            </span>
          </p>
        </div>
      )}

      <div className="pt-2">
        <TradeBadge />
        <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
          Đã thông báo/đăng ký với Bộ Công Thương theo Nghị định 52/2013/NĐ-CP (sửa đổi bởi
          Nghị định 85/2021/NĐ-CP).
          <br />
          <Link href="/dieu-khoan-su-dung" className="underline hover:text-foreground">
            Điều khoản sử dụng
          </Link>{" "}
          ·{" "}
          <Link href="/chinh-sach-bao-mat" className="underline hover:text-foreground">
            Chính sách bảo mật
          </Link>
        </p>
      </div>
    </div>
  );
}