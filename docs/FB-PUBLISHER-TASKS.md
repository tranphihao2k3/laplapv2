# LapLap Facebook Publisher - Task, Phan Cong Va Kiem Tra

> Cap nhat: 2026-08-01  
> Trang thai: lap ke hoach, chua bat dau code desktop  
> Pham vi: ung dung Windows dung Electron, React, TypeScript, SQLite va Playwright

## 1. Muc Dich Tai Lieu

Tai lieu nay la noi duy nhat de:

- Chia task cho tung nguoi.
- Xac dinh dependency de cac nhanh co the lam song song.
- Ghi acceptance criteria va cach kiem tra cua tung task.
- Chi danh dau `[x]` sau khi reviewer da chay lai kiem tra.
- Luu commit, ket qua test va bang chung cua task da hoan thanh.

Khong tao mot bang trang thai thu hai o tai lieu khac. Neu co thay doi trang thai, cap nhat tai
day de tranh hai checklist khong dong bo.

## 2. Quy Tac Trang Thai

- `[ ]`: chua duoc reviewer xac nhan. Task co the dang TODO, DOING, BLOCKED hoac REVIEW.
- `[x]`: code da merge, acceptance criteria dat, lenh kiem tra exit code `0` va reviewer da
  xac nhan.
- Khi bat dau task, them sau ID: `DOING - <ten> - <branch>`.
- Khi bi chan, them: `BLOCKED - <ly do> - <ngay>`; khong tick `[x]`.
- Nguoi lam task chi tick cac acceptance criteria con. Reviewer la nguoi tick task chinh.
- Neu code, dependency, migration hoac fixture lien quan thay doi sau khi test, bang chung cu
  het hieu luc va task phai duoc kiem tra lai.

Khong xem "da chay thu", "may toi chay duoc" hoac anh chup khong gan voi commit la bang
chung hoan thanh.

## 3. Definition Of Done Chung

Moi task chi duoc checked khi dat tat ca cac dieu kien sau:

- [ ] Tat ca acceptance criteria rieng cua task da dat.
- [ ] Unit/integration/E2E lien quan da chay, khong co test bi skip hoac chi pass nho retry.
- [ ] Cac lenh verify bat buoc tra exit code `0`.
- [ ] Khong con loi P0/P1; loi thap hon co nguoi chap nhan rui ro va ghi ro.
- [ ] Khong log hoac commit token, cookie, browser profile, `.env` hay service-role key.
- [ ] Co commit hash, ket qua Expected/Actual va evidence.
- [ ] Reviewer checkout dung commit va chay lai phan kiem tra quan trong.
- [ ] Reviewer ghi ten, ngay, moi truong va doi task chinh thanh `[x]`.

Lenh gate hien co cua web:

```powershell
npm run lint
npm run typecheck
npm run build
```

Sau task `APP-001`, desktop phai co cac lenh chuan:

```powershell
npm --prefix apps/facebook-publisher run format:check
npm --prefix apps/facebook-publisher run lint
npm --prefix apps/facebook-publisher run typecheck
npm --prefix apps/facebook-publisher run test:unit
npm --prefix apps/facebook-publisher run test:integration
npm --prefix apps/facebook-publisher run build
npm --prefix apps/facebook-publisher run verify
```

## 4. Pham Vi MVP

MVP ho tro:

- Windows 10/11 x64.
- Mot tai khoan Facebook, mot browser profile va mot queue chay tuan tu.
- Nguoi dung tu them URL cac nhom da tham gia va duoc phep dang ban hang.
- Bai dang thuong trong group gom Unicode text va mot hoac nhieu anh.
- Giao dien Facebook tieng Viet truoc, co kien truc de them tieng Anh.
- Playwright luon chay browser hien thi, `headless: false`.
- Che do `Ho tro dang`: tool dien noi dung va anh, nguoi dung xac nhan buoc gui.
- Queue ben vung, chong trung, kiem tra lai gia/ton kho va phan loai ket qua.
- CAPTCHA, checkpoint, canh bao tai khoan hoac UI khong nhan dien duoc phai dung queue.

Khong thuoc MVP:

- Tu tim, thu thap hoac tham gia group.
- Marketplace va form `Ban mat hang` chuyen dung.
- Nhieu tai khoan, proxy, fingerprint spoofing hoac ky thuat ne phat hien.
- Vuot CAPTCHA, 2FA, checkpoint hay canh bao cua Facebook.
- Scheduler chay ngam, analytics, watermark va cloud sync nhieu nguoi.
- Tu dong submit tren Facebook that khi chua qua gate phe duyet van hanh.

