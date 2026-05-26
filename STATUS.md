# NextTTS — Training Status

_Avtomatik yangilandi: **2026-05-26 23:18:38**_

> Bu fayl `publish_status.py` tomonidan har 10 daqiqada GitHub'ga push qilinadi.
> Uy noutbukdan jarayonni shu yerda kuzatish mumkin.

## Hozirgi holat

| Bosqich | Holat |
|---|---|
| Ekstraktsiya | ✅ TUGADI |
| Training | 🟢 ISHLAMOQDA |
| Epoch progress | **88.9%** (step 10,550/11,864) |
| So'nggi step vaqti | 2026-05-26 23:18:32 |

## Loss

| Metric | Qiymat | Eslatma |
|---|---|---|
| `loss` (instant) | 0.0811 | so'nggi batch |
| `loss` (running avg) | **0.0763** | train avg |
| `loss_mel_ce` (instant) | 3.369 | mel cross-entropy |
| `loss_mel_ce` (running avg) | **3.163** | mel running avg |

## Progress bar

```
[███████████████████████████████████░░░░░] 88.9%
```

## Eng so'nggi checkpoint'lar

| Yo'l | Hajm | O'zgarish |
|---|---|---|
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 19:55:50 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+09PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 17:27:44 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_04+06PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 16:40:11 |

## Training log (so'nggi 25 qator)

```
     | > current_lr: 2e-06  (1.9999999999996962e-06)
     | > loss_text_ce: 0.04438966512680054  (0.04080676484870853)
     | > loss_mel_ce: 3.1605873107910156  (3.16280415249784)
     | > loss: 0.07630898058414459  (0.07627645183924991)
     | > step_time: 0.194  (0.3103627445595123)
     | > loader_time: 0.004  (0.005431660373815516)


[1m   --> TIME: 2026-05-26 23:18:19 -- STEP: 10500/11864 -- GLOBAL_STEP: 10500[0m
     | > current_lr: 2e-06  (1.9999999999996946e-06)
     | > loss_text_ce: 0.042247675359249115  (0.04080040151164642)
     | > loss_mel_ce: 2.8151001930236816  (3.1625411684513147)
     | > loss: 0.06803209334611893  (0.07627003880607938)
     | > step_time: 0.205  (0.309728635856084)
     | > loader_time: 0.004  (0.0054228431383768795)


[1m   --> TIME: 2026-05-26 23:18:32 -- STEP: 10550/11864 -- GLOBAL_STEP: 10550[0m
     | > current_lr: 2e-06  (1.999999999999693e-06)
     | > loss_text_ce: 0.03671030327677727  (0.040799921465357845)
     | > loss_mel_ce: 3.368704080581665  (3.1625728612488535)
     | > loss: 0.08108129352331161  (0.07627078196748877)
     | > step_time: 0.201  (0.30907105911399585)
     | > loader_time: 0.004  (0.0054145824061750895)

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
