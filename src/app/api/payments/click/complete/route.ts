import { NextResponse } from "next/server";
import { clickComplete, type ClickParams } from "@/lib/payments/click";
import { parseClickForm } from "@/lib/payments/click-form";

export const dynamic = "force-dynamic";

// Click Complete (action=1)
export async function POST(request: Request) {
  const params = (await parseClickForm(request)) as unknown as ClickParams;
  const res = await clickComplete(params);
  return NextResponse.json(res);
}
