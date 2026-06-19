# Piper o'zbek (FeruzaSpeech) NATIV trening — DETACHED runner (Task Scheduler).
# espeak uz fonemalar (x→χ, gʻ→ʁ, q→q) → x-iks muammosi fonema darajasida hal.
# Warm-start: en_US lessac medium (boshqa til OK — IPA fonema vocab bir xil).
$ErrorActionPreference = "Continue"
$env:PYTHONUTF8 = "1"
$env:PYTHONIOENCODING = "utf-8"
$env:KMP_DUPLICATE_LIB_OK = "TRUE"

$tts   = "C:\Projects\nexttts\tts-server"
$piper = "$tts\training\piper1-gpl"
$py    = "$tts\venv-piper\Scripts\python.exe"
$data  = "$tts\training\data"
$log   = "$data\piper_uz_train.log"

"=== PIPER UZ TRAIN START: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Append -Encoding utf8

# ESLATMA: app serverlari (backend :8000 CPU-only + piper :8002 CPU) GPU ishlatmaydi —
# trening GPU'da, ular CPU'da birga ishlaydi. Shuning uchun ularni TO'XTATMAYMIZ
# (pauza/trening paytida ham "Ayol (nativ)" ovozi jonli qoladi). F5 (:8001) baribir o'chiq.

Set-Location $piper
"=== TRAINING (warm-start lessac, batch 12, 22050, max_steps 1435540) ===" | Out-File $log -Append -Encoding utf8
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
  --trainer.default_root_dir "$data\piper_uz\run" `
  --ckpt_path "$data\piper_uz\piper_resume.ckpt" 2>&1 | Out-File $log -Append -Encoding utf8

"=== TRAINING TUGADI (exit=$LASTEXITCODE): $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ===" | Out-File $log -Append -Encoding utf8
