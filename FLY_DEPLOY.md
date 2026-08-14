# Fly.io deployment — LapLap

## Prerequisites

- [flyctl CLI](https://fly.io/docs/hands-on/install-flyctl/)
- Fly.io account (credit card required for verification, free tier OK)
- Supabase project (URL + keys)

## First-time setup

```bash
# 1. Login
flyctl auth login

# 2. Verify app exists (skip if creating new)
flyctl apps list

# 3. Set secrets (NEVER commit env vars)
flyctl secrets set \
  NEXT_PUBLIC_SUPABASE_URL="https://xxx.supabase.co" \
  NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJ..." \
  SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  RESEND_API_KEY="re_..." \
  RESEND_WEBHOOK_SECRET="whsec_..." \
  OPENAI_API_KEY="sk-..." \
  CRON_SECRET="..." \
  GEMINI_API_KEY="..." \
  -a laplapv2
```

## Build & deploy

```bash
# 1. Build image locally (verify Dockerfile works)
flyctl deploy --build-only -a laplapv2

# 2. If success, deploy
flyctl deploy -a laplapv2

# 3. Open app
flyctl open -a laplapv2
```

## Logs & monitoring

```bash
# Real-time logs
flyctl logs -a laplapv2

# Status
flyctl status -a laplapv2

# Scale (free tier = 1 shared-cpu-1x 256MB. nâng lên 512MB)
flyctl scale memory 512 -a laplapv2

# Restart
flyctl restart -a laplapv2
```

## Database setup

1. Run `supabase/migrations/024_storage_buckets.sql` trong Supabase SQL Editor
2. Verify buckets ở Dashboard > Storage:
   - `speaker-audio` (public)
   - `tools` (private)

## Migration từ R2 (chạy 1 lần)

```bash
# 1. Download tất cả files từ R2 (dùng wrangler)
# 2. Upload lên Supabase Storage
# 3. Chạy /api/v1/speaker-songs/fix-urls để update URLs cũ

curl -X POST https://laplapcantho.store/api/v1/speaker-songs/fix-urls \
  -H "Authorization: Bearer <admin_token>"
```

## Custom domain

```bash
flyctl certs add laplapcantho.store -a laplapv2
# Sau đó add CNAME/A records ở DNS provider
```

## Free tier limits

- 3 shared-cpu-1x VMs (256MB each)
- 160GB outbound data transfer/month
- Auto-stop when idle (machines spin down)
- Cold start ~2-3s sau khi idle

## Troubleshooting

### Build fails with `CLOUDFLARE_API_TOKEN`
→ Đảm bảo `Dockerfile` dùng `npx next build` (KHÔNG `--experimental-build-mode`).
→ Verify OpenNext Cloudflare deps KHÔNG còn trong `package.json`.

### Health check fails
```bash
flyctl logs -a laplapv2 | grep health
curl https://laplapv2.fly.dev/api/health
```

### Supabase Storage error
→ Verify service-role key có quyền admin (`SUPABASE_SERVICE_ROLE_KEY`)
→ Verify buckets đã tạo (`SELECT * FROM storage.buckets`)
