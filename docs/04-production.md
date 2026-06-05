# Production'ga chiqarish rejasi

NextTTS = Next.js frontend + FastAPI (MMS TTS + Whisper ASR, model'lar) + DB (auth/limit/tarix).

## 1. Hozirgi kamchiliklar (dev → prod)

| Soha | Hozir (dev) | Production kerak |
|---|---|---|
| **DB** | SQLite | PostgreSQL (managed: Neon/Supabase) |
| **CORS** | faqat localhost | prod domen origini |
| **Backend** | qo'lда uvicorn | xizmat (auto-restart), MMS-only rejim |
| **HTTPS/domen** | yo'q | domen + SSL |
| **Sirlar** | .env (local) | prod env: NEXTAUTH_SECRET, DATABASE_URL, TTS_BACKEND_URL |
| **Backend xavfsizligi** | ochiq port | faqat frontend/tunnel kira oladi |
| **Docker** | yo'q | Dockerfile + compose |
| **Model warmup** | birinchi so'rov sekin | startup'да yuklash |

## 2. Tavsiya etilgan arxitektura

**Eng yaxshi qiymat (sizда RTX 3060 bor):**

```
[Foydalanuvchi] → Vercel (Next.js frontend, HTTPS, domen)
                      ↓ /api/tts, /api/transcribe
                  [Cloudflare Tunnel] (bepul, xavfsiz)
                      ↓
              [Sizning PC: RTX 3060] FastAPI (MMS+Whisper, GPU, tez)
                  
  DB → Neon/Supabase (managed PostgreSQL, bepul tier)
```

- **Frontend:** Vercel — bepul/arzon, avto HTTPS+domen, Next.js uchun ideal.
- **Backend:** sizning PC'да (bepul GPU, tez ~0.5s) → **Cloudflare Tunnel** bilan internetga (port ochmasdan, HTTPS).
- **DB:** Neon yoki Supabase — bepul Postgres.

**Muqobil (PC'ga bog'liq bo'lmasin):** bitta CPU VPS (Hetzner ~$10-20/oy) — hammasi Docker'да, MMS+Whisper CPU'да (sekinroq ~2-4s, lekin doim onlayn).

## 3. Bosqichlar (men qilaman)
1. **DB → Postgres:** schema provider o'zgartirish, migratsiya, Neon/Supabase ulanish.
2. **CORS + env:** prod origin, sirlarni sozlash.
3. **Backend service:** Dockerfile (MMS-only, warmup), restart policy, port himoyasi.
4. **Frontend:** Vercel deploy konfiguratsiyasi (yoki Docker).
5. **Cloudflare Tunnel:** PC backend'ni xavfsiz ulash (yoki VPS).
6. **HTTPS + domen.**
7. **Xavfsizlik:** rate-limit (bor), backend faqat tunnel/localhost'дан, sirlar.
8. **Monitoring + DB backup.**

## 4. Sizdan kerak
- Domen (yoki Vercel subdomain bepul).
- Vercel + Neon/Supabase + Cloudflare akkauntlari (bepul).
- Yoki VPS (CPU yo'l uchun).
