import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { generateKey, type ApiKeyKind } from "@/lib/api-key";

// ────────────────────────────────────────────────
// API kalitlarni boshqarish — kabinet uchun (sessiya bilan, kalit bilan EMAS).
//
// Ataylab: kalit bilan yangi kalit yaratishga ruxsat bermaymiz. Aks holda bitta
// o'g'irlangan kalit o'ziga cheksiz yangi kalit yasab, bekor qilishning oldini
// olardi. Kalit yaratish faqat brauzerdan, login qilgan egasi tomonidan.
// ────────────────────────────────────────────────

/** Bir foydalanuvchidagi faol kalitlar chegarasi. */
const MAX_KEYS = 20;

interface KeyView {
  id: string;
  name: string;
  kind: string;
  prefix: string;
  origins: string[];
  lastUsedAt: Date | null;
  createdAt: Date;
}

/** Domenni normallashtiradi: "https://lms.uz/dars" → "https://lms.uz". */
function normalizeOrigin(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const u = new URL(s.includes("://") ? s : `https://${s}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return null;
    return u.origin.toLowerCase();
  } catch {
    return null;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
  }
  const keys: KeyView[] = await db.apiKey.findMany({
    where: { userId: session.user.id, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      kind: true,
      prefix: true,
      origins: true,
      lastUsedAt: true,
      createdAt: true,
    },
  });
  return NextResponse.json({ keys });
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
  const kind: ApiKeyKind = body?.kind === "publishable" ? "publishable" : "secret";

  if (!name) {
    return NextResponse.json(
      { error: "Kalitga nom bering — keyin qaysi loyiha ekanini bilasiz." },
      { status: 400 }
    );
  }

  const rawOrigins: unknown[] = Array.isArray(body?.origins) ? body.origins : [];
  const seen = new Set<string>();
  for (const raw of rawOrigins) {
    if (typeof raw !== "string") continue;
    const o = normalizeOrigin(raw);
    if (o) seen.add(o);
  }
  const origins = [...seen];

  // Domensiz publishable kalit hech qayerda ishlamaydi (api-key.ts: origins bo'sh
  // → hamma rad etiladi). Jim yaratib qo'yish o'rniga sababni aytamiz.
  if (kind === "publishable" && origins.length === 0) {
    return NextResponse.json(
      {
        error:
          "Ommaviy kalit uchun kamida bitta domen kerak (masalan https://lms.uz). Domensiz kalit ishlamaydi — u brauzerda ochiq turgani uchun himoyasi shu.",
      },
      { status: 400 }
    );
  }

  const count = await db.apiKey.count({
    where: { userId: session.user.id, revokedAt: null },
  });
  if (count >= MAX_KEYS) {
    return NextResponse.json(
      { error: `Kalitlar chegarasi (${MAX_KEYS}). Eskilarini o'chiring.` },
      { status: 400 }
    );
  }

  const { token, prefix, hash } = generateKey(kind);
  const created = await db.apiKey.create({
    data: {
      userId: session.user.id,
      name,
      kind,
      prefix,
      hash,
      origins: kind === "publishable" ? origins : [],
    },
    select: { id: true, name: true, kind: true, prefix: true, origins: true, createdAt: true },
  });

  // `token` — YAGONA marta. Bazada faqat hash bor, qayta ko'rsatib bo'lmaydi.
  return NextResponse.json({ key: created, token }, { status: 201 });
}
