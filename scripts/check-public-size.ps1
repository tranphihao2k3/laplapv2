Get-ChildItem 'C:\Users\admin\Documents\code ne\laplap-laptop\public' -Recurse -ErrorAction SilentlyContinue |
  Where-Object { -not $_.PSIsContainer } |
  Sort-Object Length -Descending |
  Select-Object -First 8 FullName, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}} |
  Format-Table -AutoSize
