# TUNGI DETACHED runner: uzbek100 to'liq zanjir.
# arrow build (qolgan) -> GPU serverlarni to'xtatish -> training -> avto-solishtiruv.
# Sessiondan MUSTAQIL ishlaydi (Claude/terminal yopilsa ham davom etadi).
# Log: tts-server\training\data\uzbek100_overnight.log
$ErrorActionPreference = "Continue"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:WHISPER_DEVICE = "cpu"

$py = "C:\Projects\nexttts\tts-server\.venv-f5\Scripts\python.exe"
$scripts = "C:\Projects\nexttts\tts-server\training\scripts"
$log = "C:\Projects\nexttts\tts-server\training\data\uzbek100_overnight.log"

"BOSHLANDI: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Encoding utf8

"=== 1/4 ARROW BUILD (~30-40 daq) ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\build_uzbek100_arrow.py" 2>&1 | Out-File $log -Append -Encoding utf8
"ARROW TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8
if ($LASTEXITCODE -ne 0) {
    "XATO: arrow build muvaffaqiyatsiz - trening boshlanmaydi." | Out-File $log -Append -Encoding utf8
    exit 1
}

"=== 2/4 GPU SERVERLARNI TO'XTATISH (:8000, :8001) ===" | Out-File $log -Append -Encoding utf8
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

"=== 3/4 TRAINING (uzbek100, ~2 epoch ~20 soat) ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\train_uzbek100.py" 2>&1 | Out-File $log -Append -Encoding utf8
"TRAINING TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8

"=== 4/4 AVTO-SOLISHTIRUV ===" | Out-File $log -Append -Encoding utf8
& $py "$scripts\compare_uzbek100_ckpts.py" 2>&1 | Out-File $log -Append -Encoding utf8
"HAMMASI TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" | Out-File $log -Append -Encoding utf8
