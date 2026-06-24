# NextTTS main backend (MMS TTS + Whisper ASR + F5/Piper proxy) :8000
# Foydalanish: .\scripts\start-tts-server.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TtsServer = Join-Path $ProjectRoot "tts-server"
$VenvPython = Join-Path $TtsServer ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Venv topilmadi: $VenvPython" -ForegroundColor Red
    Write-Host "Avval: cd tts-server; uv venv --python 3.11; uv pip install -e ." -ForegroundColor Yellow
    exit 1
}

$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

Set-Location $TtsServer
Write-Host "[INFO] TTS server boshlanmoqda: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "[INFO] Birinchi marta model yuklanadi (30-60 soniya)" -ForegroundColor Yellow
Write-Host ""

& $VenvPython -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
