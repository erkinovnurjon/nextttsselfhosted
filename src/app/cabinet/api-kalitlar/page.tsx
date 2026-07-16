"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Copy, Check, Trash2, Plus, ShieldAlert, Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface ApiKeyRow {
  id: string;
  name: string;
  kind: "secret" | "publishable";
  prefix: string;
  origins: string[];
  lastUsedAt: string | null;
  createdAt: string;
}

export default function ApiKeysPage() {
  const { t } = useI18n();
  const [keys, setKeys] = useState<ApiKeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Yangi kalit formasi
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"secret" | "publishable">("secret");
  const [originsText, setOriginsText] = useState("");
  const [creating, setCreating] = useState(false);

  // Yaratilgan kalit — BIR MARTA ko'rsatiladi (bazada faqat hash bor)
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/keys");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yuklab bo'lmadi");
      setKeys(data.keys);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    setCreating(true);
    setError("");
    try {
      const origins = originsText
        .split(/[\n,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch("/api/keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, kind, origins }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yaratib bo'lmadi");
      setFresh(data.token);
      setCopied(false);
      setName("");
      setOriginsText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setCreating(false);
    }
  }

  async function revoke(id: string) {
    if (!confirm(t("cabinet.apiKeys.confirmRevoke") as string)) return;
    try {
      const res = await fetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "O'chirib bo'lmadi");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    }
  }

  async function copyFresh() {
    if (!fresh) return;
    await navigator.clipboard.writeText(fresh);
    setCopied(true);
  }

  const snippet = fresh?.startsWith("pk_live_")
    ? `<script src="${typeof window !== "undefined" ? window.location.origin : ""}/widget.js" data-key="${fresh}"></script>`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold">
          <KeyRound className="h-6 w-6 text-accent" />
          {t("cabinet.apiKeys.title")}
        </h1>
        <p className="mt-1 text-sm text-fg-muted">{t("cabinet.apiKeys.sub")}</p>
      </div>

      {/* Yangi kalit — bir marta ko'rsatiladigan oyna */}
      {fresh && (
        <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-4">
          <div className="flex items-start gap-2 text-sm font-medium">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
            <span>{t("cabinet.apiKeys.onceWarning")}</span>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 overflow-x-auto rounded-lg border border-border bg-bg-subtle px-3 py-2 font-mono text-xs">
              {fresh}
            </code>
            <button
              onClick={copyFresh}
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-sm hover:bg-bg-muted"
            >
              {copied ? <Check className="h-4 w-4 text-success" /> : <Copy className="h-4 w-4" />}
              {t(copied ? "cabinet.apiKeys.copied" : "cabinet.apiKeys.copy")}
            </button>
          </div>
          {snippet && (
            <div>
              <p className="mb-1 text-xs text-fg-muted">{t("cabinet.apiKeys.snippetHint")}</p>
              <code className="block overflow-x-auto rounded-lg border border-border bg-bg-subtle px-3 py-2 font-mono text-xs">
                {snippet}
              </code>
            </div>
          )}
          <button
            onClick={() => setFresh(null)}
            className="text-xs text-fg-muted underline hover:text-fg"
          >
            {t("cabinet.apiKeys.hide")}
          </button>
        </div>
      )}

      {/* Yaratish formasi */}
      <div className="space-y-4 rounded-2xl border border-border bg-bg-subtle/60 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-sm">{t("cabinet.apiKeys.nameLabel")}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("cabinet.apiKeys.namePlaceholder") as string}
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
            />
          </label>
          <div>
            <span className="mb-1 block text-sm">{t("cabinet.apiKeys.kindLabel")}</span>
            <div className="grid grid-cols-2 gap-2">
              {(["secret", "publishable"] as const).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={cn(
                    "rounded-xl border px-3 py-2 text-left text-xs transition-colors",
                    kind === k
                      ? "border-accent/50 bg-accent/10"
                      : "border-border hover:bg-bg-muted"
                  )}
                >
                  <div className="font-mono font-medium">
                    {k === "secret" ? "sk_live_…" : "pk_live_…"}
                  </div>
                  <div className="mt-0.5 text-fg-muted">
                    {t(`cabinet.apiKeys.kind.${k}`)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Domen — faqat ommaviy kalit uchun; usiz u ishlamaydi */}
        {kind === "publishable" && (
          <label className="block">
            <span className="mb-1 flex items-center gap-1.5 text-sm">
              <Globe className="h-3.5 w-3.5" />
              {t("cabinet.apiKeys.originsLabel")}
            </span>
            <textarea
              value={originsText}
              onChange={(e) => setOriginsText(e.target.value)}
              rows={2}
              placeholder="https://lms.uz&#10;https://mahorat.uz"
              className="w-full rounded-xl border border-border bg-bg px-3 py-2 font-mono text-xs outline-none focus:border-accent"
            />
            <span className="mt-1 block text-xs text-fg-muted">
              {t("cabinet.apiKeys.originsHint")}
            </span>
          </label>
        )}

        <button
          onClick={create}
          disabled={creating || !name.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          {t(creating ? "cabinet.apiKeys.creating" : "cabinet.apiKeys.create")}
        </button>
      </div>

      {error && (
        <div className="whitespace-pre-line rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Ro'yxat */}
      <div className="space-y-2">
        {loading ? (
          <p className="text-sm text-fg-muted">{t("cabinet.apiKeys.loading")}</p>
        ) : keys.length === 0 ? (
          <p className="rounded-xl border border-border bg-bg-subtle/60 p-4 text-sm text-fg-muted">
            {t("cabinet.apiKeys.empty")}
          </p>
        ) : (
          keys.map((k) => (
            <div
              key={k.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-bg-subtle/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{k.name}</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      k.kind === "secret"
                        ? "bg-danger/10 text-danger"
                        : "bg-success/10 text-success"
                    )}
                  >
                    {t(`cabinet.apiKeys.kind.${k.kind}`)}
                  </span>
                </div>
                <code className="font-mono text-xs text-fg-muted">{k.prefix}…</code>
                {k.origins.length > 0 && (
                  <div className="mt-0.5 truncate text-xs text-fg-muted">
                    {k.origins.join(", ")}
                  </div>
                )}
              </div>
              <button
                onClick={() => revoke(k.id)}
                aria-label={t("cabinet.apiKeys.revoke") as string}
                className="rounded-lg p-2 text-fg-muted hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
