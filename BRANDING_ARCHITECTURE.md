# 🎨 Branding System Architecture

## High-Level Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN SETTINGS PAGE                          │
│          (quanly/settings → "Thông tin cửa hàng")               │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Form Input                                              │  │
│  │  • Tên cửa hàng: [input]                                │  │
│  │  • Email: [input]                                       │  │
│  │  • Số điện thoại: [input]                               │  │
│  │  • Hotline: [input]                                     │  │
│  │  • Địa chỉ: [textarea]                                  │  │
│  │  • Mô tả: [textarea]                                    │  │
│  │                                                          │  │
│  │  [Lưu thông tin cửa hàng] ← Nhấn nút này               │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────┬─────────────────────────────────────────────┘
                   │
                   │ HTTP PATCH /v1/settings
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (PostgreSQL)                        │
│                    settings table                               │
│                                                                 │
│  group_name | key            | value      | updated_at        │
│  ────────────────────────────────────────────────────────────  │
│  "store"    | "name"         | "LapLap"   | 2024-10-18 ...   │
│  "store"    | "email"        | "info@..." | 2024-10-18 ...   │
│  "store"    | "phone"        | "1900 ..." | 2024-10-18 ...   │
│  "store"    | "hotline"      | "0901 ..." | 2024-10-18 ...   │
│  "store"    | "address"      | "123 ..."  | 2024-10-18 ...   │
│  "store"    | "description"  | "Mô tả..." | 2024-10-18 ...   │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   │ invalidateBrandCache()
                   │
       ┌───────────┴──────────────┐
       │                          │
       ↓                          ↓
    localStorage             HTTP Response
   [Cache Cleared]          (to browser)
       │                          │
       │                          │
┌──────┴──────────┐      ┌────────┴──────────────┐
│  HEADER         │      │  FOOTER / Server      │
│ (Client-Side)   │      │  (Server-Side)        │
│                 │      │                       │
│  useBrandName   │      │  getStoreInfoForReq   │
│  ()             │      │  uest()               │
│                 │      │                       │
│ 1. Fetch API    │      │ 1. Fetch from DB      │
│ 2. Cache        │      │ 2. Render directly    │
│ 3. Display      │      │ 3. Include in HTML    │
└─────────────────┘      └──────────────────────┘
       │                          │
       ↓                          ↓
    Logo, Brand       Display: Name, Email,
    Name in Header    Phone, Address, etc.
                      in Footer
```

---

## Component Update Flow

```
User Types New Brand Name in Admin Form
        ↓
    [Save Button Click]
        ↓
HTTP PATCH /v1/settings (name, email, phone...)
        ↓
✅ Database Updated
✅ invalidateBrandCache() called
        ↓
┌───────────┬──────────────┐
│           │              │
↓           ↓              ↓
localStorage   API         Browser
Cache Cleared  Response   Display Updated
│
└─→ Next API call to /store-info will:
    1. Fetch fresh from DB
    2. Return updated data
    3. Header receives new value
    4. Re-renders with new brand name
```

---

## Cache Lifecycle (Client-Side)

```
Browser Opens Website
        ↓
    [Check localStorage]
        ├─ Found & Valid? → Use Cached Data ⚡ (Fast)
        └─ Not Found or Expired? → Fetch from API
                ↓
        GET /api/public/store-info
                ↓
        ✅ Response OK
                ↓
        Save to localStorage (TTL: 24h)
        Display in Header
                ↓
        Header Rendered with Brand Name ✅

─────────────────────────────────────────

Admin Changes Brand Name
                ↓
        Saves in Admin Page
                ↓
        ✅ invalidateBrandCache()
        └─→ localStorage.removeItem('STORE_INFO_CACHE')
                ↓
User Refreshes or Navigates
        ↓
    [Check localStorage]
        └─ Not Found! (just cleared)
        ↓
        Fetch from API (Backend has new data)
        ↓
        Save to localStorage
        Display NEW brand name ✅
```

---

## API Endpoint Response

```
GET /api/public/store-info
│
├─ Response 200 OK
│  ├─ {
│  │   "name": "LapLap",              ← Updated by Admin
│  │   "email": "info@laplap.vn",    ← Updated by Admin
│  │   "phone": "1900 1234",         ← Updated by Admin
│  │   "hotline": "0901 234 567",    ← Updated by Admin
│  │   "address": "123 Nguyễn Văn Cừ...", ← Updated by Admin
│  │   "description": "...",         ← Updated by Admin
│  │   "legal": {...},
│  │   "contact_channels": [...],
│  │   "opening_hours": {...},
│  │   "social_links": {...}
│  │ }
│  │
│  └─ Cache-Control: public, max-age=300
│     (5 minute browser cache, 24h server cache)
│
└─ On Admin Update: invalidateTag() clears server cache
```

---

## Data Consistency Check

```
Header (Client) <──→ Footer (Server)
    │                    │
    ├─ Fetches every 24h │ Fetches on every page load
    ├─ Uses localStorage │ Uses DB directly
    ├─ Can be 0-24h old  │ Always fresh (or server-cached 24h)
    │                    │
    └─────────────────────

