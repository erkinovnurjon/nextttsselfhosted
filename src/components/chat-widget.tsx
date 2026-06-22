"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, Loader2, Bot } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const LABELS: Record<string, { title: string; placeholder: string; greeting: string }> = {
  uz: {
    title: "NextTTS yordamchi",
    placeholder: "Savol yozing…",
    greeting:
      "Salom! Men NextTTS yordamchisiman. Ovozlar, “Mening ovozim”, balans yoki matndan nutq bo'yicha so'rang.",
  },
  ru: {
    title: "Помощник NextTTS",
    placeholder: "Напишите вопрос…",
    greeting:
      "Привет! Я помощник NextTTS. Спросите о голосах, «Мой голос», балансе или синтезе речи.",
  },
  en: {
    title: "NextTTS Assistant",
    placeholder: "Ask a question…",
    greeting:
      "Hi! I'm the NextTTS assistant. Ask about voices, “My voice”, balance, or text-to-speech.",
  },
};

export function ChatWidget() {
  const { lang } = useI18n();
  const L = LABELS[lang] ?? LABELS.uz;
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Ochilganda salomlashish (bir marta)
  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: L.greeting }]);
    }
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setInput("");
    const next: Msg[] = [...messages, { role: "user", content: text }];
    setMessages([...next, { role: "assistant", content: "" }]);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next, lang }),
      });
      if (!res.ok || !res.body) throw new Error("xato");
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let acc = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += dec.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
      if (!acc.trim()) {
        setMessages((prev) => {
          const copy = prev.slice();
          copy[copy.length - 1] = {
            role: "assistant",
            content: "Kechirasiz, javob bo'sh keldi. Qaytadan urinib ko'ring.",
          };
          return copy;
        });
      }
    } catch {
      setMessages((prev) => {
        const copy = prev.slice();
        copy[copy.length - 1] = {
          role: "assistant",
          content: "Ulanishda xatolik. Birozdan so'ng qayta urinib ko'ring.",
        };
        return copy;
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* Suzuvchi tugma */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={L.title}
          className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full brand-gradient text-white shadow-glow ring-1 ring-white/15 transition hover:scale-105 hover:opacity-95"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex h-[560px] max-h-[calc(100vh-2rem)] w-[min(380px,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-bg-subtle/95 shadow-2xl backdrop-blur-xl animate-fade-in">
          {/* Header */}
          <div className="flex items-center gap-2.5 border-b border-border/60 bg-bg/60 px-4 py-3">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg brand-gradient text-white shadow-glow">
              <Bot className="h-[18px] w-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{L.title}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-bg-muted hover:text-fg"
              aria-label="close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto scrollbar-thin px-3 py-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[85%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-[13px] leading-relaxed",
                    m.role === "user"
                      ? "brand-gradient text-white"
                      : "border border-border bg-bg/60 text-fg"
                  )}
                >
                  {m.content || (busy && i === messages.length - 1 ? (
                    <Loader2 className="h-4 w-4 animate-spin text-fg-subtle" />
                  ) : (
                    ""
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-border/60 bg-bg/60 p-2.5">
            <div className="flex items-end gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={L.placeholder}
                className="flex-1 rounded-xl border border-border bg-bg/60 px-3 py-2.5 text-[13px] outline-none transition focus:border-accent/50"
              />
              <button
                onClick={send}
                disabled={busy || !input.trim()}
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition",
                  busy || !input.trim()
                    ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                    : "brand-gradient text-white shadow-glow hover:opacity-90"
                )}
                aria-label="send"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
