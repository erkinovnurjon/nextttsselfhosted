# NextTTS

O'zbek tilida ishlaydigan, self-hosted, foydalanuvchi ovozi bilan gapiradigan TTS platformasi.

**Tech stack:** Next.js 16 (frontend) + Python 3.11 / FastAPI / XTTS v2 (ML backend) + RTX 3060 GPU

---

## Tezda ishga tushirish

```powershell
# Birinchi marta — bog'liqliklarni o'rnatish (avval bajariladi)
npm install
cd tts-server
uv venv --python 3.11
uv pip install -e .
uv pip install torch torchaudio --index-url https://download.pytorch.org/whl/cu121
uv pip install transformers==4.55.0
cd ..

# Har kuni ishga tushirish
.\scripts\start-all.ps1
```

Yoki alohida-alohida (ikkita terminal):

```powershell
# Terminal 1 — Python TTS server
.\scripts\start-tts-server.ps1

# Terminal 2 — Next.js frontend
.\scripts\start-frontend.ps1
```

- Frontend: <http://localhost:3000>
- TTS API: <http://127.0.0.1:8000>

---

## Loyiha tuzilishi

```
nexttts/
├── src/                         # Next.js frontend (TypeScript)
│   ├── app/
│   │   ├── page.tsx             # Dashboard (dataset boshqaruv)
│   │   ├── record/page.tsx      # Batch yozish rejimi (klaviatura shortcutlari)
│   │   └── api/
│   │       ├── sentences/       # Dataset CRUD
│   │       ├── recordings/      # Audio upload/stream
│   │       ├── stats/           # Statistika
│   │       ├── export/          # metadata.csv eksport
│   │       └── tts/             # FastAPI proxy
│   ├── components/              # UI komponentlar
│   ├── hooks/use-recorder.ts    # MediaRecorder hook
│   └── lib/
│       ├── dataset.ts           # fs operatsiyalari
│       └── wav-encoder.ts       # webm → 22050 Hz mono WAV
│
├── tts-server/                  # Python ML server
│   ├── pyproject.toml
│   ├── .venv/                   # Python 3.11 venv (uv)
│   ├── server/main.py           # FastAPI inference server
│   ├── scripts/
│   │   ├── prepare_reference.py # Reference audio yaratish
│   │   └── clone_voice.py       # CLI voice cloning
│   ├── voices/main/             # Reference audio fayllar
│   └── output/                  # Sintezlangan WAV fayllar
│
├── dataset/                     # Audio dataset
│   ├── sentences.json           # 300 ta jumla (manba)
│   ├── sentences.txt            # Boshlang'ich seed
│   ├── wavs/                    # Yozilgan WAV fayllar (001.wav, ...)
│   └── metadata.csv             # Eksport (LJSpeech format)
│
├── docs/
│   └── 01-recording-guide.md    # Audio yozish qo'llanmasi
│
└── scripts/                     # PowerShell run scripts
```

---

## Workflow

### 1. Dataset to'plash (Frontend)

