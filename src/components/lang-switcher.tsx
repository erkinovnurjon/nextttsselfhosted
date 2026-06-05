"use client";

import { useRef, useState, useEffect } from "react";
import { Check, Globe, ChevronDown } from "lucide-react";
import { useI18n, LANGS, type Lang } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function LangSwitcher({
  className,
  align = "right",
}: {
  className?: string;
  align?: "left" | "right";
}) {
  const { lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = LANGS.find((l) => l.code === lang) ?? LANGS[0];

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-9 items-center gap-1.5 rounded-xl border border-border px-2.5 text-[12px] font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg",
          open && "bg-bg-muted text-fg"
        )}
        aria-label="Language"
      >
        <Globe className="h-4 w-4" />
        <span className="hidden sm:inline">{current.native}</span>
        <ChevronDown className={cn("h-3 w-3 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className={cn(
            "absolute z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-bg-subtle/95 p-1 shadow-soft backdrop-blur-xl animate-fade-in",
            align === "right" ? "right-0" : "left-0"
          )}
        >
          {LANGS.map((l) => (
            <button
              key={l.code}
              onClick={() => {
                setLang(l.code as Lang);
                setOpen(false);
              }}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] transition",
                l.code === lang
                  ? "bg-bg-muted text-fg"
                  : "text-fg-muted hover:bg-bg-muted hover:text-fg"
              )}
            >
              <span className="text-base leading-none">{l.flag}</span>
              <span className="flex-1 text-left">{l.label}</span>
              {l.code === lang && <Check className="h-3.5 w-3.5 text-accent" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
