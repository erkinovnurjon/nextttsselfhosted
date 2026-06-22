# Overnight runner: ayol_raw (1571110404, RAW text / no-kh) F5 fine-tune -> auto-test.
# ASCII-only (PS 5.1 .ps1). Log: tts-server\training\data\ayol_raw_overnight.log
$ErrorActionPreference = "Continue"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:WHISPER_DEVICE = "cpu"
$env:CUBLAS_WORKSPACE_CONFIG = ":4096:8"

Set-Location "C:\Projects\nexttts\tts-server"
$py = "C:\Projects\nexttts\tts-server\.venv-f5\Scripts\python.exe"
$scripts = "C:\Projects\nexttts\tts-server\training\scripts"
$log = "C:\Projects\nexttts\tts-server\training\data\ayol_raw_overnight.log"

"START: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Encoding utf8

"=== TRAINING (ayol_raw) ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\train_ayol_raw.py" 2>&1 | Out-File $log -Append -Encoding utf8
"TRAINING DONE (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8

"=== AUTO-TEST ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\test_ayol_raw.py" 2>&1 | Out-File $log -Append -Encoding utf8
"ALL DONE (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8
