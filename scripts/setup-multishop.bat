@echo off
setlocal
set "URL=https://bmvgnhgxbkrhixydsqjh.supabase.co/rest/v1/shops"
set "KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJtdmduaGd4YmtyaGl4eWRzcWpoIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQ1MTM1MCwiZXhwIjoyMDk1MDI3MzUwfQ.IihN3gAGLs2YbRAbcCkFo6nAKZPtWB13Q86i95rYHOA"

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
