"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Bảng xếp hạng đã được tích hợp vào tab đầu tiên của /test-laptop.
// Trang /test-laptop/ranking hiện redirect về /test-laptop.
// (Trước đây trang này có UI riêng — nay UI đã gộp vào TopRankingsTable trên landing.)
export default function RankingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/test-laptop"); }, [router]);
  return null;
}
