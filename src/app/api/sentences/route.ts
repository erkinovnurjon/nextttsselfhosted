import { NextResponse } from "next/server";
import { addSentence, loadSentences } from "@/lib/dataset";

export async function GET() {
  const sentences = await loadSentences();
  return NextResponse.json({ sentences });
}

export async function POST(request: Request) {
  const body = await request.json();
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (!text) {
    return NextResponse.json(
      { error: "Matn bo'sh bo'lmasligi kerak" },
      { status: 400 }
    );
  }
  if (text.length > 500) {
    return NextResponse.json(
      { error: "Matn 500 belgidan oshmasligi kerak" },
      { status: 400 }
    );
  }
  const sentence = await addSentence(text);
  return NextResponse.json({ sentence }, { status: 201 });
}
