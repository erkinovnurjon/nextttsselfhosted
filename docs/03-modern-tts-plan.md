# Zamonaviy TTS rejasi — tabiiy, iliq o'zbek ovoz

_2026-05-31. Maqsad: FeruzaSpeech (toza professional ayol, 60h) datasida zamonaviy TTS modelni
bulut GPU'да o'rgatib, **tabiiy + iliq (shirali) + tiniq** o'zbek ayol ovozini olish._

## Nega MMS emas

ASR bilan obyektiv isbotlandi: MMS'ni RTX 3060'da fine-tune qilish (qaysi data bo'lishidan
qat'i nazar) ovozni **buzadi**. MMS 16 kHz + cheklangan arxitektura. Yangi yo'l kerak.

---

## 1. Model tanlash

| Model | Sifat/iliqlik | O'zbek | Murakkablik | Tavsiya |
|---|---|---|---|---|
| **F5-TTS** | Juda tabiiy (flow-matching) | char/phoneme — moslashuvchan | O'rta, yaxshi hujjat | ⭐ **Asosiy** |
| **StyleTTS2** | SOTA, eng ifodali | espeak-ng `uz` fonema | Yuqoriroq | Muqobil |
| **XTTS v2** | Ifodali, iliq | fonema (siz ishlatgansiz) | Past (tanish) | Muqobil |

**Tavsiya: F5-TTS** — 2024, juda tabiiy, yangi til fine-tune'i yaxshi hujjatlangan, 24 kHz
(MMS 16 kHz'dan tiniqroq), bitta-spiker datada zo'r ishlaydi. Hammasi 24 kHz → tiniqroq.

> espeak-ng o'zbek (`uz`) fonemani qo'llaydi — StyleTTS2 uchun fonetika to'g'ri bo'ladi.

## 2. Data
- **FeruzaSpeech** — allaqachon yuklangan (`training/data/feruza`, 6.5GB, 60h, text_latin+text_cyrillic).
- Tayyorlash: (audio 24kHz, matn) juftliklari. F5 uchun matn to'g'ridan-to'g'ri; StyleTTS2 uchun espeak-ng `uz` fonemizatsiya.
- Bitta professional ayol → bu modellar uchun ideal.
- **Erkak:** FeruzaSpeech faqat ayol. Erkak uchun: (a) sifatli erkak datasetini topish/yozish, yoki (b) F5 zero-shot voice-clone (qisqa erkak namunasidan).

## 3. Bulut GPU
- **RunPod** (eng oson, tayyor template'lar) yoki Vast.ai / Lambda Labs.
- GPU: **A100 40GB** (tez) yoki **RTX 4090 24GB** (arzonroq).
- Narx (taxminiy): A100 ~$1.5-2/soat, 4090 ~$0.4-0.7/soat. Fine-tune ~10-30 soat → **~$20-60**.
- Faqat TRAINING bulutда. INFERENCE — sizning RTX 3060'да bemalol (yengilroq).

## 4. Bosqichlar
1. **Bulut akkaunt** (RunPod) + GPU pod yaratish (PyTorch template).
2. **F5-TTS o'rnatish** (repo + bog'liqliklar).
3. **Data prep**: FeruzaSpeech → 24kHz resample + manifest (audio↔matn). (Skriptni men yozaman.)
4. **Fine-tune** (yoki yangi til adapter) — bir necha soat.
5. **Baholash**: ASR + quloq bilan (iliqlik/tiniqlik).
6. **Eksport**: checkpoint'ni yuklab olish (~GB).
7. **Integratsiya**: sizning FastAPI server'ga yangi engine (`f5_engine.py`) — RTX 3060'да inference.
   Mavjud `/synthesize` arxitekturasi (ovoz tanlash, /sinov) saqlanadi.

## 5. Natija
- **Tabiiy, iliq, tiniq ayol ovoz** (24 kHz, FeruzaSpeech tembri).
- Self-hosted inference (3060), bulut faqat 1 marta training uchun.
- Keyin: erkak ovoz (data topilsa) yoki zero-shot clone.

## 6. Mendan kerak
- Data prep + integratsiya skriptlarini men yozaman.
- Bulut akkaunt/to'lov + pod ishga tushirish — sizdan (men qadam-baqadam ko'rsatama beraman).
- GPU'да buyruqlarни men beraman, siz pod terminalida ishga tushirasiz (yoki SSH bersangiz men).
