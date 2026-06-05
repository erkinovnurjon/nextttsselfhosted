import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { creditsForSom, isValidTopupSom, somToTiyin } from "@/lib/pricing";
import {
  APP_URL,
  PAYME,
  CLICK,
  paymeConfigured,
  clickConfigured,
} from "@/lib/payments/config";

export const dynamic = "force-dynamic";

// Qaysi provayderlar sozlangan — UI uchun
export async function GET() {
  return NextResponse.json({
    payme: paymeConfigured(),
    click: clickConfigured(),
  });
}

// To'lovni boshlash: buyurtma yaratadi va provayder checkout URL'ini qaytaradi.
export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const provider = body?.provider === "click" ? "click" : body?.provider === "payme" ? "payme" : null;
  const amountSom = Math.floor(Number(body?.amountSom));

  if (!provider) {
    return NextResponse.json({ error: "Provider noto'g'ri" }, { status: 400 });
  }
  if (!isValidTopupSom(amountSom)) {
    return NextResponse.json({ error: "Summa noto'g'ri" }, { status: 400 });
  }
  if (provider === "payme" && !paymeConfigured()) {
    return NextResponse.json({ error: "Payme sozlanmagan (.env)" }, { status: 503 });
  }
  if (provider === "click" && !clickConfigured()) {
    return NextResponse.json({ error: "Click sozlanmagan (.env)" }, { status: 503 });
  }

  const credits = creditsForSom(amountSom);

  const payment = await db.payment.create({
    data: {
      userId: session.user.id,
      provider,
      amountSom,
      credits,
      status: "pending",
    },
  });

  const returnUrl = `${APP_URL}/cabinet/balans/success?order=${payment.id}`;

  let checkoutUrl: string;
  if (provider === "payme") {
    // Payme: base64("m=...;ac.order_id=...;a=<tiyin>;c=<callback>")
    const raw = [
      `m=${PAYME.merchantId}`,
      `ac.order_id=${payment.id}`,
      `a=${somToTiyin(amountSom)}`,
      `c=${returnUrl}`,
    ].join(";");
    const encoded = Buffer.from(raw, "utf8").toString("base64");
    checkoutUrl = `${PAYME.checkoutBase}/${encoded}`;
  } else {
    // Click: my.click.uz/services/pay?...
    const qs = new URLSearchParams({
      service_id: CLICK.serviceId,
      merchant_id: CLICK.merchantId,
      amount: String(amountSom),
      transaction_param: payment.id,
      return_url: returnUrl,
    });
    checkoutUrl = `${CLICK.checkoutBase}?${qs.toString()}`;
  }

  return NextResponse.json({ orderId: payment.id, checkoutUrl, credits });
}
