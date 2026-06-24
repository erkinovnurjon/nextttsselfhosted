# NextTTS Piper TTS server (native Uzbek female voice) :8002
# DEFAULT voice source -- without this, the default voice returns 503.
# Usage: .\scripts\start-piper-server.ps1

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$TtsServer = Join-Path $ProjectRoot "tts-server"
$VenvPython = Join-Path $TtsServer "venv-piper\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[ERROR] Piper venv not found: $VenvPython" -ForegroundColor Red
    Write-Host "Create it: cd tts-server; python -m venv venv-piper; venv-piper\Scripts\pip install onnxruntime piper-tts fastapi uvicorn soundfile" -ForegroundColor Yellow
    exit 1
}

$env:PYTHONIOENCODING = "utf-8"
$env:PYTHONUTF8 = "1"

Set-Location $TtsServer
Write-Host "[INFO] Piper server starting: http://127.0.0.1:8002" -ForegroundColor Cyan

& $VenvPython -m uvicorn piper_server:app --host 127.0.0.1 --port 8002
