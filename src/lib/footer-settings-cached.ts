/**
 * Footer Settings — Server-only cached functions.
 * This file can ONLY be imported in Server Components or API routes.
 * It re-exports from footer-settings.ts and adds Next.js caching.
 */

import { unstable_cache, revalidateTag } from "next/cache";
import {
  getFooterSettings,
  DEFAULT_FOOTER_SETTINGS,
  type FooterLink,
  type FooterColumn,
  type FooterSettings,
} from "./footer-settings";

/**
 * Cached version using Next.js unstable_cache.
 * - Revalidates every 1 hour (3600 seconds)
 * - Tagged with "footer-settings" for on-demand invalidation
 *
 * Use this in API routes and when you need cross-request caching.
 */
export const getFooterSettingsCached = unstable_cache(
  async (): Promise<FooterSettings> => {
    return getFooterSettings();
  },
  ["footer-settings"],
  {
    revalidate: 3600, // 1 hour
    tags: ["footer-settings"],
  }
);

/**
 * Invalidate footer settings cache.
 * Call this after admin saves footer settings.
 */
export async function invalidateFooterSettingsCache() {
  revalidateTag("footer-settings");
}

// Re-export everything else from footer-settings.ts
export { getFooterSettings, DEFAULT_FOOTER_SETTINGS } from "./footer-settings";
export type { FooterLink, FooterColumn, FooterSettings } from "./footer-settings";
