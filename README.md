# NextTTS

O'zbek tilida ishlaydigan **self-hosted matn-nutq (TTS) platformasi** — OTM/LMS uchun pilot.
Foydalanuvchilar matnni nutqqa aylantiradi, o'z ovozini yozdirib klonlaydi, balansini
to'ldiradi. Web ilova + 3 ta TTS dvigatel + ASR + auth/to'lov/chatbotни o'z ichiga oladi.

**Tech stack:** Next.js 16 (React, TypeScript) · FastAPI (Python 3.11) · PostgreSQL (Prisma) ·
NextAuth v5 · Piper / Meta MMS / F5-TTS · Whisper ASR.

---

## Ovoz dvigatellari (3 ta)

| Ovoz (UI) | Dvigatel | Port | Talab | Izoh |
|-----------|----------|------|-------|------|
| **Asosiy** (default), Erkak | MMS (Meta) | `:8000` | CPU | Nativ o'zbek, tez, x/gʻ/q to'g'ri |
| **Ayol (nativ)** | Piper | `:8002` | CPU | Nativ o'zbek ayol, tabiiy |
| **Ayol (mayin)**, "Mening ovozim" | F5-TTS | `:8001` | **GPU** | Tabiiy tembr + zero-shot klon |

> F5 (GPU) ixtiyoriy — MMS/Piper ovozlari CPU'da ishlaydi. F5'siz "Ayol (mayin)" va
> "Mening ovozim" ishlamaydi, qolgani ishlaydi.

---

## Arxitektura

```
Browser ──> Next.js web (:3000)
                 │  src/app/api/*  (server route'lar)
                 ▼  TTS_BACKEND_URL
            main.py  FastAPI (:8000)  ── MMS TTS + Whisper ASR
                 │   + BARCHA matn normalizatsiyasi (raqam/sana/x-gʻ-q/matematika)
                 ├──> F5 server   (:8001)   proxy   (GPU)
                 └──> Piper server (:8002)  proxy   (CPU)

            PostgreSQL (Neon yoki Docker)  <── Prisma  (users, kredit, to'lov, tarix)
```

- Web `api/tts` route'i `TTS_BACKEND_URL` (main.py :8000) ga proxy qiladi; main.py o'zi
  F5/Piper mikroservislariga proxy qiladi va **barcha matn normalizatsiyasini** (linguistik
  raqam/sana + fonetik x/gʻ/q + ilmiy matematik belgilar) shu yerda bajaradi.
- Reference kliplar `tts-server/voices/` da (web ↔ F5 umumiy volume kerak — `DEPLOY.md`).

---

## Lokal setup

```powershell
# 1. Web bog'liqliklari
npm install

# 2. Ma'lumotlar bazasi (Neon yoki lokal Postgres) -> .env da DATABASE_URL
copy .env.example .env        # to'ldiring (DATABASE_URL, AUTH_SECRET, ...)
npx prisma migrate dev        # jadvallarni yaratadi
npx prisma generate           # ⚠️ avval `npm run dev` ni TO'XTATING (fayl lock)

# 3. Python muhitlari (3 ta alohida venv — torch versiyalari farq qiladi)
cd tts-server
python -m venv .venv      ; .venv\Scripts\pip install -e . ; .venv\Scripts\pip install transformers==4.55.0   # MMS + ASR
python -m venv .venv-f5   ; # torch (CUDA) + f5-tts + transformers==4.49.0   (GPU bo'lsa)
python -m venv venv-piper ; # onnxruntime + piper-tts + fastapi + uvicorn + soundfile
```

### 4. Modellarni yuklab olish (majburiy!)

Model og'irliklari **git'da YO'Q** (F5 3.2GB, Piper 61MB — GitHub 100MB limitidan katta).
Ular xususiy Hugging Face repo'sida turadi — clone'dan keyin bir buyruq bilan olinadi:

```powershell
# Bir marta: HF token (repo'ga o'qish huquqi bilan) — https://huggingface.co/settings/tokens
.venv-f5\Scripts\huggingface-cli.exe login

# Modellarni joyiga tushirish (tts-server papkasidan):
$env:PYTHONUTF8="1"
.venv-f5\Scripts\python.exe scripts\hf_models.py download --repo <username>/nexttts-models
```

