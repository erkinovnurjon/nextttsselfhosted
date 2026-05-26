import { NextResponse } from "next/server";
import { deleteSentence, updateSentence } from "@/lib/dataset";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await request.json();
  const patch: { text?: string; notes?: string | null } = {};
  if (typeof body?.text === "string") {
    const text = body.text.trim();
    if (!text) {
      return NextResponse.json(
        { error: "Matn bo'sh bo'lmasligi kerak" },
        { status: 400 }
      );
    }
    patch.text = text;
  }
  if (body?.notes !== undefined) {
    patch.notes =
      typeof body.notes === "string" && body.notes.trim()
        ? body.notes.trim()
        : null;
  }
  const sentence = await updateSentence(id, patch);
  if (!sentence) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ sentence });
}

export async function DELETE(_request: Request, ctx: Ctx) {
  const { id } = await ctx.params;
  const ok = await deleteSentence(id);
  if (!ok) {
    return NextResponse.json({ error: "Topilmadi" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
