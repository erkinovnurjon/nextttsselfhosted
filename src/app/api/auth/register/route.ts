import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { SIGNUP_BONUS } from "@/lib/credits";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";

  // Validatsiya
  if (!email || !email.includes("@")) {
    return NextResponse.json(
      { error: "To'g'ri email kiriting" },
      { status: 400 }
    );
  }
  if (password.length < 6) {
    return NextResponse.json(
      { error: "Parol kamida 6 belgidan iborat bo'lishi kerak" },
      { status: 400 }
    );
  }
  if (!name || name.length < 2) {
    return NextResponse.json(
      { error: "Ism kiriting (kamida 2 belgi)" },
      { status: 400 }
    );
  }

  // Mavjudligini tekshirish
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "Bu email allaqachon ro'yxatdan o'tgan" },
      { status: 409 }
    );
  }

  // Birinchi foydalanuvchi avtomatik admin bo'ladi
  const userCount = await db.user.count();
  const role = userCount === 0 ? "admin" : "user";

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      name,
      role,
      balance: SIGNUP_BONUS,
    },
    select: { id: true, email: true, name: true, role: true },
  });

  // Ro'yxatdan o'tish bonusini ledger'ga yozish
  await db.creditTransaction
    .create({
      data: {
        userId: user.id,
        amount: SIGNUP_BONUS,
        reason: "signup",
        balanceAfter: SIGNUP_BONUS,
      },
    })
    .catch(() => undefined);

  return NextResponse.json({ user }, { status: 201 });
}
