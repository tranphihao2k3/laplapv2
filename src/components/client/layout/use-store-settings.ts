"use client";

import { useState, useEffect, useCallback, useRef } from "react";

/**
 * Store settings interface — mirrors the server-side StoreInfo type.
 * Includes both basic store info, legal information, and contact settings.
 */
export interface StoreSettings {
  // Basic store info
  name: string;
  description: string;
  address: string;
  phone: string;
  email: string;
  // Legal info
  legal: {
    business_name: string;
    tax_id: string;
    business_registration_number: string;
    business_registration_issued_by: string;
    business_registration_issued_date: string;
    legal_representative: string;
    legal_representative_title: string;
    content_manager_phone: string;
    content_manager_email: string;
    bo_cong_thuong_url: string;
    bo_cong_thuong_notified_at: string;
  };
  // Additional settings
  hotline?: string;
  warranty_months?: number;
  return_policy_days?: number;
  shipping_info?: string;
  // Contact page settings
  contact_channels?: Array<{
    icon: string;
    label: string;
    value: string;
    link?: string;
    type: "phone" | "zalo" | "email" | "messenger" | "telegram" | "other";
  }>;
  opening_hours?: {
    weekday?: string;
    weekend?: string;
    saturday?: string;
    sunday?: string;
    holidays?: string;
  };
  social_links?: {
    facebook?: string;
    zalo?: string;
    website?: string;
    tiktok?: string;
    youtube?: string;
    instagram?: string;
  };
}

/** Cached data structure stored in localStorage */
interface CachedSettings {
  data: StoreSettings;
  timestamp: number;
  expiresAt: number;
}

const CACHE_KEY = "store-settings-cache";
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get cached settings from localStorage
 */
function getCachedSettings(): CachedSettings | null {
  if (typeof window === "undefined") return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedSettings = JSON.parse(cached);
    
    // Check if expired
    if (Date.now() > parsed.expiresAt) {
      // Cache expired, remove it
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    
    return parsed;
  } catch {
    // Invalid cache data
    localStorage.removeItem(CACHE_KEY);
    return null;
  }
}

/**
 * Save settings to localStorage cache
 */
function saveToCache(data: StoreSettings): void {
  if (typeof window === "undefined") return;
  
  try {
    const cache: CachedSettings = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + CACHE_DURATION_MS,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // localStorage might be full or disabled
  }
}

/**
 * Check if cache is stale (expired but still has data for fallback)
 */
function isStaleCache(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return false;
    
    const parsed: CachedSettings = JSON.parse(cached);
    return Date.now() > parsed.expiresAt;
  } catch {
    return false;
  }
}

/**
 * Get stale cache data even if expired (for fallback when fetch fails)
 */
function getStaleCache(): StoreSettings | null {
  if (typeof window === "undefined") return null;
  
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (!cached) return null;
    
    const parsed: CachedSettings = JSON.parse(cached);
    return parsed.data;
  } catch {
    return null;
  }
}

/** Default fallback settings */
const DEFAULT_SETTINGS: StoreSettings = {
  name: "LapLap",
  description: "Hệ thống bán lẻ laptop chính hãng hàng đầu tại Cần Thơ",
  address: "123 Nguyễn Văn Cừ, Ninh Kiều, Cần Thơ",
  phone: "1900 1234",
  email: "info@laplap.vn",
  legal: {
    business_name: "CÔNG TY TNHH THƯƠNG MẠI DỊCH VỤ LAPLAP",
    tax_id: "1800123456",
    business_registration_number: "1800123456",
    business_registration_issued_by: "Sở Kế hoạch và Đầu tư thành phố Cần Thơ",
    business_registration_issued_date: "2019-03-15",
    legal_representative: "Nguyễn Văn A",
    legal_representative_title: "Giám đốc",
    content_manager_phone: "1900 1234",
    content_manager_email: "info@laplap.vn",
    bo_cong_thuong_url: "https://online.gov.vn/Home/App/Details/PLACEHOLDER",
    bo_cong_thuong_notified_at: "2025-01-01",
  },
  hotline: "1900 1234",
  warranty_months: 12,
  return_policy_days: 30,
  shipping_info: "Nội thành Cần Thơ trong 2 giờ, hỗ trợ ship toàn quốc",
  contact_channels: [
    { icon: "phone", label: "Hotline bán hàng", value: "1900 1234", type: "phone" },
    { icon: "headphones", label: "Hỗ trợ kỹ thuật", value: "1900 1234", type: "phone" },
    { icon: "message-circle", label: "Zalo / WhatsApp", value: "0901 234 567", link: "https://zalo.me/0901234567", type: "zalo" },
    { icon: "mail", label: "Email", value: "info@laplap.vn", type: "email" },
  ],
  opening_hours: {
    weekday: "8:00 - 21:00",
    saturday: "8:00 - 22:00",
    sunday: "9:00 - 20:00",
  },
  social_links: {
    facebook: "https://facebook.com/laplapcantho",
    zalo: "https://zalo.me/laplapcantho",
    website: "https://laplap.vn",
  },
};

