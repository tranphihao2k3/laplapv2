import type { Metadata } from "next";
import { getStoreInfo } from "@/lib/store-info";
import { RepairServicesClient } from "./repair-services-client";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getStoreInfo();
  return {
    title: `Bảng giá sửa chữa laptop – ${store.name} Cần Thơ`,
    description: `Bảng giá sửa chữa laptop tại ${store.name} Cần Thơ: thay linh kiện, sửa phần cứng, sửa phần mềm, vệ sinh & nâng cấp. Giá minh bạch, bảo hành sau sửa chữa, kỹ thuật viên chuyên nghiệp.`,
    keywords: [
      "sửa chữa laptop",
      "thay pin laptop",
      "thay màn hình laptop",
      "sửa mainboard laptop",
      "cài windows",
      "vệ sinh laptop",
      "nâng cấp RAM SSD",
      "bảng giá sửa chữa",
      "laptop Cần Thơ",
    ],
    openGraph: {
      title: `Bảng giá sửa chữa laptop – ${store.name} Cần Thơ`,
      description: `Giá sửa chữa laptop minh bạch, bảo hành sau sửa, kỹ thuật viên chuyên nghiệp tại Cần Thơ.`,
      type: "website",
    },
    alternates: {
      canonical: "/dich-vu-sua-chua",
    },
  };
}

export default function RepairServicesPage() {
  return <RepairServicesClient />;
}
