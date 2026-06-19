# RESUME runner: ayol2 trening davomi (ckpts/ayol2/model_last'dan avto-resume).
# run_ayol2_overnight.ps1'dan farqi: 1/4 init + dataset QAYTA QURILMAYDI —
# arrow/duration o'zgarsa resume sampler holati buziladi. Log'ga APPEND.
# Task Scheduler orqali ishga tushiriladi (sessiondan to'liq mustaqil).
$ErrorActionPreference = "Continue"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:WHISPER_DEVICE = "cpu"

# Task Scheduler cwd=System32 -> trainer nisbiy 'runs/' ga yoza olmaydi (WinError 5).
Set-Location "C:\Projects\nexttts\tts-server"

$py = "C:\Projects\nexttts\tts-server\.venv-f5\Scripts\python.exe"
$scripts = "C:\Projects\nexttts\tts-server\training\scripts"
$log = "C:\Projects\nexttts\tts-server\training\data\ayol2_overnight.log"

"RESUME: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') (model_last'dan davom)" | Out-File $log -Append -Encoding utf8

"=== GPU SERVERLARNI TO'XTATISH (:8000, :8001) ===" | Out-File $log -Append -Encoding utf8
$ports = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -in 8000, 8001 }
$pids = $ports | Select-Object -ExpandProperty OwningProcess -Unique
foreach ($p in $pids) {
    $proc = Get-Process -Id $p -ErrorAction SilentlyContinue
    if ($proc -and $proc.ProcessName -like "python*") {
        "  to'xtatildi: PID $p ($($proc.ProcessName))" | Out-File $log -Append -Encoding utf8
        Stop-Process -Id $p -Force -Confirm:$false -ErrorAction SilentlyContinue
    }
}
Start-Sleep -Seconds 10

"=== TRAINING DAVOMI (ayol2, ~12k update nishon) ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\train_ayol2.py" 2>&1 | Out-File $log -Append -Encoding utf8
"TRAINING TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8

"=== AVTO-SOLISHTIRUV ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\compare_ayol2_ckpts.py" 2>&1 | Out-File $log -Append -Encoding utf8
"HAMMASI TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8
