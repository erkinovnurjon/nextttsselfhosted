"use client";

import Link from "next/link";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Loader2, Wallet, ArrowLeft } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { localeOf } from "@/lib/format";

function SuccessInner() {
  const { t, lang } = useI18n();
  const loc = localeOf(lang);
  const search = useSearchParams();
  const orderId = search.get("order");
  const [status, setStatus] = useState<"pending" | "paid" | "canceled" | "failed" | "unknown">(
    "pending"
  );
  const [credits, setCredits] = useState<number | null>(null);

  useEffect(() => {
    if (!orderId) {
      setStatus("unknown");
      return;
    }
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;

    const poll = async () => {
      tries++;
      try {
        const d = await fetch(`/api/payments/status?order=${orderId}`).then((r) => r.json());
        if (d?.status) {
          setStatus(d.status);
          setCredits(d.credits ?? null);
          if (d.status === "paid") {
            window.dispatchEvent(new Event("nexttts:credits-changed"));
            return; // to'xtatamiz
          }
        }
      } catch {
        /* ignore */
      }
      // 20 marta ~ 60s gacha tekshiramiz
      if (tries < 20) timer = setTimeout(poll, 3000);
    };
    poll();
    return () => clearTimeout(timer);
  }, [orderId]);

  const paid = status === "paid";

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center text-center animate-fade-in">
      <div
        className={
          paid
            ? "flex h-16 w-16 items-center justify-center rounded-2xl bg-success/15 text-success"
            : "flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 text-accent"
        }
      >
        {paid ? <CheckCircle2 className="h-8 w-8" /> : <Loader2 className="h-8 w-8 animate-spin" />}
      </div>

      <h2 className="mt-5 text-xl font-bold tracking-tight">
        {paid ? t("cabinet.balans.success.title") : t("cabinet.balans.success.checking")}
      </h2>
      <p className="mt-2 max-w-sm text-sm text-fg-muted">{t("cabinet.balans.success.desc")}</p>

      {paid && credits != null && (
        <div className="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent/8 px-4 py-2 text-sm font-semibold text-accent">
          <Wallet className="h-4 w-4" />+{credits.toLocaleString(loc)} {t("cabinet.balans.unit")}
        </div>
      )}

      <Link
        href="/cabinet/balans"
        className="mt-7 inline-flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("cabinet.balans.success.back")}
      </Link>
    </div>
  );
}

export default function PaymentSuccessPage() {
  return (
    <Suspense fallback={<div className="flex h-64 items-center justify-center text-fg-subtle"><Loader2 className="h-6 w-6 animate-spin" /></div>}>
      <SuccessInner />
    </Suspense>
  );
}
