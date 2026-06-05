import { NextResponse } from "next/server";
import { clickPrepare, type ClickParams } from "@/lib/payments/click";
import { parseClickForm } from "@/lib/payments/click-form";

export const dynamic = "force-dynamic";

// Click Prepare (action=0)
export async function POST(request: Request) {
  const params = (await parseClickForm(request)) as unknown as ClickParams;
  const res = await clickPrepare(params);
  return NextResponse.json(res);
}
