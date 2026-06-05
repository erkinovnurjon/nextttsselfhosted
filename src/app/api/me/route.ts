import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserUsage } from "@/lib/usage";
import { getSummary } from "@/lib/credits";

export const dynamic = "force-dynamic";

// Kabinet uchun yagona ma'lumot endpoint'i:
// foydalanuvchi, bugungi limit, statistika va so'nggi sintezlar.
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const role = session.user.role;
  const url = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(url.searchParams.get("limit") || "30", 10)));

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const [user, usage, credits, recent, total, todayAgg] = await Promise.all([
    db.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, role: true, createdAt: true },
    }),
    getUserUsage(userId, role),
    getSummary(userId),
    db.synthesis.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        text: true,
        voice: true,
        charCount: true,
        durationSec: true,
        createdAt: true,
      },
    }),
    db.synthesis.count({ where: { userId } }),
    db.synthesis.aggregate({
      where: { userId, createdAt: { gte: startOfDay } },
      _count: { _all: true },
      _sum: { charCount: true },
    }),
  ]);

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    user,
    usage,
    credits,
    stats: {
      total,
      today: todayAgg._count._all,
      charsToday: todayAgg._sum.charCount ?? 0,
    },
    recent,
  });
}
