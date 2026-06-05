import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

// Buyurtma holatini qaytaradi (success sahifasi polling qiladi).
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const orderId = url.searchParams.get("order");
  if (!orderId) {
    return NextResponse.json({ error: "order kerak" }, { status: 400 });
  }

  const payment = await db.payment.findUnique({ where: { id: orderId } });
  if (!payment || payment.userId !== session.user.id) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }

  return NextResponse.json({
    status: payment.status, // pending | paid | canceled | failed
    provider: payment.provider,
    amountSom: payment.amountSom,
    credits: payment.credits,
  });
}
