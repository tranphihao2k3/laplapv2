"use client";

import dynamic from "next/dynamic";
import type { FerrofluidProps } from "./ferrofluid";

// WebGL + window: chỉ chạy phía client, tắt SSR để không vỡ hydrate trên Cloudflare Workers.
const Ferrofluid = dynamic(() => import("./ferrofluid"), { ssr: false });

export function FerrofluidLazy(props: FerrofluidProps) {
  return <Ferrofluid {...props} />;
}

export default FerrofluidLazy;
