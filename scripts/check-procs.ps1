Get-Process flyctl -ErrorAction SilentlyContinue |
  Select-Object Id, CPU, StartTime,
    @{N='RuntimeMin';E={[math]::Round(((Get-Date) - $_.StartTime).TotalMinutes, 1)}} |
  Format-Table -AutoSize
