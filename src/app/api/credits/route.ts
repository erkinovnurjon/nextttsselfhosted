import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  getSummary,
  getLedger,
  grantCredits,
  TOPUP_AMOUNT,
} from "@/lib/credits";

export const dynamic = "force-dynamic";

// GET → balans xulosasi + tranzaksiyalar tarixi (ledger)
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const limit = Math.min(
    200,
    Math.max(1, parseInt(url.searchParams.get("limit") || "50", 10))
  );

  const [summary, ledger] = await Promise.all([
    getSummary(session.user.id),
    getLedger(session.user.id, limit),
  ]);

  return NextResponse.json({ ...summary, ledger });
}

// POST → demo "to'ldirish": balansga TOPUP_AMOUNT kredit qo'shadi.
// (To'lov integratsiyasi keyinroq — hozircha tugma bosilganda bonus beriladi.)
export async function POST() {
  // ⚠️ Demo to'ldirish — faqat dev'da. Productionда haqiqiy to'lov (Payme/Click) ishlatiladi.
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DEMO_TOPUP !== "true") {
    return NextResponse.json(
      { error: "Demo to'ldirish o'chirilgan. Balansni to'lov orqali to'ldiring." },
      { status: 403 }
    );
  }
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const balance = await grantCredits(
    session.user.id,
    TOPUP_AMOUNT,
    "topup",
    "demo top-up"
  );
  return NextResponse.json({ ok: true, added: TOPUP_AMOUNT, balance });
}
