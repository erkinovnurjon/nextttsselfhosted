# NextTTS Next.js frontend ishga tushirish
# Foydalanish: .\scripts\start-frontend.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot

if (-not (Test-Path (Join-Path $ProjectRoot "node_modules"))) {
    Write-Host "[INFO] node_modules yo'q, npm install ishga tushiriladi..." -ForegroundColor Yellow
    Set-Location $ProjectRoot
    npm install
}

Set-Location $ProjectRoot
Write-Host "[INFO] Frontend boshlanmoqda: http://localhost:3000" -ForegroundColor Cyan
Write-Host ""

npm run dev
