# Piper o'zbek (FeruzaSpeech) NATIV trening - 10 SOATLIK O'ZINI-O'ZI TIKLAYDIGAN SUPERVISOR.
# Sabab: python jarayoni epoch o'rtasida sababsiz (traceback yo'q = nativ/tashqi kill) chiqib
# ketadi, lekin powershell wrapper tirik qoladi. Shuning uchun INNER LOOP: python o'lsa,
# eng yangi checkpoint'dan AVTO qayta-resume - 10 soat o'tguncha. Har epochda Lightning
# checkpoint saqlaydi (~4 daq), shuning uchun har crashda ko'pi bilan 1 epoch yo'qoladi.
# Detached: Task Scheduler orqali ishga tushiriladi (sessiya yopilsa ham yashaydi).
# espeak uz fonemalar (x, g', q nativ IPA) -> x-iks muammosi fonema darajasida hal.
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

# Eng yangi *.ckpt (run dir ichida) qaytaradi yoki $null
function Newest-Ckpt {
  Get-ChildItem -Path $runDir -Recurse -Filter *.ckpt -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1
}

$deadline = (Get-Date).AddHours(10)
Log "================================================================"
Log "PIPER 10H SELF-RESUMING SUPERVISOR START. Deadline = $($deadline.ToString('yyyy-MM-dd HH:mm:ss'))"

Set-Location $piper
$iter = 0
while ((Get-Date) -lt $deadline) {
  $iter++

  # 1) version dir'dagi ckpt resume'dan yangiroq bo'lsa -> resume'ni yangila
  $ck = Newest-Ckpt
  if ($ck -and (Test-Path $resume)) {
    if ($ck.LastWriteTime -gt (Get-Item $resume).LastWriteTime) {
      Copy-Item $ck.FullName $resume -Force
      Log "iter ${iter}: resume yangilandi <- $($ck.Name)"
    }
  } elseif ($ck -and -not (Test-Path $resume)) {
    Copy-Item $ck.FullName $resume -Force
    Log "iter ${iter}: resume yaratildi <- $($ck.Name)"
  }

  # 2) disk himoyasi: eski version_* papkalarni tozalash (resume saqlangan)
  if (Test-Path $llogs) {
    Get-ChildItem -Path $llogs -Directory -ErrorAction SilentlyContinue |
      Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  }

  $remainMin = [int]((($deadline) - (Get-Date)).TotalMinutes)
  Log "iter ${iter}: TRAINING boshlandi (resume=piper_resume.ckpt, qolgan ~$remainMin daq)"

  & $py -m piper.train fit `
    --data.voice_name uz_feruza `
    --data.csv_path "$data\feruza\metadata_piper.csv" `
    --data.audio_dir "$data\feruza" `
    --data.espeak_voice uz `
    --data.cache_dir "$data\piper_uz\cache" `
    --data.config_path "$data\piper_uz\uz_feruza.json" `
    --data.batch_size 12 --data.num_workers 2 `
    --model.sample_rate 22050 `
    --trainer.max_steps 1435540 `
    --trainer.accelerator gpu --trainer.devices 1 --trainer.precision 16-mixed `
    --trainer.default_root_dir "$runDir" `
    --ckpt_path "$resume" 2>&1 | Out-File $log -Append -Encoding utf8

  $ec = $LASTEXITCODE
  Log "iter ${iter}: TRAINING chiqdi (exit=$ec)"

  # 3) eng yangi ckptni resume'ga ko'chir (progress saqlash)
  $ck2 = Newest-Ckpt
  if ($ck2) {
    Copy-Item $ck2.FullName $resume -Force
    Log "iter ${iter}: progress saqlandi -> piper_resume.ckpt ($($ck2.Name))"
  } else {
    Log "iter ${iter}: yangi ckpt yo'q (jarayon erta o'ldi) - eski resume'dan davom"
  }

  if ($ec -eq 0) { Log "iter ${iter}: clean exit (0) - limit/max_steps. To'xtatamiz."; break }
  if ((Get-Date) -ge $deadline) { break }
  Log "iter ${iter}: 8s kutib qayta-resume..."
  Start-Sleep -Seconds 8
}

Log "10H SUPERVISOR TUGADI ($iter iteratsiya). ONNX export boshlanmoqda..."

# Yakuniy ONNX export (non-destruktiv, alohida fayl). Deploy: PIPER_ONNX bilan ulang.
$finalOnnx = "$data\piper_uz\uz_feruza_10h.onnx"
& $py -m piper.train.export_onnx --checkpoint "$resume" --output-file "$finalOnnx" 2>&1 | Out-File $log -Append -Encoding utf8
if (Test-Path $finalOnnx) {
  Copy-Item "$data\piper_uz\uz_feruza.onnx.json" "$finalOnnx.json" -Force -ErrorAction SilentlyContinue
  Log "ONNX TAYYOR: uz_feruza_10h.onnx (deploy uchun: piper_server PIPER_ONNX=...uz_feruza_10h.onnx)"
} else {
  Log "ONNX export muvaffaqiyatsiz - resume ckpt qoldi, qo'lda export qilish mumkin."
}
Log "HAMMASI TUGADI: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Log "================================================================"
