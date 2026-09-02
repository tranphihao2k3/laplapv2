/**
 * Store Info — Server-only cached functions.
 * This file can ONLY be imported in Server Components or API routes.
 * It re-exports from store-info.ts and adds Next.js caching.
 */

import { unstable_cache, revalidateTag } from "next/cache";
import {
  getStoreInfo,
  getStoreContact,
  type ContactChannel,
  type OpeningHours,
  type SocialLinks,
  type StoreInfo,
  type LegalInfo,
  type StoreContact,
} from "./store-info";

/**
 * Cached version of getStoreInfo using Next.js unstable_cache.
 * - Revalidates every 1 hour (3600 seconds)
 * - Tagged with "store-info" for on-demand invalidation
 *
 * Use this in API routes and when you need cross-request caching.
 */
export const getStoreInfoCached = unstable_cache(
  async (): Promise<StoreInfo> => {
    return getStoreInfo();
  },
  ["store-info"],
  {
    revalidate: 3600, // 1 hour
    tags: ["store-info", "store-legal", "store-contact"],
  }
);

/**
 * Invalidate all store-info related caches.
 * Call this after admin saves store/legal/contact settings.
 */
export async function invalidateStoreInfoCache() {
  revalidateTag("store-info");
  revalidateTag("store-legal");
  revalidateTag("store-contact");
}

// Re-export everything else from store-info.ts
export { getStoreInfo, getStoreContact } from "./store-info";
export type {
  ContactChannel,
  OpeningHours,
  SocialLinks,
  StoreInfo,
  LegalInfo,
  StoreContact,
} from "./store-info";
