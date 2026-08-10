# Build scanner zip va chay nhanh test parse
$resp = Invoke-WebRequest -Uri 'http://localhost:3000/api/v1/system-scan/download?token=TEST-RUN' -Method GET -UseBasicParsing -TimeoutSec 30 -OutFile "$env:TEMP\scanner.zip"
Expand-Archive "$env:TEMP\scanner.zip" -DestinationPath "$env:TEMP\scanner-test" -Force
Get-ChildItem "$env:TEMP\scanner-test" | Format-Table Name, Length

# Lay file ps1
$ps1 = Get-ChildItem "$env:TEMP\scanner-test" -Filter *.ps1 | Select-Object -First 1
Write-Host ("`n=== Trying to parse {0} ===" -f $ps1.Name)
$parseErrors = $null
$tokens = $null
[System.Management.Automation.Language.Parser]::ParseFile($ps1.FullName, [ref]$tokens, [ref]$parseErrors) | Out-Null
if ($parseErrors.Count -gt 0) {
    Write-Host "PARSE ERRORS:"
    $parseErrors | Select-Object -First 5 | Format-List
    exit 1
}
Write-Host "PARSE: OK"

# Xoa
Remove-Item "$env:TEMP\scanner-test" -Recurse -Force
Remove-Item "$env:TEMP\scanner.zip" -Force