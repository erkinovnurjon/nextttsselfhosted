# NextTTS — Training Status

_Avtomatik yangilandi: **2026-05-27 13:02:34**_

> Bu fayl `publish_status.py` tomonidan har 10 daqiqada GitHub'ga push qilinadi.
> Uy noutbukdan jarayonni shu yerda kuzatish mumkin.

## Hozirgi holat

| Bosqich | Holat |
|---|---|
| Ekstraktsiya | ✅ TUGADI |
| Training | 🟢 ISHLAMOQDA |

## Loss

| Metric | Qiymat | Eslatma |
|---|---|---|
| `loss` (instant) | 2.6276 | so'nggi batch |
| `loss` (running avg) | **3.1138** | train avg |
| `loss_mel_ce` (instant) | 2.593 | mel cross-entropy |
| `loss_mel_ce` (running avg) | **3.074** | mel running avg |
| `eval avg_loss_mel_ce` | **3.074** | eval split (v3 = 3.16) |

## Eng so'nggi checkpoint'lar

| Yo'l | Hajm | O'zgarish |
|---|---|---|
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-27-2026_01+11AM-a9932c4\best_model.pth` | 5.61 GB | 2026-05-27 02:04:00 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-27-2026_12+18AM-8b2a8ee\best_model.pth` | 5.61 GB | 2026-05-27 01:10:57 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_11+25PM-05727d1\best_model.pth` | 5.61 GB | 2026-05-27 00:17:54 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_09+53PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 23:24:29 |
| `tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth` | 5.61 GB | 2026-05-26 19:55:50 |

## Training log (so'nggi 25 qator)

```
     | > loss_text_ce: 0.03913455829024315  (0.03973643884062767)
     | > loss_mel_ce: 3.045997142791748  (3.106369609832764)
     | > loss: 3.0851316452026367  (3.146106033325195)

[1m   --> STEP: 26[0m
     | > loss_text_ce: 0.03715191036462784  (0.039637033899243064)
     | > loss_mel_ce: 2.754751205444336  (3.0928458250485935)
     | > loss: 2.791903018951416  (3.1324828404646654)

[1m   --> STEP: 27[0m
     | > loss_text_ce: 0.03451031446456909  (0.03944715540166254)
     | > loss_mel_ce: 2.593118190765381  (3.074337394149215)
     | > loss: 2.6276285648345947  (3.1137845339598478)


  [1m--> EVAL PERFORMANCE[0m
     | > avg_loader_time: 0.006221824222140842 [0m(+0.0)
     | > avg_loss_text_ce: 0.03944715540166254 [0m(+0.0)
     | > avg_loss_mel_ce: 3.074337394149215 [0m(+0.0)
     | > avg_loss: 3.1137845339598478 [0m(+0.0)

 > BEST MODEL : C:\Projects\nexttts\tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_09+53PM-0000000\best_model_11865.pth

✅ Trening tugadi
   Checkpointlar: C:\Projects\nexttts\tts-server\training\checkpoints\xtts_v2_uzbek
```

## Pipeline log

```
✅ Ekstraktsiya tugadi

📍 Resume nuqtasi: C:\Projects\nexttts\tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth
   Razmer: 5.61 GB
   Modify time: 2026-05-26 19:55:50

🚀 Training komandasi:
   C:\Projects\nexttts\tts-server\.venv\Scripts\python.exe C:\Projects\nexttts\tts-server\training\scripts\finetune_xtts.py --resume-from C:\Projects\nexttts\tts-server\training\checkpoints\xtts_v2_uzbek\xtts_v2_uzbek-May-26-2026_05+36PM-0000000\best_model.pth --epochs 1 --lr 2e-06 --batch 2 --grad-accum 42
   Log: C:\Projects\nexttts\tts-server\training\data\train_log.txt

   Training PID: 8728

   Training tugadi, exit_code=0

✅ Pipeline muvaffaqiyatli tugadi
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
