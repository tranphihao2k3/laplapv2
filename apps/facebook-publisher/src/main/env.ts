/**
 * App-wide const/env defaults — main process.
 *
 * Tách shared/env khỏi shared/settings để:
 *  - Settings do user tinh chinh (qua UI) — co the thay doi runtime.
 *  - env (o day) la BUILD-TIME / HARDCODED, app dung de biet:
 *      + base URL mac dinh neu user chua set.
 *      + timeout mac dinh neu SettingsService chua init.
 *
 * Service runtime luon uu tien doc settings.apiBaseUrl / httpTimeoutMs
 * (SettingsService) hon la env mac dinh o day.
 */
export const env = {
  /** Default apiBaseUrl neu DB rong hoac Service chua san sang. */
  defaultApiBaseUrl: "http://localhost:3000",
  /** Default timeout neu settings chua co. */
  defaultHttpTimeoutMs: 15_000,
  /** Default locale neu settings chua co. */
  defaultLocale: "vi" as const,
};
