/**
 * FaqSection — 5 câu hỏi thường gặp dùng shadcn Accordion.
 * Dựa trên feedback KTV thực tế: SmartScreen, điểm GPU, độ chính xác FurMark, xóa.
 */
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const FAQ = [
  {
    q: "Mini Tool có an toàn không?",
    a: "Tool chỉ thu thập thông số phần cứng + điểm FurMark rồi gửi về server của Laptop Thành Võ (laplapcantho.store). Không thu thập file cá nhân, không cài service chạy nền, không thay đổi registry. Source PowerShell nằm ở public/scripts/laplap-mini-tool.ps1 — bạn có thể đọc trước khi chạy.",
  },
  {
    q: "Điểm GPU của tôi ở đâu trên bảng?",
    a: "Sau khi Mini Tool upload xong, trình duyệt tự mở /test-laptop?highlight=<laptop_id> — dòng của bạn sẽ được highlight vàng. Bạn cũng có thể vào /test-laptop/ranking để xem toàn bộ.",
  },
  {
    q: "SmartScreen chặn thì làm sao?",
    a: "Mini Tool chưa ký số (Code Signing cert) nên Windows SmartScreen sẽ cảnh báo 'Unknown publisher'. Khi chạy: bấm 'More info' → 'Run anyway'. Đây là hành vi bình thường với mọi tool PS2EXE chưa ký.",
  },
  {
    q: "FurMark score của tôi khác mọi người cùng GPU?",
    a: "FurMark đo hiệu năng GPU trong 5 phút, nên phụ thuộc vào nhiệt độ, driver, power limit và BIOS. Cùng GPU nhưng máy gaming có tản nhiệt tốt thường cao hơn ultrabook mỏng. Khoảng lệch ±5-10% là bình thường.",
  },
  {
    q: "Tôi có thể xóa kết quả benchmark của mình không?",
    a: "Hiện tại chưa có self-service delete. Liên hệ admin qua fanpage Laptop Thành Võ hoặc Zalo 0909-xxx-xxx để được gỡ. Tính năng này sẽ được thêm vào /account/settings trong bản cập nhật sau.",
  },
];

export function FaqSection() {
  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-zinc-900 sm:text-lg">
        Câu hỏi thường gặp
      </h2>
      <Accordion type="single" collapsible className="w-full">
        {FAQ.map((item, i) => (
          <AccordionItem key={item.q} value={`faq-${i}`}>
            <AccordionTrigger className="text-left text-sm font-medium text-zinc-900">
              {item.q}
            </AccordionTrigger>
            <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
              {item.a}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}
