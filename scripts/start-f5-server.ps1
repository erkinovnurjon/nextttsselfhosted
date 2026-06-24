# NextTTS F5-TTS server (natural female + "my voice" zero-shot clone) :8001
# Requires a CUDA GPU. Optional -- MMS/Piper voices work without it.
# Usage: .\scripts\start-f5-server.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TtsServer = Join-Path $ProjectRoot "tts-server"
$VenvPython = Join-Path $TtsServer ".venv-f5\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] F5 venv not found: $VenvPython" -ForegroundColor Red
    Write-Host "Create it: cd tts-server; python -m venv .venv-f5; then install torch (CUDA) + f5-tts + transformers==4.49.0" -ForegroundColor Yellow
    exit 1
}

$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"

Set-Location $TtsServer
Write-Host "[INFO] F5 server starting: http://127.0.0.1:8001 (warmup ~150s on first start)" -ForegroundColor Cyan

& $VenvPython -m uvicorn f5_server:app --host 127.0.0.1 --port 8001