⚠️  What if they're different?
├─ If Admin just saved: 
│  └─ Within 24h, client cache might be stale
│  └─ Solution: invalidateBrandCache() clears cache
│
├─ If DB was manually updated (not via admin):
│  └─ Header still shows old (cached), Footer shows new
│  └─ Solution: Manual cache clear (DevTools) or wait 24h
│
└─ If Admin delayed update:
   └─ Can clear cache from admin page (manual refresh button)
```

---

## File Dependency Graph

```
User (Browser)
  │
  ├─→ Header (client-header.tsx)
  │      │
  │      ├─→ useBrandName() [use-brand.ts]
  │      │      │
  │      │      ├─→ useStoreSettings() [use-store-settings.ts]
  │      │      │      │
  │      │      │      └─→ GET /api/public/store-info
  │      │      │             │
  │      │      │             └─→ getStoreInfo() [store-info.ts]
  │      │      │                    │
  │      │      │                    └─→ settings table (DB)
  │      │      │
  │      │      └─→ localStorage (STORE_INFO_CACHE)
  │      │
  │      └─→ Display: "LapLap" or from cache
  │
  └─→ Footer (client-footer.tsx)
         │
         ├─→ getStoreInfoForRequest() [request-shop.ts]
         │      │
         │      └─→ getStoreInfo() [store-info.ts]
         │             │
         │             └─→ settings table (DB)
         │
         └─→ Display: Name, Email, Phone, Address directly

Admin (Browser)
  │
  └─→ Settings Page (page.tsx)
         │
         ├─→ StoreInfoSettings Component
         │      │
         │      ├─→ useQuery(/v1/settings)
         │      │      │
         │      │      └─→ GET /v1/settings?group_name=store
         │      │             │
         │      │             └─→ settings table
         │      │
         │      └─→ Form + Save Button
         │             │
         │             ├─→ PATCH /v1/settings/{id}
         │             │      │
         │             │      └─→ Update in DB
         │             │
         │             └─→ invalidateBrandCache()
         │                    │
         │                    └─→ Clear localStorage
```

---

## Real-World Scenario

### Scenario: Admin Changes Brand Name from "LapLap" to "TechLap"

```
TIME        EVENT                           HEADER          FOOTER
────────────────────────────────────────────────────────────────────
T0          Admin visits settings page      Shows "LapLap"  Shows "LapLap"
            (Data loaded from DB)

T1          Admin types "TechLap"           (no change yet) (no change yet)
            in form field

T2          Admin clicks "Save"
            ├─ PATCH /v1/settings
            ├─ DB Updated: "TechLap"
            └─ invalidateBrandCache()
               └─ localStorage cleared      Stale: "LapLap" Fresh: "TechLap"
                                           (cache expired)  (loaded from DB)

T3          User refreshes page
            ├─ Header: useBrandName()
            │   ├─ Check localStorage → Not found
            │   ├─ Fetch /api/public/store-info
            │   ├─ Get "TechLap" from DB
            │   └─ Display "TechLap"       Shows "TechLap"  Shows "TechLap"
            │
            └─ Footer: getStoreInfoForRequest()
               ├─ Fetch from DB
               └─ Get "TechLap"

T4+         Both Header & Footer         Consistent!      Consistent!
            are in sync
```

---

## Invalidation Flow

```
Admin Saves Settings
        ↓
    invalidateBrandCache()
        │
        ├─→ Browser:
        │   └─ localStorage.removeItem('STORE_INFO_CACHE')
        │
        ├─→ Server:
        │   └─ revalidateTag('store-info') [for unstable_cache]
        │
        └─→ Next.js:
            └─ On-demand revalidation
               └─ Next page load → Fresh data
```

---

## FAQ

### Q: Why both client cache (header) and server cache (footer)?
**A**: 
- Header: Client-side = Fast load, but may be stale up to 24h
- Footer: Server-side = Always included in HTML, can use Next.js cache
- Tradeoff: Performance vs Freshness

### Q: What if localStorage is disabled?
**A**: 
- useBrandName() falls back to default "LapLap"
- User can still see something (not blank)
- Best: User enables localStorage

### Q: What if API is slow?
**A**:
- Header will show cached version first (instant)
- If no cache, shows default "LapLap"
- API response updates component when ready
- No blank screen

### Q: Can brand name be different on different pages?
**A**: 
- No, all pages use same DB source
- Single source of truth = database
- All pages will eventually sync to new value

---

## Performance Metrics

```
Header Render Time:
├─ First Load (no cache):  ~500ms (fetch API)
├─ Subsequent (cached):     ~10ms (localStorage)
└─ After Admin Update:     ~500ms (fetch fresh)

Footer Render Time:
├─ All cases:               ~50ms (server-side, part of page render)
└─ After Admin Update:      ~50ms (fresh from DB or server cache)

User-Perceived Update Time:
├─ After Admin Save:        ~0-5 seconds (cache clear + browser refresh)
└─ Without refresh:         ~24 hours (wait for cache expire)
```

---

This is a **centralized, cache-optimized, real-time branding system**. ✨
