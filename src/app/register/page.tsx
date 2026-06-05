"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signIn } from "next-auth/react";
import {
  Loader2,
  UserPlus,
  AlertCircle,
  AudioLines,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { Backdrop } from "@/components/backdrop";
import { ThemeToggle } from "@/components/theme-toggle";
import { LangSwitcher } from "@/components/lang-switcher";
import { cn } from "@/lib/utils";

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error");

      // Ro'yxatdan o'tgach avtomatik kirish (auto-login)
      const sigRes = await signIn("credentials", { email, password, redirect: false });
      if (sigRes?.error) {
        // Avto-login bo'lmasa — login sahifasiga (foydalanuvchi qo'lda kiradi)
        router.push(`/login?registered=1&email=${encodeURIComponent(email)}`);
        return;
      }
      // Sessiya cookie o'rnatildi — to'liq yuklash bilan kabinetga (server auth() ko'radi)
      window.location.href = "/cabinet";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error");
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen">
      <Backdrop />

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

      <main className="mx-auto flex w-full max-w-md flex-col items-center px-4 pb-12 pt-8 animate-fade-in sm:pt-12">
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
              {t("auth.register.title")}
            </h1>
            <p className="text-xs text-fg-muted">{t("auth.register.sub")}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <Field label={t("auth.register.name")}>
              <input
                type="text"
                required
                minLength={2}
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t("auth.register.email")}>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
              />
            </Field>
            <Field label={t("auth.register.password")}>
              <input
                type="password"
                required
                minLength={6}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
              />
              <span className="text-[10px] text-fg-subtle">
                {t("auth.register.passwordHint")}
              </span>
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
                <UserPlus className="h-4 w-4" />
              )}
              {t("auth.register.submit")}
            </button>
          </form>

          <div className="mt-4 flex items-start gap-2 rounded-lg bg-bg-muted/60 p-2.5 text-[11px] text-fg-muted">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-success" />
            <span>{t("auth.register.benefits")}</span>
          </div>

          <div className="mt-4 text-center text-xs text-fg-muted">
            {t("auth.register.haveAccount")}{" "}
            <Link href="/login" className="text-accent hover:underline">
              {t("auth.register.signInLink")}
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