Meta da go Groups API chinh thuc va gioi han truy cap tu dong. Vi vay `auto-submit` phai nam
sau feature flag tat mac dinh. Chi kiem thu auto-submit tren fixture do du an so huu cho den
khi `GOV-AUTO` duoc chu du an phe duyet sau khi ra soat [Dieu khoan Meta](https://www.facebook.com/legal/terms),
[chinh sach Spam](https://transparency.meta.com/policies/community-standards/spam/) va noi quy
tung nhom.

## 5. Kien Truc Da Chon Cho MVP

```text
LapLap Next.js + Supabase
        |
        | HTTPS + Supabase bearer token
        v
apps/facebook-publisher
  Electron renderer <-> typed preload IPC <-> Electron main
                                              |-- SQLite repositories
                                              |-- product/media sync
                                              |-- serial queue worker
                                              `-- Playwright adapter
                                                    |
                                                    v
                                           Chrome profile rieng
```

Quy uoc ownership:

- Renderer chi hien thi UI va gui IPC da duoc allowlist/validate.
- Electron main so huu database, filesystem, secret, queue va Playwright.
- Khong dua `SUPABASE_SERVICE_ROLE_KEY` vao desktop.
- Browser profile nam trong app data, khong nam trong repo va khong dung profile Chrome ca
  nhan.
- SQLite la local source of truth cua group, template, campaign, queue va history.
- Web/Supabase la source of truth cua san pham, bien the, gia va ton kho.

Thu muc du kien:

```text
apps/facebook-publisher/
  package.json
  src/
    main/
      api/
      db/
      media/
      playwright/
      queue/
      security/
    preload/
    renderer/
    shared/
  tests/
    fixtures/
    integration/
    e2e/
```

Package desktop doc lap voi package Next.js goc trong MVP. Cac lenh dung `npm --prefix` de
khong phai chuyen repo hien tai sang workspace ngay tu dau.

## 6. Phan Cong De Lam Song Song

Bang de xuat cho nhom 4 nguoi:

| Nguoi | Lane chinh | Task so huu | Review cheo |
|---|---|---|---|
| DEV-A | Lead + Web/API | `PUB-*`, `API-*`, phan API cua `CAT-001`, `QUE-004` | Review `PW-*` |
| DEV-B | Electron core + data | `APP-*`, `DB-*`, `CAT-001`, `MED-*`, `QUE-*`, `REL-001` | Review `UI-*` |
| DEV-C | Product UI | `CAT-002`, `GRP-*`, `TPL-*`, `CMP-*`, `UI-*` | Review `APP-*`, `DB-*` |
| DEV-D | Playwright + QA/security | `PW-*`, `QA-*`, `SEC-*`, review release | Review `API-*` |

Neu co 3 nguoi:

- Nguoi A: `PUB-*`, `API-*`, `QUE-004`.
- Nguoi B: `APP-*`, `DB-*`, `CAT-*`, `MED-*`, `QUE-*`, `REL-001`.
- Nguoi C: `GRP-*`, `TPL-*`, `CMP-*`, `UI-*`, `PW-*`, `QA-*`, `SEC-*`.
- Review cheo theo vong A review C, B review A, C review B.

Khong de hai nguoi sua cung luc cac file ownership cao sau:

- Root `package.json`, `package-lock.json` va `.gitignore`.
- `src/lib/supabase/server.ts`, `src/lib/api/guard.ts` va database types.
- SQLite migration index va preload IPC contract.
- Queue state enum va Facebook locator registry.

Moi task la mot branch/PR nho. Ten branch mau:

```text
feat/fbp-api-003-bearer-auth
feat/fbp-app-001-electron-scaffold
feat/fbp-pw-004-group-composer
test/fbp-que-003-crash-recovery
```

## 7. Dependency Map

```text
PUB-001 -> PUB-002 -> PUB-003 -> PUB-004
                       |-- API-001..006
                       |-- APP-001..005 + DB-001..002
                       `-- PW-001..003 bang local fixture

API + APP + DB
  |-- CAT/MED
  |-- GRP/TPL
  `-- PW-004..008

CAT + MED + GRP + TPL
  -> CMP
  -> QUE + PW result detection
  -> UI queue/history
  -> QA + Security
  -> Windows release
```

## 8. Milestone 0 - Chot Hop Dong Va Cach Lam

- [ ] **PUB-001 - Chot pham vi van hanh**  
  Owner: DEV-A. Reviewer: chu du an + DEV-D. Depends: khong. Size: S.  
  Lam: chot supported/non-goals, group test rieng, `headless: false`, assisted mode mac dinh va
  cac truong hop bat buoc dung queue.  
  Kiem tra: moi thanh vien mo ta giong nhau mot vertical slice; khong con yeu cau mo ho nhu
  "thanh cong" hay "tu dong".

- [ ] **PUB-002 - ADR kien truc desktop**  
  Owner: DEV-A + DEV-B. Reviewer: DEV-C. Depends: PUB-001. Size: M.  
  Lam: ghi ADR cho Electron main/renderer/preload, SQLite, Playwright worker, app data,
  browser provisioning va installer.  
  Kiem tra: ADR co so sanh trade-off, folder ownership va cach rollback quyet dinh.

- [ ] **PUB-003 - Khoa API contract va local model**  
  Owner: DEV-A + DEV-B. Reviewer: DEV-D. Depends: PUB-002. Size: M.  
  Lam: tao schema versioned cho product list/detail, group, template, campaign, job, attempt,
  error code va queue state.  
  Kiem tra: sample JSON duoc validate; web va desktop dung cung ten field/enum.

- [ ] **PUB-004 - Chuan hoa task evidence va verify scripts**  
  Owner: DEV-D. Reviewer: DEV-A. Depends: PUB-003. Size: S.  
  Lam: tao task evidence template, quy uoc severity va danh sach script bat buoc.  
  Kiem tra: mot task gia lap di duoc tu TODO den REVIEW va DONE ma khong thieu commit/test/reviewer.

### Gate M0

- [ ] Bon task `PUB-*` da checked.
- [ ] Owner va reviewer that da thay cac placeholder DEV-A..DEV-D.
- [ ] Da tao group Facebook test rieng va ghi ro ai duoc phep dung.
- [ ] `auto-submit` van tat cho moi truong that.

## 9. Milestone 1 - API San Pham Cho Desktop

Repo hien tai co `products.images` trong migration nhung `ProductRow` viet tay chua co field
nay. API public hien chi tra anh dai dien, gia thap nhat va specs gop, nen khong du de dang
dung bien the.

- [ ] **API-001 - Dong bo database types**  
  Owner: DEV-A. Reviewer: DEV-D. Depends: PUB-003. Size: S.  
  Lam: regenerate hoac cap nhat types, bao gom `products.images`; khong lam mat cac field dang
  duoc UI su dung.  
  Kiem tra: `npm run typecheck`; tao mot type-level test/doc sample truy cap `product.images`.

- [ ] **API-002 - Permission chi doc cho publisher**  
  Owner: DEV-A. Reviewer: DEV-D. Depends: API-001. Size: M.  
  Lam: them migration/seed permission `publisher.use`, gan qua role hien co va giu RLS theo
  organization.  
  Kiem tra: user co quyen doc duoc; user thieu quyen nhan `403`; user org A khong doc org B.

- [ ] **API-003 - Supabase bearer auth cho desktop**  
  Owner: DEV-A. Reviewer: DEV-D. Depends: API-002. Size: L.  
  Lam: bo sung server client/guard doc `Authorization: Bearer` ma khong lam hong session cookie
  cua web. Khong cap service-role key cho app.  
  Kiem tra: cookie cu van `200`; bearer hop le `200`; token thieu/het han `401`; thieu quyen
  `403`; co integration tests.

- [ ] **API-004 - Endpoint danh sach publishing products**  
  Owner: DEV-A. Reviewer: DEV-D. Depends: API-003. Size: M.  
  Lam: `GET /api/v1/desktop-posting/products` co search, pagination, `updatedSince`, status
  active, thumbnail, updatedAt, variantsCount va inStock.  
  Kiem tra: empty data van `200` dung contract; server error khong bi nuot thanh empty `200`;
  pagination va org isolation dat.

- [ ] **API-005 - Endpoint chi tiet publishing product**  
  Owner: DEV-A. Reviewer: DEV-D. Depends: API-003. Size: L.  
  Lam: `GET /api/v1/desktop-posting/products/:id` tra product URL, mo ta plain text, gallery
  va tung variant voi SKU, attributes, specs, sellingPrice, isActive, availableQty tong hop.  
  Kiem tra: gia/spec/stock luon cung mot variant; HTML duoc parse bang parser, khong regex tuy
  tien; nhieu kho va variant inactive co test.

- [ ] **API-006 - Contract va security test suite**  
  Owner: DEV-A. Reviewer: DEV-D. Depends: API-004, API-005. Size: M.  
  Lam: them test runner neu can va cover `200/401/403/404`, org isolation, pagination, out of
  stock, nhieu kho, anh rong va description HTML.  
  Kiem tra: mot command chay toan bo contract tests; response duoc validate bang schema tu
  `PUB-003`.

Contract detail muc tieu:

```ts
{
  product: {
    id, name, slug, shortDescription, plainTextDescription,
    thumbnailUrl, images, productUrl, updatedAt
  },
  variants: [{
    id, sku, name, attributes, specs,
    sellingPrice, availableQty, isActive
  }]
}
```

### Gate M1

- [ ] Tat ca `API-*` da checked.
- [ ] Cookie auth cua web khong regression.
- [ ] Khong co service-role key trong response, bundle hay test fixture.
- [ ] Desktop co the lay dung mot san pham, bien the, gia, ton va gallery bang bearer token.

## 10. Milestone 2 - Nen Tang Electron Va SQLite

- [ ] **APP-001 - Scaffold Electron + React + TypeScript**  
  Owner: DEV-B. Reviewer: DEV-C. Depends: PUB-002. Size: L.  
  Lam: tao `apps/facebook-publisher`, dev/build/test/verify/package scripts va shell app. Root
  Next.js van build doc lap.  
  Kiem tra: app mo duoc o dev; desktop typecheck/build pass; root typecheck/build van pass.

- [ ] **APP-002 - Harden BrowserWindow va typed IPC**  
  Owner: DEV-B. Reviewer: DEV-C + DEV-D. Depends: APP-001. Size: M.  
  Lam: `contextIsolation: true`, `nodeIntegration: false`, sandbox, CSP, navigation allowlist
  va preload API nho nhat co the. Validate IPC ca hai phia.  
  Kiem tra: renderer khong co `require`/filesystem; payload sai schema bi tu choi; external
  navigation/window bi chan.

- [ ] **APP-003 - Settings va config validation**  
  Owner: DEV-B. Reviewer: DEV-C. Depends: APP-002. Size: M.  
  Lam: API base URL, locale, posting mode, timeout va diagnostics TTL; validate schema va co
  default an toan.  
  Kiem tra: config sai khong khoi dong worker; renderer khong doc file tuy y; assisted mode la
  default.

- [ ] **APP-004 - Secure token storage**  
  Owner: DEV-B. Reviewer: DEV-D. Depends: APP-002. Size: M.  
  Lam: dung Electron `safeStorage`/OS credential protection; refresh token ma hoa, access
  token ngan han, logout xoa secret va log redact.  
  Kiem tra: restart van refresh duoc; logout khong con token; tim trong log/DB khong thay token
  plain text.

- [ ] **DB-001 - SQLite schema va migrations**  
  Owner: DEV-B. Reviewer: DEV-C. Depends: APP-001, PUB-003. Size: L.  
  Lam: migrations cho `product_cache`, `variant_cache`, `facebook_groups`, `group_sets`,
  `templates`, `campaigns`, `post_jobs`, `job_attempts`, `settings`; bat foreign keys va WAL.  
  Kiem tra: DB rong migrate duoc; constraints ngan orphan/duplicate can thiet; transaction
  rollback khi migration loi.

- [ ] **DB-002 - Repository va restart recovery tests**  
  Owner: DEV-B. Reviewer: DEV-C. Depends: DB-001. Size: M.  
  Lam: repository typed, transaction boundary va migration version tests.  
  Kiem tra: CRUD/transaction tests pass; restart app van doc dung queue/history; upgrade tu DB
  version truoc khong mat du lieu.

- [ ] **APP-005 - Login LapLap API tren desktop**  
  Owner: DEV-B. Reviewer: DEV-A. Depends: APP-003, APP-004, API-003. Size: M.  
  Lam: dang nhap Supabase/web, refresh session, logout va error state cho network/401/403.  
  Kiem tra: login/logout/restart pass; token het han duoc refresh hoac yeu cau login lai ma
  khong lam mat queue.

### Gate M2

- [ ] Tat ca `APP-*`, `DB-*` da checked.
- [ ] Main/renderer/preload security gate pass.
- [ ] SQLite upgrade/restart test pass.
- [ ] Root web va desktop deu build doc lap.

## 11. Milestone 3 - San Pham, Group, Template Va Campaign

- [ ] **CAT-001 - API client va product sync/cache**  
  Owner: DEV-B + DEV-A. Reviewer: DEV-C. Depends: APP-005, API-004..006, DB-002. Size: L.  
  Lam: API client, incremental sync, lastSyncAt, offline cache va stale indicator. Cache khong
  duoc coi la ton kho hien tai khi enqueue/post.  
  Kiem tra: online/offline/token expired/empty page duoc phan biet; sync khong tao duplicate.

- [ ] **CAT-002 - UI chon product va variant**  
  Owner: DEV-C. Reviewer: DEV-B. Depends: CAT-001. Size: M.  
  Lam: search/filter, ton kho, gallery, gia/spec va bat buoc chon dung mot variant.  
  Kiem tra: product nhieu variant khong ghep gia cua variant A voi specs cua variant B; empty,
  loading, stale va error state ro rang.

- [ ] **MED-001 - Download va cache anh**  
  Owner: DEV-B. Reviewer: DEV-D. Depends: CAT-001. Size: M.  
  Lam: tai ve app data/temp, kiem HTTP/MIME/size, safe filename, checksum, thu tu anh, TTL va
  cleanup. Chi cho phep URL/host hop le theo config.  
  Kiem tra: 404, redirect la, MIME gia, file qua lon va duplicate co test; anh loi khong enqueue.

- [ ] **GRP-001 - CRUD Facebook group thu cong**  
  Owner: DEV-C. Reviewer: DEV-B. Depends: DB-002. Size: M.  
  Lam: ten, URL chuan hoa, enabled, locale, notes, maxImages, allowLink va posting mode. Khong
  scrape danh sach group.  
  Kiem tra: URL `facebook.com/groups/...` hop le; URL trung/khong hop le bi chan; delete co
  confirm va khong pha history.

- [ ] **GRP-002 - Bo group**  
  Owner: DEV-C. Reviewer: DEV-B. Depends: GRP-001. Size: S.  
  Lam: tao/sua/xoa group set va chon nhanh nhom enabled.  
  Kiem tra: xoa set khong xoa group; group disabled khong tu dong vao campaign.

- [ ] **TPL-001 - Template engine an toan**  
  Owner: DEV-C. Reviewer: DEV-D. Depends: DB-002, PUB-003. Size: M.  
  Lam: allowlist bien, format gia/spec/null/URL, bao bien thieu va khong dung `eval`.  
  Kiem tra: unit test Unicode tieng Viet, ky tu dac biet, field null, unknown variable va noi
  dung dai.

- [ ] **TPL-002 - Template editor va preview**  
  Owner: DEV-C. Reviewer: DEV-B. Depends: TPL-001, CAT-002. Size: M.  
  Lam: editor, danh sach bien, preview final text theo variant va cho sua truoc campaign.  
  Kiem tra: preview giong snapshot enqueue; warning khong che noi dung/nut; text khong bi cat.

- [ ] **CMP-001 - Campaign wizard**  
  Owner: DEV-C. Reviewer: DEV-B. Depends: CAT-002, MED-001, GRP-002, TPL-002. Size: L.  
  Lam: product/variant -> template -> images -> groups -> review -> enqueue; co back/next va
  preflight matrix.  
  Kiem tra: back/next khong mat du lieu; thieu variant/anh/group bi chan; campaign test mot
  group co duong di ngan.

- [ ] **CMP-002 - Job snapshot bat bien**  
  Owner: DEV-B. Reviewer: DEV-C. Depends: CMP-001. Size: M.  
  Lam: moi job luu rendered text, gia, specs, image path/hash, product/variant ID va updatedAt
  tai luc duyet.  
  Kiem tra: sua template/product sau enqueue khong am tham sua job cu; preflight van phat hien
  du lieu source da thay doi.

- [ ] **CMP-003 - Fingerprint chong trung**  
  Owner: DEV-B. Reviewer: DEV-D. Depends: CMP-002. Size: M.  
  Lam: hash group + product/variant + normalized content + ordered media hashes; override phai
  co ly do va audit.  
  Kiem tra: duplicate bi chan; doi noi dung/anh/group tao fingerprint dung; unit tests cover
  thu tu anh va Unicode normalization.

### Gate M3

- [ ] Product sync dung variant va hien thi stale state.
- [ ] CRUD group/template va campaign wizard checked.
- [ ] Moi queue job co snapshot va fingerprint bat bien.
- [ ] Anh temp duoc validate, khong lo secret va co cleanup.

## 12. Milestone 4 - Playwright Facebook Adapter

- [ ] **PW-001 - Persistent browser profile manager**  
  Owner: DEV-D. Reviewer: DEV-A. Depends: APP-003. Size: L.  
  Lam: `launchPersistentContext` voi profile rieng trong app data, headed mode va profile lock.
  Khong tro vao Chrome profile ca nhan.  
  Kiem tra: restart giu session; context thu hai cung profile bi chan; profile path khong nam
  trong repo/install dir.

- [ ] **PW-002 - Login/2FA thu cong va session health**  
  Owner: DEV-D. Reviewer: DEV-A. Depends: PW-001. Size: M.  
  Lam: nut mo browser, phat hien logged-in/logged-out, het session va cho phep nguoi dung xu ly
  2FA/checkpoint. Khong luu password Facebook.  
  Kiem tra: login, logout tren Facebook va restart app cho status dung; queue khong chay khi
  session invalid.

- [ ] **PW-003 - FacebookGroupAdapter va local fixture**  
  Owner: DEV-D. Reviewer: DEV-A. Depends: PW-001, GRP-001. Size: L.  
  Lam: Page Object/adapter, locator role/label/text tieng Viet, locator registry tap trung va
  HTML fixture do du an so huu.  
  Kiem tra: fixture cover composer binh thuong, pending approval, no permission va unknown UI;
  khong co XPath/CSS chain dai gan chat DOM.

- [ ] **PW-004 - Dien text va upload anh**  
  Owner: DEV-D. Reviewer: DEV-C. Depends: PW-003, MED-001. Size: L.  
  Lam: mo group/composer, dien Unicode text, upload nhieu anh bang `setInputFiles`/filechooser,
  doi preview va xac nhan dung so luong/thu tu.  
  Kiem tra: fixture tests pass; timeout/media/permission/composer la tra error code co nghia.

- [ ] **PW-005 - Assisted confirmation va auto-submit gate**  
  Owner: DEV-D. Reviewer: DEV-A + chu du an. Depends: PW-004. Size: M.  
  Lam: assisted mode dung truoc buoc gui; auto-submit phai qua feature flag va revalidate job
  ngay truoc click.  
  Kiem tra: assisted mode khong tu click; auto-submit chi test tren fixture cho den khi
  `GOV-AUTO` duoc phe duyet; emergency stop chan click.

- [ ] **PW-006 - Xac minh ket qua dang**  
  Owner: DEV-D. Reviewer: DEV-B. Depends: PW-005. Size: L.  
  Lam: phan loai `published`, `pending_approval`, `unverified`; luu post URL khi co bang chung
  va moc `submitClickedAt`.  
  Kiem tra: khong coi "da click" la published; mat tin hieu sau click thanh `unverified` va
  khong auto retry.

- [ ] **PW-007 - Checkpoint/CAPTCHA/unknown UI detector**  
  Owner: DEV-D. Reviewer: DEV-A. Depends: PW-003. Size: M.  
  Lam: nhan dien login expired, checkpoint, CAPTCHA, warning, no permission va UI khong ro;
  chuyen `needs_action` va dung global queue.  
  Kiem tra: fixture moi case dung queue; khong co code bypass, proxy rotation hay anti-detection.

- [ ] **PW-008 - Diagnostics an toan**  
  Owner: DEV-D. Reviewer: DEV-B. Depends: PW-006, PW-007. Size: M.  
  Lam: screenshot/trace co TTL, nut xoa, log redact va luu trong app data.  
  Kiem tra: diagnostics khong chua cookie/header/token; cleanup theo TTL; error detail mo duoc
  tu history.

### Gate M4 - Vertical Slice Mot Group

- [ ] Login Facebook thu cong trong profile rieng.
- [ ] Chon mot product/variant va mot group test rieng.
- [ ] Playwright dien dung text, anh va dung o buoc confirm.
- [ ] Sau confirm, ket qua duoc phan loai dung va co evidence.
- [ ] Checkpoint/unknown UI dung queue; khong co hanh vi bypass.

## 13. Milestone 5 - Queue Tuan Tu, Recovery Va Lich Su

Queue state muc tieu:

```text
draft -> queued -> preflight -> posting -> awaiting_confirmation
  -> published | pending_approval | unverified | needs_action | failed | skipped | cancelled
```

- [ ] **QUE-001 - Durable queue state machine**  
  Owner: DEV-B. Reviewer: DEV-D. Depends: DB-002, CMP-002, PW-006. Size: M.  
  Lam: enum, transition table, transaction va attempt log; transition sai bi tu choi.  
  Kiem tra: unit test tat ca transition hop le/khong hop le; moi transition co timestamp va
  reason.

- [ ] **QUE-002 - Serial worker va controls**  
  Owner: DEV-B + DEV-D. Reviewer: DEV-C. Depends: QUE-001. Size: L.  
  Lam: concurrency luon `1`; start, pause, resume, cancel pending va emergency stop; khong lay
  job moi khi paused.  
  Kiem tra: integration test nhieu group van chi co mot job posting; cancel/stop khong khoi dong
  group tiep theo.

- [ ] **QUE-003 - Crash recovery va idempotency**  
  Owner: DEV-B. Reviewer: DEV-D. Depends: QUE-002. Size: L.  
  Lam: recovery dua tren phase va `submitClickedAt`; truoc click co the requeue, sau click phai
  `unverified`.  
  Kiem tra: kill/restart o moi phase; app khong tao bai trung; SQLite transaction giu dung state.

- [ ] **QUE-004 - Preflight gia va ton kho ngay truoc bai**  
  Owner: DEV-A + DEV-B. Reviewer: DEV-C. Depends: QUE-002, API-005. Size: L.  
  Lam: refetch variant; het hang -> `skipped`; gia/updatedAt thay doi -> dung cho xac nhan; loi
  mang -> khong submit.  
  Kiem tra: integration tests out-of-stock, price changed, product archived, token expired va
  network error.

- [ ] **QUE-005 - Retry policy co gioi han**  
  Owner: DEV-D. Reviewer: DEV-B. Depends: QUE-002. Size: M.  
  Lam: retry chi loi transient truoc submit, max attempts va backoff; permission/checkpoint/
  `unverified` khong auto retry.  
  Kiem tra: fake clock tests; retry khong vuot max; ly do retry/stop co trong attempt log.

- [ ] **UI-001 - Queue control screen**  
  Owner: DEV-C. Reviewer: DEV-B. Depends: QUE-003, QUE-005. Size: L.  
  Lam: progress theo group, status, attempts, Pause/Resume/Cancel/Stop va `needs_action`.  
  Kiem tra: controls disabled/enabled dung state; text/nut khong overlap; UI restart doc dung
  queue dang do.

- [ ] **UI-002 - History va attempt detail**  
  Owner: DEV-C. Reviewer: DEV-D. Depends: PW-008, UI-001. Size: M.  
  Lam: hien attempt, error code, screenshot/trace, post URL va thao tac resolve `unverified`.  
  Kiem tra: retry bi khoa voi `unverified` cho den khi nguoi dung kiem tra va xac nhan; file da
  cleanup co empty state dung.

### Gate M5 - Chien Dich Nhieu Group

- [ ] Queue chay dung mot bai tai mot thoi diem.
- [ ] Pause/Resume/Cancel/Emergency Stop khong tao job moi ngoai y muon.
- [ ] Crash/restart khong tao bai trung.
- [ ] Gia/ton kho thay doi chan bai dung quy tac.
- [ ] `pending_approval`, `published` va `unverified` khong bi tron.

## 14. Milestone 6 - QA, Security Va Windows Release

- [ ] **QA-001 - Automated test matrix va mot lenh verify**  
  Owner: DEV-D. Reviewer: DEV-A. Depends: API-006, UI-002. Size: L.  
  Lam: unit cho template/rule/dedupe/state/retry; integration cho API/SQLite/IPC/media/adapter;
  E2E Electron + API mock + Facebook fixture.  
  Kiem tra: `npm run verify` desktop exit `0`; coverage tong >= 80%, branch cua queue/dedupe/
  template >= 90%; coverage khong thay acceptance tests.

- [ ] **QA-002 - Manual smoke tren group test rieng**  
  Owner: DEV-D. Reviewer: chu du an + DEV-A. Depends: QA-001. Size: L.  
  Lam: headed browser, tai khoan test duoc phep, mot bai/luc, assisted confirm; test text + anh,
  pending approval, no permission va session expired.  
  Kiem tra: co Expected/Actual, post URL/status, commit va evidence da che thong tin nhay cam.
  Auto-submit that khong nam trong smoke neu `GOV-AUTO` chua pass.

- [ ] **SEC-001 - Security gate**  
  Owner: DEV-D. Reviewer: DEV-A + DEV-B. Depends: QA-001. Size: M.  
  Lam: threat model, IPC/navigation allowlist, secret scan, profile permission, log redaction,
  dependency audit va artifact cleanup.  
  Kiem tra: renderer payload la bi chan; khong co service key/token/cookie trong bundle/log;
  browser profile chi user hien tai truy cap.

- [ ] **REL-001 - Windows package, browser provisioning va upgrade**  
  Owner: DEV-B. Reviewer: DEV-D. Depends: QA-002, SEC-001. Size: L.  
  Lam: installer/portable theo quyet dinh ADR, cung cap Chromium phu hop, version/changelog,
  uninstall va rollback. App data/profile khong nam trong install directory.  
  Kiem tra: clean install, upgrade va uninstall tren Windows muc tieu; DB/profile/history con
  dung sau update; tao SHA-256; ban phan phoi rong phai code-sign.

- [ ] **DOC-001 - Runbook van hanh va su co**  
  Owner: DEV-A. Reviewer: DEV-C + DEV-D. Depends: QA-002. Size: M.  
  Lam: login, backup/restore DB, xoa diagnostics, xu ly `unverified`, cap nhat locator khi
  Facebook doi UI, rollback va xoa profile.  
  Kiem tra: mot nguoi khong code lam theo runbook tren may test va hoan thanh vertical slice.

### Gate Release MVP

- [ ] Tat ca task P0/MVP da checked boi reviewer.
- [ ] `npm ci`, web gate va desktop `verify` pass tren clean checkout.
- [ ] E2E fixture pass hai lan lien tiep tren build release.
- [ ] Manual smoke assisted mode tren group test rieng pass.
- [ ] Clean install, upgrade, rollback va DB migration pass.
- [ ] Khong con P0/P1 va khong co secret/profile trong artifact.
- [ ] Co version, changelog, SHA-256 va installer phien ban truoc de rollback.

Lenh release du kien:

```powershell
npm ci
npm run lint
npm run typecheck
npm run build
npm --prefix apps/facebook-publisher ci
npm --prefix apps/facebook-publisher run verify
npm --prefix apps/facebook-publisher run test:e2e -- --repeat-each=2
npm --prefix apps/facebook-publisher run package:win
Get-FileHash .\apps\facebook-publisher\release\*.exe -Algorithm SHA256
```

## 15. Test Cases Bat Buoc

| ID | Tinh huong | Ket qua bat buoc |
|---|---|---|
| TC-01 | Queue co nhieu group | Chi mot job o `posting` tai moi thoi diem |
| TC-02 | Pause/Cancel/Emergency Stop | Khong lay job tiep theo, state va reason duoc luu |
| TC-03 | App crash truoc click submit | Job co the requeue theo retry policy |
| TC-04 | App crash/mat mang sau click submit | Job thanh `unverified`, khong auto retry |
| TC-05 | Gia/ton kho doi sau enqueue | Preflight chan va yeu cau xu ly dung quy tac |
| TC-06 | CAPTCHA/checkpoint/login expired | Global queue dung, job thanh `needs_action` |
| TC-07 | Group can duyet bai | `pending_approval`, khong phai `published` |
| TC-08 | Upload nhieu anh | Dung so luong, thu tu va checksum snapshot |
| TC-09 | Trung product/group/content/media | Dedupe chan; override co ly do va audit |
| TC-10 | Bearer token het han | Refresh/login state dung, queue khong mat |
| TC-11 | IPC payload la | Main tu choi, khong doc file/chay lenh tuy y |
| TC-12 | UI Facebook khong nhan dien | Dung queue, diagnostics an toan, khong click mo ho |

Test tu dong Playwright phai chay tren HTML fixture do du an so huu. Smoke Facebook that chi
dung tai khoan test va group rieng duoc phep, mot bai moi lan, browser hien thi va khong vuot
checkpoint.

## 16. Mau Evidence Khi Check Task

Them mot dong vao log ben duoi truoc khi reviewer tick task:

```text
Task ID:
Owner / branch:
Commit:
Moi truong:
Commands + exit code:
Expected:
Actual:
Test/coverage report:
Screenshot/trace/report path:
Security notes:
Reviewer + ngay:
Ket luan: PASS | FAIL
```

### Verification Log

| Task | Commit | Commands/evidence | Reviewer | Ngay | Ket qua |
|---|---|---|---|---|---|
| | | | | | |

Khong commit hoac upload cookie, token, browser profile, `.env.local`, trace hay screenshot co
thong tin tai khoan Facebook. Evidence nhay cam phai duoc che va luu o artifact store co quyen
truy cap/TTL phu hop.

## 17. Quy Trinh Lam Mot Task

1. Assignee kiem tra dependency da `[x]`.
2. Assignee gan ten, branch va `DOING` vao task.
3. Lam dung acceptance criteria, khong mo rong scope ngam.
4. Viet/chay test cung task; cap nhat docs neu contract thay doi.
5. Chay verify cua package bi anh huong va root gate neu cham web.
6. Ghi evidence gan voi commit hien tai.
7. Chuyen sang `REVIEW`, khong tu tick task chinh.
8. Reviewer checkout commit, chay lai checks va kiem acceptance criteria.
9. Reviewer ghi verification log va tick `[x]` neu PASS.
10. Neu FAIL, giu `[ ]`, ghi ly do va tra task ve `DOING` hoac `BLOCKED`.

## 18. Backlog Sau MVP

- [ ] **P2-001 - Scheduler, quiet hours, tray va Windows startup**.
- [ ] **P2-002 - Template/rule override rieng cho tung group**.
- [ ] **P2-003 - Form `Ban mat hang` voi price/category/condition/location**.
- [ ] **P2-004 - Nhieu Facebook profile tach biet, queue van khong chay song song mac dinh**.
- [ ] **P2-005 - UTM theo group/campaign va bao cao click/don hang**.
- [ ] **P2-006 - Trigger khi co hang moi, giam gia hoac co hang tro lai**.
- [ ] **P2-007 - Nhac xu ly bai cu khi het hang, khong tu xoa neu chua xac nhan**.
- [ ] **P2-008 - Workflow nhan vien soan -> quan ly duyet -> queue**.
- [ ] **P2-009 - Selector health check, feature flag va rollback adapter**.
- [ ] **P2-010 - Auto-update co ky so va rollback tu dong**.

Backlog P2 chi duoc tach task chi tiet sau khi Gate Release MVP pass. Khong keo P2 vao MVP neu
khong co quyet dinh scope bang van ban.
