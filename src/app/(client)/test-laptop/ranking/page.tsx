"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Bảng xếp hạng đã được tích hợp vào tab đầu tiên của /test-laptop
export default function RankingRedirect() {
  const router = useRouter();
  useEffect(() => { router.replace("/test-laptop"); }, [router]);
  return null;
}
