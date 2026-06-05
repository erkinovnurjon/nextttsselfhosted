"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { Loader2, LogIn, AlertCircle, AudioLines, ArrowLeft, CheckCircle2 } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Backdrop } from "@/components/backdrop";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangSwitcher } from "@/components/lang-switcher";
import { cn } from "@/lib/utils";

function LoginForm() {
  const { t } = useI18n();
  const search = useSearchParams();
  const callbackUrl = search.get("callbackUrl") || "/cabinet";
  const justRegistered = search.get("registered") === "1";

  const [email, setEmail] = useState(search.get("email") || "");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await signIn("credentials", { email, password, redirect: false });
      if (res?.error) {
        setError(t("auth.login.error"));
        setLoading(false);
        return;
      }
      // Sessiya cookie o'rnatildi — to'liq yuklash bilan o'tamiz
      window.location.href = callbackUrl;
    } catch {
      setError(t("auth.login.error"));
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-fg-muted transition hover:text-fg"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("auth.login.backHome")}
        </Link>
        <div className="flex items-center gap-1.5">
          <LangSwitcher />
          <ThemeToggle />
        </div>
      </div>

      <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 pb-12 pt-8 animate-fade-in sm:pt-16">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
            <AudioLines className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold tracking-tight">
            Next<span className="brand-text">TTS</span>
          </span>
        </Link>

        <div className="card-glow w-full p-7">
          <div className="space-y-1 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              {t("auth.login.title")}
            </h1>
            <p className="text-xs text-fg-muted">{t("auth.login.sub")}</p>
          </div>

          {justRegistered && (
            <div className="mt-5 flex items-start gap-2 rounded-lg bg-success/10 p-2.5 text-xs text-success">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
              <span>{t("auth.login.registered")}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Field label={t("auth.login.email")}>
              <input
                type="email"
                required
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t("auth.login.password")}>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
            </Field>

            {error && (
              <div className="flex items-start gap-2 rounded-lg bg-danger/10 p-2.5 text-xs text-danger">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition",
                loading
                  ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                  : "brand-gradient text-white shadow-glow hover:opacity-90"
              )}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogIn className="h-4 w-4" />
              )}
              {t("auth.login.submit")}
            </button>
          </form>

          <div className="mt-5 text-center text-xs text-fg-muted">
            {t("auth.login.noAccount")}{" "}
            <Link href="/register" className="text-accent hover:underline">
              {t("auth.login.signUpLink")}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-fg-muted">{label}</span>
      {children}
    </label>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-sm text-fg-muted">…</div>}>
      <LoginForm />
    </Suspense>
  );
}
