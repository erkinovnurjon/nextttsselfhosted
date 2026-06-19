# TUNGI DETACHED runner: ayol (1571110404) dedicated training -> avto-test.
# Sessiondan MUSTAQIL ishlaydi (Claude/terminal yopilsa ham davom etadi).
# Log: tts-server\training\data\ayol_overnight.log
$ErrorActionPreference = "Continue"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:WHISPER_DEVICE = "cpu"

# Task Scheduler cwd = System32 -> F5 'runs/' (tensorboard) ni nisbiy yozolmaydi (WinError 5).
# tts-server ga o'tamiz: runs/ shu yerda yoziladi.
Set-Location "C:\Projects\nexttts\tts-server"

$py = "C:\Projects\nexttts\tts-server\.venv-f5\Scripts\python.exe"
$scripts = "C:\Projects\nexttts\tts-server\training\scripts"
$log = "C:\Projects\nexttts\tts-server\training\data\ayol_overnight.log"

"BOSHLANDI: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Encoding utf8

"=== TRAINING ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\train_ayol.py" 2>&1 | Out-File $log -Append -Encoding utf8
"TRAINING TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8

"=== AVTO-TEST ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\test_ayol_final.py" 2>&1 | Out-File $log -Append -Encoding utf8
"HAMMASI TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8
