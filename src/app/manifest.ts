import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

// Web App Manifest — phục vụ tại /manifest.webmanifest.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${env.NEXT_PUBLIC_APP_NAME} - Laptop Cần Thơ`,
    short_name: env.NEXT_PUBLIC_APP_NAME,
    description: "LapLap - Cửa hàng laptop uy tín tại Cần Thơ. Giá tốt, bảo hành uy tín.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    lang: "vi",
    // TODO: thêm icon khi có — đặt src/app/icon.png (512x512) và src/app/apple-icon.png,
    // Next sẽ tự nhận. Sau đó khai báo lại ở đây nếu cần PWA install.
    icons: [],
  };
}
