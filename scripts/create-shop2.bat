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

echo === Get org_id from existing shop ===
for /f "delims=" %%i in ('curl -s "%URL%?select=organization_id&limit=1" -H "apikey: %KEY%" -H "Authorization: Bearer %KEY%"') do set "RAW=%%i"
echo RAW: %RAW%

REM Parse JSON manually - extract organization_id
for /f "tokens=2 delims=:,}" %%j in ('echo %RAW%') do set "ORG=%%j"
echo ORG: %ORG%

echo === Creating shop 2 (laptopthanhvo.com) with org_id ===
curl -s -X POST "%URL%" ^
  -H "apikey: %KEY%" -H "Authorization: Bearer %KEY%" ^
  -H "Content-Type: application/json" -H "Prefer: return=representation" ^
  --data "{\"organization_id\":\"%ORG:~\"%%\",\"name\":\"Laptop Thành Võ\",\"code\":\"LTV\",\"phone\":\"0987654321\",\"email\":\"contact@laptopthanhvo.com\",\"address\":\"456 Trần Hưng Đạo, Quận 1, TP. HCM\",\"primary_domain\":\"laptopthanhvo.com\",\"allowed_domains\":[\"laptopthanhvo.com\",\"www.laptopthanhvo.com\"],\"is_active\":true}"
echo.

echo === Verifying ===
curl -s "%URL%?select=id,name,code,primary_domain,allowed_domains" ^
  -H "apikey: %KEY%" -H "Authorization: Bearer %KEY%"
echo.
