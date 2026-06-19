# Piper o'zbek - KENGAYTIRILGAN DATA (~43h) tungi qayta-trening, self-resuming supervisor.
# Data: metadata_piper.csv endi 10201 qator (~43h) - eski ~20h + (16-22s) uzun kliplar
#       OXIRIGA qo'shilgan (cache row_number bog'liq -> eski 17GB cache qayta ishlatiladi).
# Warm-start: piper_resume.ckpt (oldingi 10h modeli, ~166802 step) ustidan davom.
# AUTO-STOP: --trainer.max_time = deadlinegacha qolgan vaqt (DD:HH:MM:SS) -> 10h da Lightning
#            O'ZI toza to'xtaydi (oldingi cheksiz-overrun muammosi hal). Crash bo'lsa resume.
# Batch 8 (oldin 12) - 22s kliplar VRAMga sig'sin (12GB). ASCII-only (PS 5.1 BOM saboq).
$ErrorActionPreference = "Continue"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"

$tts    = "C:\Projects\nexttts\tts-server"
$piper  = "$tts\training\piper1-gpl"
$py     = "$tts\venv-piper\Scripts\python.exe"
$data   = "$tts\training\data"
$log    = "$data\piper_uz_train.log"
$runDir = "$data\piper_uz\run"
$llogs  = "$runDir\lightning_logs"
$resume = "$data\piper_uz\piper_resume.ckpt"

function Log($m) { "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') | $m" | Out-File $log -Append -Encoding utf8 }
function Newest-Ckpt {
  Get-ChildItem -Path $runDir -Recurse -Filter *.ckpt -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$deadline = (Get-Date).AddHours(10)
Log "================================================================"
Log "PIPER EXPAND (~43h) SUPERVISOR START. Deadline = $($deadline.ToString('yyyy-MM-dd HH:mm:ss'))"

Set-Location $piper
$iter = 0
$noProgress = 0   # ketma-ket checkpoint-siz chiqishlar (crash-loop detektori)
while ((Get-Date) -lt $deadline) {
  $iter++

  $ck = Newest-Ckpt
  if ($ck -and (Test-Path $resume)) {
    if ($ck.LastWriteTime -gt (Get-Item $resume).LastWriteTime) {
      Copy-Item $ck.FullName $resume -Force
      Log "iter ${iter}: resume yangilandi <- $($ck.Name)"
    }
  }
  if (Test-Path $llogs) {
    Get-ChildItem -Path $llogs -Directory -ErrorAction SilentlyContinue |
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  }

  $remain = $deadline - (Get-Date)
  if ($remain.TotalMinutes -lt 5) { Log "iter ${iter}: deadlinega <5 daq - to'xtatamiz"; break }
  $mt = "{0:00}:{1:00}:{2:00}:{3:00}" -f $remain.Days, $remain.Hours, $remain.Minutes, $remain.Seconds
  Log "iter ${iter}: TRAINING boshlandi (batch 4, max_time=$mt, resume=piper_resume.ckpt)"

  & $py -m piper.train fit `
    --data.voice_name uz_feruza `
    --data.csv_path "$data\feruza\metadata_piper.csv" `
    --data.audio_dir "$data\feruza" `
    --data.espeak_voice uz `
    --data.cache_dir "$data\piper_uz\cache" `
    --data.config_path "$data\piper_uz\uz_feruza.json" `
    --data.batch_size 4 --data.num_workers 2 `
    --model.sample_rate 22050 `
    --trainer.max_steps 1435540 `
    --trainer.max_time "$mt" `
    --trainer.accelerator gpu --trainer.devices 1 --trainer.precision 16-mixed `
    --trainer.default_root_dir "$runDir" `
    --ckpt_path "$resume" 2>&1 | Out-File $log -Append -Encoding utf8

  $ec = $LASTEXITCODE
  Log "iter ${iter}: TRAINING chiqdi (exit=$ec)"

  $ck2 = Newest-Ckpt
  if ($ck2) {
    Copy-Item $ck2.FullName $resume -Force
    Log "iter ${iter}: progress saqlandi -> piper_resume.ckpt ($($ck2.Name))"
    $noProgress = 0
  } else {
    $noProgress++
    Log "iter ${iter}: yangi ckpt yo'q ($noProgress-marta ketma-ket) - eski resume'dan davom"
  }

  if ($ec -eq 0) { Log "iter ${iter}: clean exit (0) - max_time/limit. To'xtatamiz."; break }
  if ($noProgress -ge 3) { Log "iter ${iter}: CRASH-LOOP (3x progress yo'q) - ABORT. OOM/xato - batch yana kichraytirilsin."; break }
  if ((Get-Date) -ge $deadline) { break }
  Log "iter ${iter}: 8s kutib qayta-resume..."
  Start-Sleep -Seconds 8
}

Log "EXPAND SUPERVISOR TUGADI ($iter iteratsiya). ONNX export + A/B eval..."

# Yangi modelni alohida nom bilan export (deploy.onnx tegilmaydi - user tanlaguncha eski qoladi)
$newOnnx = "$data\piper_uz\uz_feruza_50h.onnx"
& $py -m piper.train.export_onnx --checkpoint "$resume" --output-file "$newOnnx" 2>&1 | Out-File $log -Append -Encoding utf8
if (Test-Path $newOnnx) {
  Copy-Item "$data\piper_uz\uz_feruza.onnx.json" "$newOnnx.json" -Force -ErrorAction SilentlyContinue
  Log "ONNX TAYYOR: uz_feruza_50h.onnx"
  # A/B: eski (deploy=20h) vs yangi (50h) -> :3000/piper_50h.html
  & $py "$tts\scripts\_piper_compare_50h.py" 2>&1 | Out-File $log -Append -Encoding utf8
  Log "A/B sahifa: http://localhost:3000/piper_50h.html"
} else {
  Log "ONNX export muvaffaqiyatsiz - resume ckpt qoldi (qo'lda export mumkin)."
}
Log "HAMMASI TUGADI: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "================================================================"
