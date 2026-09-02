/**
 * Trust Badges — Server-only cached functions.
 * This file can ONLY be imported in Server Components or API routes.
 * It re-exports from trust-badges.ts and adds Next.js caching.
 */

import { unstable_cache, revalidateTag } from "next/cache";
import {
  getTrustBadges,
  DEFAULT_TRUST_BADGES,
  type TrustBadge,
} from "./trust-badges";

/**
 * Cached version using Next.js unstable_cache.
 * - Revalidates every 1 hour (3600 seconds)
 * - Tagged with "trust-badges" for on-demand invalidation
 *
 * Use this in API routes and when you need cross-request caching.
 */
export const getTrustBadgesCached = unstable_cache(
  async (): Promise<TrustBadge[]> => {
    return getTrustBadges();
  },
  ["trust-badges"],
  {
    revalidate: 3600, // 1 hour
    tags: ["trust-badges"],
  }
);

/**
 * Invalidate trust badges cache.
 * Call this after admin saves trust badges settings.
 */
export async function invalidateTrustBadgesCache() {
  revalidateTag("trust-badges");
}

// Re-export everything else from trust-badges.ts
export {
  getTrustBadges,
  DEFAULT_TRUST_BADGES,
  TRUST_BADGE_ICONS,
  TRUST_BADGE_ICON_OPTIONS,
  getEnabledTrustBadges,
} from "./trust-badges";
export type { TrustBadge, TrustBadgeSetting } from "./trust-badges";
