"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";

// ────────────────────────────────────────────────
// Integratsiya qo'llanmasi uchun kod bloklari.
//
// __BASE__ tokeni brauzerda joriy domenga almashtiriladi — foydalanuvchi
// misolni nusxalaganda o'z serverining manzili turadi, "SIZNING-DOMEN" emas.
// Server render paytida hali domen noma'lum, shuning uchun almashtirish
// mijozda (useEffect'dan keyin).
// ────────────────────────────────────────────────

function useOrigin(): string {
  const [origin, setOrigin] = useState("https://sizning-domen");
  useEffect(() => {
    if (typeof window !== "undefined") setOrigin(window.location.origin);
  }, []);
  return origin;
}

function fill(code: string, origin: string): string {
  return code.replaceAll("__BASE__", origin);
}

export function CodeBlock({ code, lang }: { code: string; lang?: string }) {
  const origin = useOrigin();
  const [copied, setCopied] = useState(false);
  const text = fill(code.trim(), origin);

  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="group relative overflow-hidden rounded-xl border border-border bg-bg-subtle/70">
      {lang && (
        <div className="border-b border-border/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
          {lang}
        </div>
      )}
      <button
        onClick={copy}
        aria-label="Nusxalash"
        className="absolute right-2 top-2 z-10 flex items-center gap-1 rounded-lg border border-border bg-bg/80 px-2 py-1 text-[11px] text-fg-muted opacity-0 backdrop-blur transition group-hover:opacity-100 hover:text-fg"
      >
        {copied ? <Check className="h-3 w-3 text-success" /> : <Copy className="h-3 w-3" />}
        {copied ? "Nusxalandi" : "Nusxa"}
      </button>
      <pre className="overflow-x-auto p-3 text-[12.5px] leading-relaxed">
        <code className="font-mono text-fg">{text}</code>
      </pre>
    </div>
  );
}

export interface Tab {
  label: string;
  lang?: string;
  code: string;
}

/** Bir necha tildagi misolni tab bilan ko'rsatadi (JS / PHP / Python / curl). */
export function CodeTabs({ tabs }: { tabs: Tab[] }) {
  const [active, setActive] = useState(0);
  const tab = tabs[active];
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {tabs.map((t, i) => (
          <button
            key={t.label}
            onClick={() => setActive(i)}
            className={
              "rounded-lg px-3 py-1.5 text-[12px] font-medium transition " +
              (i === active
                ? "bg-accent/12 text-accent"
                : "text-fg-muted hover:bg-bg-muted hover:text-fg")
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock code={tab.code} lang={tab.lang} />
    </div>
  );
}
