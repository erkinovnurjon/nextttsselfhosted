"use client";

import { useEffect, useState } from "react";
import { X, Loader2, CreditCard, ArrowRight } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf } from "@/lib/format";
import {
  CREDITS_PER_SOM,
  MIN_TOPUP_SOM,
  MAX_TOPUP_SOM,
  QUICK_AMOUNTS_SOM,
  creditsForSom,
  isValidTopupSom,
} from "@/lib/pricing";
import { cn } from "@/lib/utils";

type Provider = "payme" | "click";

const PROVIDERS: { id: Provider; label: string; color: string }[] = [
  { id: "payme", label: "Payme", color: "from-[#33cccc] to-[#0a9bd6]" },
  { id: "click", label: "Click", color: "from-[#00aaff] to-[#0066ff]" },
];

export function TopUpModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const loc = localeOf(lang);
  const [amount, setAmount] = useState<number>(10_000);
  const [provider, setProvider] = useState<Provider>("payme");
  const [available, setAvailable] = useState<{ payme: boolean; click: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/payments/checkout")
      .then((r) => r.json())
      .then((d) => setAvailable(d))
      .catch(() => setAvailable({ payme: false, click: false }));
  }, []);

  // Esc bilan yopish
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const credits = creditsForSom(amount || 0);
  const valid = isValidTopupSom(amount);
  const providerOk = available ? available[provider] : true;

  async function pay() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/payments/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, amountSom: amount }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error");
        return;
      }
      // Provayder checkout sahifasiga yo'naltirish
      window.location.href = data.checkoutUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  // Test rejimi: to'lov gateway'i sozlanmaguncha balansni tekshirish uchun.
  // Mavjud /api/credits demo endpoint'i orqali kredit qo'shadi (gateway'siz).
  async function testTopUp() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/credits", { method: "POST" });
      if (!res.ok) throw new Error("Error");
      window.dispatchEvent(new Event("nexttts:credits-changed"));
      onClose();
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
    } finally {
      setSubmitting(false);
    }
  }

  const testLabel = {
    uz: "Test rejimi: gateway'siz +5000 kredit qo'shish",
    ru: "Тест-режим: добавить +5000 кредитов без шлюза",
    en: "Test mode: add +5000 credits without a gateway",
  }[lang];

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-t-3xl border border-border bg-bg-subtle/95 p-6 shadow-soft backdrop-blur-xl animate-fade-in sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{t("cabinet.balans.topupTitle")}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-fg-subtle transition hover:bg-bg-muted hover:text-fg"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-1 text-xs text-fg-muted">{t("cabinet.balans.topupDesc")}</p>

        {/* Amount */}
        <div className="mt-5">
          <label className="text-xs font-medium text-fg-muted">
            {t("cabinet.balans.topup.amountLabel")}
          </label>
          <div className="mt-1.5 flex items-center rounded-xl border border-border bg-bg/60 px-3 transition focus-within:border-accent/50">
            <input
              type="number"
              inputMode="numeric"
              min={MIN_TOPUP_SOM}
              max={MAX_TOPUP_SOM}
              step={1000}
              value={amount || ""}
              onChange={(e) => setAmount(Math.floor(Number(e.target.value)))}
              placeholder={t("cabinet.balans.topup.amountPlaceholder")}
              className="w-full bg-transparent py-3 text-lg font-semibold tabular-nums outline-none"
            />
            <span className="text-sm text-fg-subtle">so‘m</span>
          </div>

          {/* Quick chips */}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {QUICK_AMOUNTS_SOM.map((q) => (
              <button
                key={q}
                onClick={() => setAmount(q)}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[11px] transition",
                  amount === q
                    ? "border-accent/50 bg-accent/10 text-accent"
                    : "border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
                )}
              >
                {q.toLocaleString(loc)}
              </button>
            ))}
          </div>

          {/* Credit preview */}
          <div className="mt-3 flex items-center justify-between rounded-xl bg-accent/8 px-3 py-2.5">
            <span className="text-xs text-fg-muted">
              {t("cabinet.balans.topup.rate", { n: (1000 * CREDITS_PER_SOM).toLocaleString(loc) })}
            </span>
            <span className="text-sm font-semibold text-accent">
              {t("cabinet.balans.topup.youGet", { n: credits.toLocaleString(loc) })}
            </span>
          </div>
          {!valid && amount > 0 && (
            <p className="mt-1.5 text-[11px] text-warning">
              {amount < MIN_TOPUP_SOM
                ? t("cabinet.balans.topup.min", { n: MIN_TOPUP_SOM.toLocaleString(loc) })
                : t("cabinet.balans.topup.max", { n: MAX_TOPUP_SOM.toLocaleString(loc) })}
            </p>
          )}
        </div>

        {/* Provider */}
        <div className="mt-5">
          <label className="text-xs font-medium text-fg-muted">
            {t("cabinet.balans.topup.provider")}
          </label>
          <div className="mt-1.5 grid grid-cols-2 gap-2.5">
            {PROVIDERS.map((p) => {
              const ok = available ? available[p.id] : true;
              const active = provider === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setProvider(p.id)}
                  className={cn(
                    "relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all",
                    active ? "border-accent/50 bg-accent/8" : "border-border hover:bg-bg-muted"
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-16 items-center justify-center rounded-lg bg-gradient-to-r text-[13px] font-bold text-white",
                      p.color
                    )}
                  >
                    {p.label}
                  </span>
                  {!ok && (
                    <span className="text-[9px] text-warning">
                      {t("cabinet.balans.topup.notConfigured")}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="mt-3 rounded-lg bg-danger/10 p-2.5 text-xs text-danger">{error}</div>
        )}

        {/* Pay */}
        <button
          onClick={pay}
          disabled={!valid || submitting || !providerOk}
          className={cn(
            "mt-5 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition",
            !valid || !providerOk
              ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
              : "brand-gradient text-white shadow-glow hover:opacity-90"
          )}
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              {t("cabinet.balans.topup.redirecting")}
            </>
          ) : (
            <>
              <CreditCard className="h-5 w-5" />
              {t("cabinet.balans.topup.pay")}
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </button>

        {/* Test rejimi — faqat dev'da (productionда yashiriladi) */}
        {process.env.NODE_ENV !== "production" && (
          <button
            onClick={testTopUp}
            disabled={submitting}
            className="mt-2.5 w-full text-center text-[11px] text-fg-subtle underline-offset-2 transition hover:text-accent hover:underline disabled:opacity-50"
          >
            {testLabel}
          </button>
        )}
      </div>
    </div>
  );
}
