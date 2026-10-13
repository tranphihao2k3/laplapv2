@echo off
setlocal
set "URL=https://bmvgnhgxbkrhixydsqjh.supabase.co/rest/v1/shops"
set "KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmduaGd4YmtyaGl4eWRzcWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ1MTM1MCwiZXhwIjoyMDk1MDI3MzUwfQ.IihN3gAGLs2YbRAbcCkFo6nAKZPtWB13Q86i95rYHOA"

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
