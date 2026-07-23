import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// Kalitni o'chirish (revoke).
//
// Yozuv o'chirilmaydi, revokedAt qo'yiladi: kalit qachon va kim tomonidan
// ishlatilganini tekshirish kerak bo'lishi mumkin (audit). Autentifikatsiya
// revokedAt'ni ko'rib darrov rad etadi.

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Tizimga kiring" }, { status: 401 });
  }
  const { id } = await params;

  // userId shartda — begona kalitni o'chira olmaslik uchun (updateMany 0 qaytaradi).
  const res = await db.apiKey.updateMany({
    where: { id, userId: session.user.id, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Kalit topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
