# MMS 40h ko'p-spiker fine-tune (past LR 5e-6) DETACHED runner.
# Task Scheduler orqali ishga tushiriladi (sessiyadan mustaqil).
# NON-DESTRUKTIV: yangi papka mms_uzb_40h; hozirgi MMS-ayol (base+Praat) TEGILMAYDI.
$ErrorActionPreference = "Continue"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"

$tts  = "C:\Projects\nexttts\tts-server"
$ft   = "$tts\training\finetune-hf-vits"
$py   = "$tts\.venv\Scripts\python.exe"
$runs = "C:\Projects\nexttts\runs"
$log  = "$tts\training\data\mms_40h.log"

"=== MMS 40h RUN START: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Append -Encoding utf8

# 1) GPU serverlarni to'xtatish (:8000 backend + :8001 f5) — VRAM bo'shatish
"=== GPU serverlarni to'xtatish ===" | Out-File $log -Append -Encoding utf8
Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'uvicorn (server\.main|f5_server)' } | ForEach-Object {
    "  to'xtatildi PID $($_.ProcessId)" | Out-File $log -Append -Encoding utf8
    Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue
}
Start-Sleep -Seconds 8

# 2) TRAINING (finetune-hf-vits cwd — local utils/monotonic_align import qiladi)
"=== TRAINING (config_multispk_40h.json, LR 5e-6, 3 epoch) ===" | Out-File $log -Append -Encoding utf8
Set-Location $ft
& $py run_vits_finetuning.py config_multispk_40h.json 2>&1 | Out-File $log -Append -Encoding utf8
"TRAINING EXIT=$LASTEXITCODE : $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8

# 3) EVAL — base vs fine-tuned (ASR + audio sahifa)
"=== EVAL (compare_mms_40h.py) ===" | Out-File $log -Append -Encoding utf8
Set-Location $tts
$env:WHISPER_DEVICE = "cpu"
& $py training\scripts\compare_mms_40h.py 2>&1 | Out-File $log -Append -Encoding utf8
"EVAL EXIT=$LASTEXITCODE : $(Get-Date -Format 'HH:mm:ss')" | Out-File $log -Append -Encoding utf8

# 4) Serverlarni qayta yoqish (ertalab UI ishlashi uchun; F5 = uzbek100/model_last)
"=== Serverlarni qayta yoqish ===" | Out-File $log -Append -Encoding utf8
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-Command', "Set-Location '$tts'; `$env:PYTHONUTF8='1'; `$env:PYTHONIOENCODING='utf-8'; `$env:COQUI_TOS_AGREED='1'; & '$tts\.venv\Scripts\python.exe' -m uvicorn server.main:app --host 127.0.0.1 --port 8000 > '$runs\backend_8000.log' 2> '$runs\backend_8000.err.log'"
Start-Process powershell -WindowStyle Hidden -ArgumentList '-NoProfile','-Command', "Set-Location '$tts'; `$env:KMP_DUPLICATE_LIB_OK='TRUE'; `$env:PYTHONUTF8='1'; `$env:PYTHONIOENCODING='utf-8'; `$env:F5_CKPT='$tts\.venv-f5\Lib\ckpts\uzbek100\model_last.pt'; & '$tts\.venv-f5\Scripts\python.exe' -m uvicorn f5_server:app --host 127.0.0.1 --port 8001 > '$runs\f5_8001.log' 2> '$runs\f5_8001.err.log'"

"=== HAMMASI TUGADI: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Append -Encoding utf8
