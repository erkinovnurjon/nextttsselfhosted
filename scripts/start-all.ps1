# NextTTS — Frontend va TTS serverni alohida terminallarda ishga tushirish
# Foydalanish: .\scripts\start-all.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host "[INFO] Ikkita terminal oynasi ochiladi: TTS server + Frontend" -ForegroundColor Cyan

$ttsScript = Join-Path $PSScriptRoot "start-tts-server.ps1"
$frontScript = Join-Path $PSScriptRoot "start-frontend.ps1"

Start-Process powershell -ArgumentList "-NoExit", "-File", $ttsScript -WindowStyle Normal
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-File", $frontScript -WindowStyle Normal

Write-Host ""
Write-Host "[OK] Ikkalasi ham ishga tushdi" -ForegroundColor Green
Write-Host "    Frontend: http://localhost:3000" -ForegroundColor Green
Write-Host "    TTS API:  http://127.0.0.1:8000" -ForegroundColor Green
