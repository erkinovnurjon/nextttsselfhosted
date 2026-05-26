# NextTTS — Training Status

_Avtomatik yangilandi: **2026-05-26 23:08:35**_

> Bu fayl `publish_status.py` tomonidan har 10 daqiqada GitHub'ga push qilinadi.
> Uy noutbukdan jarayonni shu yerda kuzatish mumkin.

## Hozirgi holat

| Bosqich | Holat |
|---|---|
| Ekstraktsiya | ✅ TUGADI |
| Training | 🟢 ISHLAMOQDA |
| Epoch progress | **70.0%** (step 8,300/11,864) |
| So'nggi step vaqti | 2026-05-26 23:08:26 |

## Loss

| Metric | Qiymat | Eslatma |
|---|---|---|
| `loss` (instant) | 0.0797 | so'nggi batch |
| `loss` (running avg) | **0.0764** | train avg |
| `loss_mel_ce` (instant) | 3.308 | mel cross-entropy |
| `loss_mel_ce` (running avg) | **3.169** | mel running avg |

## Progress bar

```
[████████████████████████████░░░░░░░░░░░░] 70.0%
```

## Eng so'nggi checkpoint'lar

| Yo'l | Hajm | O'zgarish |
|---|---|---|
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 19:55:50 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+09PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 17:27:44 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_04+06PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 16:40:11 |

## Training log (so'nggi 25 qator)

```
     | > current_lr: 2e-06  (2.000000000000018e-06)
     | > loss_text_ce: 0.041504405438899994  (0.040900741195442486)
     | > loss_mel_ce: 2.942060947418213  (3.169186578073152)
     | > loss: 0.07103727012872696  (0.07643065188011924)
     | > step_time: 0.194  (0.3470008680878614)
     | > loader_time: 0.003  (0.005900084972381603)


[1m   --> TIME: 2026-05-26 23:08:13 -- STEP: 8250/11864 -- GLOBAL_STEP: 8250[0m
     | > current_lr: 2e-06  (2.000000000000009e-06)
     | > loss_text_ce: 0.04749269783496857  (0.040901299211111956)
     | > loss_mel_ce: 2.171272039413452  (3.1692913402644063)
     | > loss: 0.052827734500169754  (0.07643315950600484)
     | > step_time: 0.132  (0.3460024412328545)
     | > loader_time: 0.004  (0.005886263789552642)


[1m   --> TIME: 2026-05-26 23:08:26 -- STEP: 8300/11864 -- GLOBAL_STEP: 8300[0m
     | > current_lr: 2e-06  (2e-06)
     | > loss_text_ce: 0.037329718470573425  (0.040895501298897255)
     | > loss_mel_ce: 3.3082849979400635  (3.1689920400855045)
     | > loss: 0.07965749502182007  (0.07642589526475371)
     | > step_time: 0.154  (0.3449545948763927)
     | > loader_time: 0.004  (0.005874168671757352)

```

## Pipeline log

```
NextTTS overnight pipeline: extract → train
======================================================================
Boshlandi: 2026-05-26 21:52:00
⏳ Ekstraktsiya tugashini kutmoqda (C:\Projects\nexttts\tts-server\training\data\extend_log.txt)...
✅ Ekstraktsiya tugadi

📍 Resume nuqtasi: C:\Projects\nexttts\tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth
   Razmer: 5.61 GB
   Modify time: 2026-05-26 19:55:50

🚀 Training komandasi:
   C:\Projects\nexttts\tts-server\.venv\Scripts\python.exe C:\Projects\nexttts\tts-server\training\scripts\finetune_xtts.py --resume-from C:\Projects\nexttts\tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth --epochs 1 --lr 2e-06 --batch 2 --grad-accum 42
   Log: C:\Projects\nexttts\tts-server\training\data\train_log.txt

   Training PID: 8728
```

## Ekstraktsiya log (oxiri)

```
   14500 ta saqlandi, 18.79h, 81.0 sample/s, ~11 min qoldi
   15000 ta saqlandi, 19.39h, 81.1 sample/s, ~5 min qoldi
   15500 ta saqlandi, 19.99h, 81.1 sample/s, ~0 min qoldi
   ✅ Maqsadga yetildi: 20.00 soat

📊 Konvert natijasi:
   Yangi sample: 15510
   Xatolar:      1457
   Yangi soat:   20.00

💾 metadata.csv ga qo'shish...
   Backup: metadata.csv.bak
   Eski: 8476 | Yangi: 15510 | Jami: 23986

✅ Tugadi. Endi training: python training/scripts/finetune_xtts.py --resume-from <last_best_model.pth> --epochs 3 --lr 2e-6
```