Nimalar tushadi: Piper `.onnx` (DEFAULT ovoz — busiz sintez ishlamaydi), F5 checkpoint +
vocab + reference kliplar (tabiiy ovozlar va "Mening ovozim" uchun; `.venv-f5` bo'lmasa
o'tkazib yuboriladi — Piper baribir ishlaydi). MMS va Whisper ASR modellari esa birinchi
ishga tushishda HuggingFace'dan avtomatik yuklanadi.

> Model egasi uchun (bir marta): `scripts\hf_models.py upload --repo <username>/nexttts-models`
> — barcha kerakli fayllarni private HF repo'ga chiqaradi. Jamoa a'zolariga repo'dan
> o'qish huquqini bering. ⚠️ Repo'ni PUBLIC qilmang — trening ma'lumotlari notijoriy
> litsenziyali (CC-BY-NC), tarqatishdan oldin litsenziya masalasi hal bo'lishi kerak.

---

## Ishga tushirish

**Hammasini birga** (alohida oynalar):

```powershell
.\scripts\start-all.ps1          # web + MMS + Piper + F5
.\scripts\start-all.ps1 -NoF5    # GPU yo'q bo'lsa — F5'siz
```

**Yoki qo'lda** (har biri alohida terminalda, `PYTHONUTF8=1` shart):

```powershell
# Web
npm run dev                                                          # :3000

cd tts-server
.venv\Scripts\python -m uvicorn server.main:app --port 8000          # MMS + ASR + proxy
venv-piper\Scripts\python -m uvicorn piper_server:app --port 8002    # Piper (DEFAULT ovoz!)
.venv-f5\Scripts\python -m uvicorn f5_server:app --port 8001         # F5 (GPU; ixtiyoriy)
```

- Web: <http://localhost:3000>
- ⚠️ **Piper (:8002) ishlamasa default ovoz 503 qaytaradi** — uni doim yoqing.
- F5 birinchi startda ~150s warmup qiladi (cold-start oldini olish uchun).

---

## Build (production)

```powershell
npm run build      # ICHIDA `next build --webpack` bor — Turbopack OOM beradi, O'ZGARTIRMANG
npm start
```

---

## Muhit o'zgaruvchilari

`.env.example` — barcha o'zgaruvchilar izoh bilan (DATABASE_URL, AUTH_SECRET/AUTH_URL,
TTS_BACKEND_URL, F5/Piper URL, Payme/Click kalitlari, ANTHROPIC_API_KEY). `.env` ga nusxalab
to'ldiring. Haqiqiy `.env`/`.env.prod` git'ga qo'shilmaydi.

---

## Loyiha tuzilishi

```
nexttts/
├── src/                         # Next.js web ilova (TypeScript)
│   ├── app/
│   │   ├── cabinet/             # Foydalanuvchi kabineti (sintez, ovozlar, balans, ...)
│   │   ├── api/                 # Server route'lar (tts, chat, payments, auth, ...)
│   │   └── (landing/auth)       # Landing + kirish/ro'yxat
│   ├── components/              # UI komponentlar (cabinet/, ui/, chat-widget, ...)
│   └── lib/                     # auth, db, payments, chatbot, i18n, role, credits, ...
│
├── tts-server/                  # Python TTS/ASR backend
│   ├── server/
│   │   ├── main.py              # FastAPI :8000 — MMS + ASR + F5/Piper proxy + normalizatsiya
│   │   ├── mms_engine.py        # MMS TTS dvigatel
│   │   ├── whisper_engine.py    # Whisper ASR (mikrofon STT)
│   │   ├── linguistic_normalizer.py / text_normalizer.py / lexicon.py / sci_normalizer.py
│   ├── f5_server.py             # F5-TTS :8001 (GPU)
│   ├── piper_server.py          # Piper :8002 (DEFAULT ovoz)
│   └── scripts/prepare_reference.py   # "Mening ovozim" reference quruvchi (runtime)
│
├── prisma/                      # DB schema + migratsiyalar (PostgreSQL)
├── scripts/                     # start-*.ps1, set-role.mjs
├── docs/                        # Loyiha eslatmalari
├── DEPLOY.md                    # Production deploy (Docker compose)
└── .env.example                 # Muhit o'zgaruvchilari namunasi
```

---

## Asosiy imkoniyatlar

- **Matndan nutq** — 4 ovoz; matn normalizatsiyasi (raqam, sana, valyuta, qisqartma,
  matematik/fizik belgilar) avtomatik.
- **Mening ovozim** — foydalanuvchi ovozini yozdirib zero-shot klon (F5).
- **Nutqdan matn** — mikrofon ASR (Whisper, o'zbek).
- **Auth + kredit** — NextAuth v5, balans, VIP cheksiz rol.
- **To'lov** — Payme + Click (balans to'ldirish).
- **Chatbot** — suzuvchi loyiha-yordamchi (Claude API; kalitsiz FAQ rejimi).
- **3 til** — o'zbek / rus / ingliz; light/dark mavzu.

---

## Deploy

Production (Docker compose: caddy + web + api + piper + db) — **`DEPLOY.md`** ga qarang.
CPU-pilot: Piper default ovoz; F5/klon = GPU server keyin.
