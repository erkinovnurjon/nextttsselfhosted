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

## Eslatma — GPU vs CPU
- **GPU:** sintez ~0.5s, ASR tez. `deploy.resources` + nvidia-container-toolkit kerak.
- **CPU:** ishlaydi, lekin sintez ~2-4s, ASR ~3-5s. Kichik/o'rta trafik uchun yetarli.