1. <http://localhost:3000> ga kiring
2. **"Batch yozish"** tugmasini bosing (yoki [/record](http://localhost:3000/record))
3. Klaviatura shortcutlari bilan tez yozing:
   - `Space` — yozish/to'xtatish
   - `Enter` — saqlash va keyingiga
   - `Esc` — qayta yozish
   - `←/→` — oldingi/keyingi

WAV fayllar `dataset/wavs/` papkasiga 22050 Hz mono 16-bit format'da saqlanadi.

### 2. Reference audio yangilash

Yangi yozuvlar qo'shilgandan keyin reference'ni qayta yarating:

```powershell
cd tts-server
.\.venv\Scripts\python.exe scripts\prepare_reference.py
```

Yoki API orqali:
```bash
curl -X POST http://127.0.0.1:8000/reference/build -H "Content-Type: application/json" -d '{"voice":"main","top":5}'
```

### 3. Voice clone sinash (CLI)

```powershell
cd tts-server

# Bitta matn
.\.venv\Scripts\python.exe scripts\clone_voice.py "Salom dunyo"

# Interaktiv rejim
.\.venv\Scripts\python.exe scripts\clone_voice.py --interactive

# Demo benchmark (5 ta matn)
.\.venv\Scripts\python.exe scripts\clone_voice.py --benchmark
```

Natijalar `tts-server/output/` papkasiga saqlanadi.

### 4. Voice clone sinash (UI orqali)

1. <http://localhost:3000> dashboard'da TTS Preview qismi
2. "**Sizning ovoz**" rejimini tanlang
3. Matn kiriting → "Mening ovozim bilan ayt" tugmasini bosing
4. Audio chiqadi va eshitiladi

---

## Live training status

📊 **[STATUS.md](./STATUS.md)** — har 10 daqiqada avtomatik yangilanadi.

Uy noutbukidan training jarayonini kuzatish:
```bash
# GitHub'da: github.com/erkinovnurjon/nextttsselfhosted/blob/main/STATUS.md
# Yoki repo'ni clone qilib local'da watch qilish:
git clone https://github.com/erkinovnurjon/nextttsselfhosted.git
cd nextttsselfhosted
# Har 1 daqiqada o'qish (Mac/Linux):
watch -n 60 'git pull && cat STATUS.md'
```

Asosiy PC'da auto-publisher ishga tushirish:
```powershell
cd C:\Projects\nexttts
.\tts-server\.venv\Scripts\python.exe tts-server\training\scripts\publish_status.py --loop --interval 600
```

---

## Voice Lab — versiyalarni A/B sinash

`/voice-lab` sahifasi har xil fine-tuned checkpoint'larni bir xil matn bilan
solishtirib eshitish imkonini beradi.

- Sidebar'dan checkpoint tanlash
- Test preset matnlar (x/gʻ/q/oʻ fokuslangan)
- Parametr sliderlar (temperature, top-k, top-p, repetition penalty, speed)
- Sintez tarixi (har bir natija download qilish mumkin)

---

## Roadmap

- [x] **1-bosqich:** Dataset to'plash UI (Next.js)
- [x] **2-bosqich:** Audio yozish + WAV konvertatsiya (browser)
- [x] **3-bosqich:** Coqui XTTS v2 setup + voice cloning
- [x] **4-bosqich:** FastAPI inference server
- [x] **5-bosqich:** Frontend ↔ Backend integratsiya
- [x] **6-bosqich:** XTTS v2 fine-tuning (O'zbek tilida) — v1-v4
- [x] **7-bosqich:** Multi-checkpoint Voice Lab + auto status publish
- [ ] **8-bosqich:** Auth + foydalanuvchi/kredit tizimi
- [ ] **9-bosqich:** Production deploy (Docker + GPU server)

---

## Til qo'llab-quvvatlash

XTTS v2 **o'zbek tilini rasmiy qo'llab-quvvatlamaydi**. Hozir vaqtinchalik `tr` (turk) tili ishlatiladi — fonetik jihatdan eng yaqin. O'zbek tilini to'g'ri talaffuz qilish uchun **6-bosqich (fine-tuning)** kerak.

Vaqtinchalik holatda:
- ✅ Ishlaydi: a, b, d, e, f, g, h, i, k, l, m, n, o, p, r, s, t, u, v, z, y, ch, sh
- ⚠️  Noto'g'ri talaffuz: q, x, oʻ, gʻ (Uzbek-specific)

---

## Texnik xususiyatlar

- **GPU:** NVIDIA RTX 3060 12GB VRAM (CUDA 12.1)
- **Model:** Coqui XTTS v2 (~2 GB checkpoint)
- **Sintez tezligi:** ~1.5-3x real-time (GPU bilan)
- **Audio format:** 22050 Hz mono 16-bit WAV
- **Reference audio:** 6-30 soniya (ideal: 15-20s, 3 ta yozuv birlashtirilgan)
