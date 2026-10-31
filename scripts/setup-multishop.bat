@echo off
setlocal
set "URL=https://bmvgnhgxbkrhixydsqjh.supabase.co/rest/v1/shops"
REM Service role key KHONG hardcode trong repo. Set truoc khi chay:
REM   set "SUPABASE_SERVICE_ROLE_KEY=..."
if "%SUPABASE_SERVICE_ROLE_KEY%"=="" (
  echo ERROR: thieu bien moi truong SUPABASE_SERVICE_ROLE_KEY
  exit /b 1
)
set "KEY=%SUPABASE_SERVICE_ROLE_KEY%"

echo === Updating shop 1 (laplapcantho.store) ===
curl -s -X PATCH "%URL%?id=eq.eb676ce1-9af7-4c40-bb54-3833d7e30d10" ^
  -H "apikey: %KEY%" -H "Authorization: Bearer %KEY%" ^
  -H "Content-Type: application/json" -H "Prefer: return=representation" ^
  --data "{\"name\":\"LapLap Cần Thơ\",\"primary_domain\":\"laplapcantho.store\",\"allowed_domains\":[\"laplapcantho.store\",\"www.laplapcantho.store\"]}"
echo.

echo === Creating shop 2 (laptopthanhvo.com) ===
curl -s -X POST "%URL%" ^
  -H "apikey: %KEY%" -H "Authorization: Bearer %KEY%" ^
  -H "Content-Type: application/json" -H "Prefer: return=representation" ^
  --data "{\"name\":\"Laptop Thành Võ\",\"code\":\"LTV\",\"phone\":\"0987654321\",\"email\":\"contact@laptopthanhvo.com\",\"address\":\"123 Nguyễn Văn Cừ, Quận Ninh Kiều, TP. Cần Thơ\",\"primary_domain\":\"laptopthanhvo.com\",\"allowed_domains\":[\"laptopthanhvo.com\",\"www.laptopthanhvo.com\"],\"is_active\":true}"
echo.

echo === Verifying ===
curl -s "%URL%?select=id,name,primary_domain,allowed_domains" ^
  -H "apikey: %KEY%" -H "Authorization: Bearer %KEY%"
echo.
