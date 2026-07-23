"use client";

import { Copy, Check, Trash2, AudioLines } from "lucide-react";
import type { TFunc } from "@/lib/i18n";
import { cn } from "@/lib/utils";

export function ResultPanel({
  t,
  text,
  copied,
  onChangeText,
  onCopy,
  onClear,
  onToSintez,
}: {
  t: TFunc;
  text: string;
  copied: boolean;
  onChangeText: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onCopy: () => void;
  onClear: () => void;
  onToSintez: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
          {t("cabinet.transkripsiya.resultLabel")}
        </span>
        <span className="text-[10px] text-fg-subtle">
          {t("cabinet.transkripsiya.charCount", { n: text.length })}
        </span>
      </div>
      <textarea
        value={text}
        onChange={onChangeText}
        rows={5}
        placeholder={t("cabinet.transkripsiya.resultPlaceholder")}
        className="w-full resize-none rounded-2xl border border-border bg-bg/60 px-4 py-3 text-base outline-none transition focus:border-accent/50"
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={onCopy}
          disabled={!text}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
            !text
              ? "cursor-not-allowed border-border text-fg-subtle"
              : copied
              ? "border-success/40 bg-success/10 text-success"
              : "border-border hover:bg-bg-muted"
          )}
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          {copied ? t("cabinet.transkripsiya.copied") : t("cabinet.transkripsiya.copy")}
        </button>

        <button
          onClick={onClear}
          disabled={!text}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-sm font-medium transition",
            !text
              ? "cursor-not-allowed border-border text-fg-subtle"
              : "border-border hover:bg-bg-muted hover:text-danger"
          )}
        >
          <Trash2 className="h-4 w-4" />
          {t("cabinet.transkripsiya.clear")}
        </button>

        <button
          onClick={onToSintez}
          disabled={!text.trim()}
          className={cn(
            "ml-auto inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold transition",
            !text.trim()
              ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
              : "brand-gradient text-white shadow-glow hover:opacity-90"
          )}
        >
          <AudioLines className="h-4 w-4" />
          {t("cabinet.transkripsiya.toSintez")}
        </button>
      </div>
    </div>
  );
}
