import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt, faqFallback, CHATBOT_MODEL } from "@/lib/chatbot";

export const runtime = "nodejs";

type ChatMsg = { role: "user" | "assistant"; content: string };

function textStream(text: string): Response {
  const enc = new TextEncoder();
  return new Response(
    new ReadableStream({
      start(c) {
        c.enqueue(enc.encode(text));
        c.close();
      },
    }),
    { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" } }
  );
}

export async function POST(request: Request) {
  let body: { messages?: ChatMsg[]; lang?: string };
  try {
    body = await request.json();
  } catch {
    return new Response("So'rov yaroqsiz", { status: 400 });
  }

  const lang = typeof body.lang === "string" ? body.lang : "uz";
  // Tarixni tozalash: faqat to'g'ri rollar, bo'sh emas, oxirgi 20 ta xabar.
  const all = Array.isArray(body.messages) ? body.messages : [];
  const history: ChatMsg[] = all
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .map((m) => ({ role: m.role, content: m.content.trim().slice(0, 4000) }))
    .slice(-20);

  // Birinchi xabar "user" bo'lishi shart.
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return new Response("Xabar bo'sh", { status: 400 });

  const lastUser = [...history].reverse().find((m) => m.role === "user");

  // API kaliti yo'q — FAQ fallback (pilot ishlashda davom etadi).
  if (!process.env.ANTHROPIC_API_KEY) {
    return textStream(faqFallback(lastUser?.content || ""));
  }

  const client = new Anthropic();
  try {
    const stream = client.messages.stream({
      model: CHATBOT_MODEL,
      max_tokens: 1024,
      output_config: { effort: "low" }, // yengil/tez — oddiy yordam savollari
      system: buildSystemPrompt(lang),
      messages: history,
    });

    const enc = new TextEncoder();
    const rs = new ReadableStream({
      async start(c) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              c.enqueue(enc.encode(event.delta.text));
            }
          }
        } catch {
          c.enqueue(enc.encode("\n\n(Kechirasiz, javob berishda xatolik yuz berdi.)"));
        } finally {
          c.close();
        }
      },
    });

    return new Response(rs, {
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-cache" },
    });
  } catch {
    // Kalit noto'g'ri yoki API ishlamadi — fallback'ga tushamiz.
    return textStream(faqFallback(lastUser?.content || ""));
  }
}
