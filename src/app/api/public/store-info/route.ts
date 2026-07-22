import { NextResponse } from "next/server";
import { getStoreInfo } from "@/lib/store-info";

export async function GET() {
  return NextResponse.json(await getStoreInfo());
}
