import type { Metadata } from "next";
import { ClientHeader } from "@/components/client/layout/client-header";
import { ClientFooter } from "@/components/client/layout/client-footer";

export const metadata: Metadata = {
  title: {
    default: "LapLap - Laptop Cần Thơ",
    template: "%s | LapLap",
  },
  description: "LapLap - Cửa hàng laptop uy tín tại Cần Thơ",
};

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <ClientHeader />
      <main className="flex-1 animate-fade-in">{children}</main>
      <ClientFooter />
    </div>
  );
}
