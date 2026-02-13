# PowerShell script to kill process on port 3001
$port = 3001
$process = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique

if ($process) {
    Write-Host "Killing process $process on port $port..."
    Stop-Process -Id $process -Force
    Start-Sleep -Seconds 1
    Write-Host "Port $port is now free."
} else {
    Write-Host "Port $port is already free."
}
