# NextTTS -- start all servers in separate terminals.
# Usage: .\scripts\start-all.ps1  [-NoF5]
#   main backend :8000 (MMS + ASR + proxy) | Piper :8002 (DEFAULT voice)
#   F5 :8001 (GPU, natural female + clone) | Frontend :3000
# -NoF5 : skip the F5 server (no GPU / not needed).
param([switch]$NoF5)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

function Start-Term($file) {
    Start-Process powershell -ArgumentList "-NoExit", "-File", (Join-Path $PSScriptRoot $file) -WindowStyle Normal
    Start-Sleep -Seconds 2
}

Write-Host "[INFO] Starting NextTTS servers..." -ForegroundColor Cyan
Start-Term "start-tts-server.ps1"     # :8000 main backend (MMS + ASR)
Start-Term "start-piper-server.ps1"   # :8002 Piper (DEFAULT voice -- required)
if (-not $NoF5) {
    Start-Term "start-f5-server.ps1"  # :8001 F5 (GPU; natural female + my-voice clone)
}
Start-Term "start-frontend.ps1"       # :3000 Next.js web

Write-Host ""
Write-Host "[OK] Servers launched in separate windows:" -ForegroundColor Green
Write-Host "    Frontend:     http://localhost:3000" -ForegroundColor Green
Write-Host "    Main API:     http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "    Piper (def):  http://127.0.0.1:8002" -ForegroundColor Green
if (-not $NoF5) { Write-Host "    F5 (GPU):     http://127.0.0.1:8001" -ForegroundColor Green }
