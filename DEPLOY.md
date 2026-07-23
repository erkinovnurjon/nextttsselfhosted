# NextTTS — serverga joylashtirish (production)

Hammasi bitta serverda Docker bilan: **frontend + backend + Postgres + HTTPS**.

## Talablar (serverда)
- Linux + **Docker** va **Docker Compose** (`docker --version`, `docker compose version`)
- Domen → server IP'ga yo'naltirilgan (A-record). HTTPS Caddy avtomatik oladi.
- (Ixtiyoriy) NVIDIA GPU + `nvidia-container-toolkit` → tezroq sintez.

## Qadamlar

```bash
# 1. Loyihani serverga olish
git clone <repo> nexttts && cd nexttts

# 2. Env tayyorlash
cp .env.example .env.prod
nano .env.prod          # DOMAIN, DB, AUTH_SECRET (openssl rand -base64 32), APP_URL,
                        # (ixtiyoriy) PAYME_*/CLICK_* kalitlarini to'ldiring

# 3. (GPU bo'lsa) docker-compose.yml dagi `deploy.resources` qatorlarини oching

# 4. Ishga tushirish
docker compose --env-file .env.prod up -d --build

# 5. Holatni ko'rish
docker compose ps
docker compose logs -f api     # model'lar birinchi marta yuklanadi (~1-2 daq)
```

Tayyor → `https://<DOMAIN>` ochiladi.

## Birinchi ishga tushirish eslatmalari
- **Model yuklash:** `api` birinchi so'rovда MMS (~150MB) va Whisper (Kotib/uzbek_stt_v1) ni HF'дан yuklaydi → `hf_cache` volume'да saqlanadi (keyin tez).
- **DB:** `web` konteyneri ishga tushganda avtomatik `prisma migrate deploy` qiladi — migratsiya fayllarini xavfsiz qo'llaydi (mavjud ma'lumotni hech qachon o'chirmaydi). DB tayyor bo'lguncha kutadi (healthcheck + retry).
  - **Server ichidagi Postgres (`db` servisi):** `.env.prod` da `POSTGRES_PASSWORD` va `DATABASE_URL` ichidagi parolни **bir xil** qo'ying; host = `db` (masalan `postgresql://nexttts:PAROL@db:5432/nexttts`).
  - **Neon ishlatsangiz:** `.env.prod` da `DATABASE_URL` ni Neon string bilan to'ldiring; `db` servisi kerak emas.
  - **Backup:** ma'lumot `pg_data` volume'да. Zaxira: `docker compose exec db pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql`.
- **Admin:** birinchi ro'yxatdan o'tgan foydalanuvchi avtomatik `role=admin` bo'ladi.

## To'lov (Payme / Click) — productionда
- Webhook'lar **ochiq HTTPS domen** talab qiladi (Caddy avtomatik beradi) — `localhost` ishlamaydi.
- `.env.prod` da `APP_URL=https://<DOMAIN>` va merchant kalitlarini qo'ying.
- Provayder kabinetida webhook URL ko'rsating:
  - Payme: `https://<DOMAIN>/api/payments/payme` (account maydoni: `order_id`)
  - Click: `https://<DOMAIN>/api/payments/click/prepare` va `.../complete`
- Demo "tekin kredit" tugmasi/endpoint'i productionда **avtomatik o'chiq** (faqat dev'da).

## Yangilash
```bash
git pull
docker compose --env-file .env.prod up -d --build
```

## Xavfsizlik
- `api` (8000) tashqariga ochilmaydi — faqat ichki tarmoq orqali `web` chaqiradi (compose'да port expose qilinmagan). ✅
- Parol/sirlarni `.env.prod`да saqlang, git'ga qo'shmang (`.gitignore`да).
- Rate-limit/usage tizimi allaqachon bor (anonim/foydalanuvchi limitlari).

## TTS ovozlar — CPU pilot (GPU shart emas)
Stack 4 servis: `caddy` (HTTPS) · `web` (Next.js) · `api` (MMS+Whisper :8000) · `piper` (nativ o'zbek :8002) · `db`.

- **Piper (nativ o'zbek ayol) — DEFAULT ovoz.** CPU'da ishlaydi (`piper` servisi, onnxruntime), x/gʻ/q to'g'ri. Model image ichida (~61MB). Sintez ~0.5-1s.
- **MMS (erkak / asosiy)** — `api` konteynerда, CPU'да ishlaydi (sekinroq ~2-4s). Birinchi so'rovда HF'дан yuklanadi → `hf_cache`.
- **F5 ovozlar (Feruza/Jonli) va "Mening ovozim" (ovoz klonlash) — GPU TALAB QILADI** va alohida F5 servis kerak → **CPU pilotда O'CHIQ**. Bu ovozlar tanlansa xato qaytaradi. GPU server qo'shilganda:
  1. F5 uchun servis qo'shing (`f5_server.py` + torch CUDA + `ckpts/uzbek100/model_last.pt` 3.2GB), `api`ga `F5_SERVER_URL` bering.
  2. "Mening ovozim" uchun `web` va F5 servis orasida **`tts-server/voices` umumiy volume** (reference klip ikkala konteynerга ko'rinishi uchun).

## Eslatma — GPU (kelajak, ixtiyoriy)
- **GPU bo'lsa:** F5 ovozlar + klon ishlaydi; MMS/Piper ham tezroq. `api` Dockerfile'да torch'ni `cu121` wheel'ga qaytaring + `docker-compose.yml`да `api` (va F5 servisi) uchun `deploy.resources` GPU blokini oching + `nvidia-container-toolkit` o'rnating.
- **CPU (pilot):** Piper default sifatida yetarli; kichik/o'rta trafik uchun mos.
