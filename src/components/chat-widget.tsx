"use client";

import { useEffect, useRef, useState } from "react";
import { MessageCircle, X, ArrowUp, Loader2, Bot } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const LABELS: Record<
  string,
  { title: string; subtitle: string; placeholder: string; greeting: string; chips: string[] }
> = {
  uz: {
    title: "NextTTS yordamchi",
    subtitle: "Sizga yordam beraman",
    placeholder: "Savol yozing…",
    greeting: "Salom! Nima bo'yicha yordam kerak?",
    chips: ["Ovozlar qanday?", "Mening ovozim", "Balansni to'ldirish", "Nutqdan matn"],
  },
  ru: {
    title: "Помощник NextTTS",
    subtitle: "Я помогу вам",
    placeholder: "Напишите вопрос…",
    greeting: "Привет! С чем помочь?",
    chips: ["Какие голоса?", "Мой голос", "Пополнить баланс", "Речь в текст"],
  },
  en: {
    title: "NextTTS Assistant",
    subtitle: "Here to help",
    placeholder: "Ask a question…",
    greeting: "Hi! How can I help?",
    chips: ["What voices?", "My voice", "Top up balance", "Speech to text"],
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

  async function send(override?: string) {
    const text = (override ?? input).trim();
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
      // Yakuniy flush: oxirgi chunk ko'p-baytli belgida (oʻ/gʻ/kirill) tugasa, tushib qolmasin.
      const tail = dec.decode();
      if (tail) {
        acc += tail;
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

  const showChips = messages.length <= 1 && !busy;

  return (
    <>
      {/* Suzuvchi tugma — yagona gradient joy */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label={L.title}
          className="fixed bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full brand-gradient text-white shadow-glow ring-1 ring-white/15 transition hover:scale-105 hover:opacity-95"
        >
          <MessageCircle className="h-7 w-7" />
        </button>
      )}

      {/* Panel — toza, yordam uslubi */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[560px] max-h-[calc(100vh-3rem)] w-[min(384px,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl border border-border bg-bg-subtle shadow-xl">
          {/* Header — avatar + sarlavha + ost-sarlavha */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Bot className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[14px] font-semibold tracking-tight">{L.title}</div>
              <div className="truncate text-[11px] text-fg-subtle">{L.subtitle}</div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="-mr-1 rounded-lg p-1.5 text-fg-subtle transition hover:bg-bg-muted hover:text-fg"
              aria-label="close"
            >
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>

          {/* Xabarlar */}
          <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto scrollbar-thin px-4 py-4">
            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tr-md bg-accent/10 px-3.5 py-2 text-[13px] leading-relaxed text-fg">
                    {m.content}
                  </div>
                </div>
              ) : (
                <div key={i} className="flex gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
                    <Bot className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1 whitespace-pre-wrap pt-0.5 text-[13.5px] leading-relaxed text-fg">
                    {m.content ||
                      (busy && i === messages.length - 1 ? (
                        <span className="inline-flex gap-1 py-1.5">
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.3s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle [animation-delay:-0.15s]" />
                          <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-fg-subtle" />
                        </span>
                      ) : (
                        ""
                      ))}
                  </div>
                </div>
              )
            )}

            {/* Tezkor savol chiplari */}
            {showChips && (
              <div className="flex flex-wrap gap-2 pl-[34px] pt-1">
                {L.chips.map((c) => (
                  <button
                    key={c}
                    onClick={() => send(c)}
                    className="rounded-full border border-border bg-bg px-3 py-1.5 text-[12px] text-fg-muted transition hover:border-accent/40 hover:bg-accent/5 hover:text-fg"
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-center gap-2 rounded-full border border-border bg-bg px-4 py-1 transition focus-within:border-accent/50">
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
                className="flex-1 bg-transparent py-2 text-[13px] outline-none placeholder:text-fg-subtle"
              />
              <button
                onClick={() => send()}
                disabled={busy || !input.trim()}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition",
                  busy || !input.trim()
                    ? "cursor-not-allowed text-fg-subtle"
                    : "bg-accent text-white hover:opacity-90"
                )}
                aria-label="send"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
