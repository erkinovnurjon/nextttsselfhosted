# NextTTS — Training Status

_Avtomatik yangilandi: **2026-05-26 23:08:15**_

> Bu fayl `publish_status.py` tomonidan har 10 daqiqada GitHub'ga push qilinadi.
> Uy noutbukdan jarayonni shu yerda kuzatish mumkin.

## Hozirgi holat

| Bosqich | Holat |
|---|---|
| Ekstraktsiya | ✅ TUGADI |
| Training | 🟢 ISHLAMOQDA |
| Epoch progress | **69.5%** (step 8,250/11,864) |
| So'nggi step vaqti | 2026-05-26 23:08:13 |

## Loss

| Metric | Qiymat | Eslatma |
|---|---|---|
| `loss` (instant) | 0.0528 | so'nggi batch |
| `loss` (running avg) | **0.0764** | train avg |
| `loss_mel_ce` (instant) | 2.171 | mel cross-entropy |
| `loss_mel_ce` (running avg) | **3.169** | mel running avg |

## Progress bar

```
[███████████████████████████░░░░░░░░░░░░░] 69.5%
```

## Eng so'nggi checkpoint'lar

| Yo'l | Hajm | O'zgarish |
|---|---|---|
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 19:55:50 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+09PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 17:27:44 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_04+06PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 16:40:11 |

## Training log (so'nggi 25 qator)

```
     | > current_lr: 2e-06  (2.000000000000027e-06)
     | > loss_text_ce: 0.04195080325007439  (0.04090208149075144)
     | > loss_mel_ce: 3.3338818550109863  (3.169555074963832)
     | > loss: 0.08037696778774261  (0.07643945752865877)
     | > step_time: 0.202  (0.34809891373101903)
     | > loader_time: 0.005  (0.005914684629147781)


[1m   --> TIME: 2026-05-26 23:08:00 -- STEP: 8200/11864 -- GLOBAL_STEP: 8200[0m
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