/**
 * Hook to fetch and cache store settings with localStorage.
 * 
 * Features:
 * - Fetches from API once per 24 hours
 * - Uses localStorage for persistent caching
 * - Falls back to stale cache if fetch fails
 * - Falls back to default settings if no cache exists
 * 
 * @param options.fetchOnMount - Whether to fetch on mount (default: true)
 * @param options.refreshInterval - How often to refresh in ms (default: 24h)
 */
export function useStoreSettings(options?: { fetchOnMount?: boolean; refreshInterval?: number }) {
  const { fetchOnMount = true, refreshInterval = CACHE_DURATION_MS } = options ?? {};
  
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUsingCache, setIsUsingCache] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const fetchSettings = useCallback(async (forceRefresh = false) => {
    // Cancel any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    // Check localStorage cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = getCachedSettings();
      if (cached) {
        if (mountedRef.current) {
          setSettings(cached.data);
          setIsUsingCache(true);
          setIsLoading(false);
          setLastUpdated(new Date(cached.timestamp));
        }
        return;
      }
    }

    // Fetch from API
    try {
      const response = await fetch("/api/public/store-info", {
        signal: abortControllerRef.current.signal,
        cache: "no-store", // Don't use Next.js fetch cache
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data: StoreSettings = await response.json();

      // Save to localStorage cache
      saveToCache(data);

      if (mountedRef.current) {
        setSettings(data);
        setIsUsingCache(false);
        setIsLoading(false);
        setLastUpdated(new Date());
      }
    } catch (error) {
      // If fetch fails, try stale cache
      if (mountedRef.current) {
        const staleData = getStaleCache();
        if (staleData) {
          setSettings(staleData);
          setIsUsingCache(true);
          setIsLoading(false);
        } else {
          // No cache at all, use defaults
          setSettings(DEFAULT_SETTINGS);
          setIsUsingCache(false);
          setIsLoading(false);
        }
      }
    }
  }, []);

  // Initial fetch and periodic refresh
  useEffect(() => {
    mountedRef.current = true;

    if (fetchOnMount) {
      fetchSettings();
    } else {
      setIsLoading(false);
    }

    // Set up periodic refresh
    const refreshIntervalId = setInterval(() => {
      if (!document.hidden) {
        fetchSettings(true);
      }
    }, refreshInterval);

    // Refresh when tab becomes visible
    const handleVisibilityChange = () => {
      if (document.hidden === false) {
        const cached = getCachedSettings();
        if (!cached) {
          fetchSettings(true);
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      clearInterval(refreshIntervalId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchOnMount, fetchSettings, refreshInterval]);

  /**
   * Force refresh settings from API
   */
  const refresh = useCallback(() => {
    return fetchSettings(true);
  }, [fetchSettings]);

  /**
   * Clear the localStorage cache
   */
  const clearCache = useCallback(() => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(CACHE_KEY);
    }
  }, []);

  return {
    settings,
    isLoading,
    isUsingCache,
    lastUpdated,
    refresh,
    clearCache,
  };
}

/**
 * Helper to generate tel: href from phone number
 */
export function telHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const cleaned = phone.replace(/[^\d+]/g, "");
  return cleaned ? `tel:${cleaned}` : null;
}
