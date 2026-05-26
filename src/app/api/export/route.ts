import { NextResponse } from "next/server";
import { exportLJSpeech } from "@/lib/dataset";

export async function GET() {
  const csv = await exportLJSpeech();
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="metadata.csv"',
    },
  });
}
