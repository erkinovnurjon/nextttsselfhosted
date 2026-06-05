import { NextResponse } from "next/server";
import { checkPaymeAuth, handlePayme } from "@/lib/payments/payme";

export const dynamic = "force-dynamic";

// Payme Merchant API webhook (JSON-RPC).
// Payme bu endpoint'ni Basic auth bilan chaqiradi.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const id = body?.id ?? null;

  // Auth tekshiruvi — noto'g'ri bo'lsa -32504
  if (!checkPaymeAuth(request.headers.get("authorization"))) {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32504,
        message: {
          ru: "Недостаточно привилегий",
          uz: "Ruxsat yetarli emas",
          en: "Insufficient privileges",
        },
      },
    });
  }

  if (!body || typeof body.method !== "string") {
    return NextResponse.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32600,
        message: { ru: "Неверный запрос", uz: "Noto'g'ri so'rov", en: "Invalid request" },
      },
    });
  }

  const res = await handlePayme(body.method, body.params ?? {});
  return NextResponse.json({ jsonrpc: "2.0", id, ...res });
}
