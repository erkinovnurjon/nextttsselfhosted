# NextTTS frontend — Next.js (standalone)
FROM node:20-slim AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json* ./
RUN npm ci

FROM node:20-slim AS build
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:20-slim AS run
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
# Standalone build + static + prisma (migrate uchun)
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=build /app/node_modules/prisma ./node_modules/prisma
EXPOSE 3000
# Production: migratsiyalarni xavfsiz qo'llash (migrate deploy — hech qachon data o'chirmaydi).
# DB tayyor bo'lmasa 30 marta (60s) qayta urinadi, keyin serverni yoqadi.
CMD ["sh", "-c", "for i in $(seq 1 30); do node node_modules/prisma/build/index.js migrate deploy --skip-generate && break; echo \"DB hali tayyor emas, qayta urinish $i/30...\"; sleep 2; done; node server.js"]
