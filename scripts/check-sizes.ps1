$ErrorActionPreference = 'SilentlyContinue'

Write-Host "=== FurMark_win64 ===" -ForegroundColor Yellow
$furmark = Get-ChildItem 'C:\Users\admin\Documents\code ne\laplap-laptop\public\scripts\FurMark_win64' -Recurse
if ($furmark) {
  $sum = ($furmark | Measure-Object -Property Length -Sum).Sum
  Write-Host ("Files: {0}, Size: {1} MB" -f $furmark.Count, [math]::Round($sum/1MB, 2))
} else {
  Write-Host "absent or empty"
}

Write-Host ""
Write-Host "=== Toolcheck ===" -ForegroundColor Yellow
if (Test-Path 'C:\Users\admin\Documents\code ne\laplap-laptop\Toolcheck') {
  $tool = Get-ChildItem 'C:\Users\admin\Documents\code ne\laplap-laptop\Toolcheck' -Recurse
  $sum = ($tool | Measure-Object -Property Length -Sum).Sum
  Write-Host ("Files: {0}, Size: {1} MB" -f $tool.Count, [math]::Round($sum/1MB, 2))
} else {
  Write-Host "absent"
}

Write-Host ""
Write-Host "=== .wrangler ===" -ForegroundColor Yellow
if (Test-Path 'C:\Users\admin\Documents\code ne\laplap-laptop\.wrangler') {
  $w = Get-ChildItem 'C:\Users\admin\Documents\code ne\laplap-laptop\.wrangler' -Recurse
  $sum = ($w | Measure-Object -Property Length -Sum).Sum
  Write-Host ("Files: {0}, Size: {1} MB" -f $w.Count, [math]::Round($sum/1MB, 2))
} else {
  Write-Host "absent"
}

Write-Host ""
Write-Host "=== .claude ===" -ForegroundColor Yellow
if (Test-Path 'C:\Users\admin\Documents\code ne\laplap-laptop\.claude') {
  $c = Get-ChildItem 'C:\Users\admin\Documents\code ne\laplap-laptop\.claude' -Recurse
  $sum = ($c | Measure-Object -Property Length -Sum).Sum
  Write-Host ("Files: {0}, Size: {1} MB" -f $c.Count, [math]::Round($sum/1MB, 2))
} else {
  Write-Host "absent"
}

Write-Host ""
Write-Host "=== Total project (excluding node_modules, .next, .git) ===" -ForegroundColor Yellow
$all = Get-ChildItem 'C:\Users\admin\Documents\code ne\laplap-laptop' -Recurse -Force |
  Where-Object { -not $_.PSIsContainer -and
    $_.FullName -notmatch '[\\/]node_modules[\\/]' -and
    $_.FullName -notmatch '[\\/]\.next[\\/]' -and
    $_.FullName -notmatch '[\\/]\.git[\\/]' }
$sum = ($all | Measure-Object -Property Length -Sum).Sum
Write-Host ("Files: {0}, Size: {1} MB" -f $all.Count, [math]::Round($sum/1MB, 2))
