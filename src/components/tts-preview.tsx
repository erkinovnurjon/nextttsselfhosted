"use client";

import {
  Sparkles,
  Volume2,
  Info,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Download,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface BackendHealth {
  available: boolean;
  model_loaded?: boolean;
  device?: string;
  gpu_name?: string;
  vram_total_gb?: number;
  vram_allocated_gb?: number;
  model_load_time_sec?: number;
  error?: string;
}

export function TtsPreview() {
  const [text, setText] = useState(
    "Salom, mening ismim Ahmad va men dasturchi. O'zbekiston Markaziy Osiyoda joylashgan."
  );
  const [speed, setSpeed] = useState(1.0);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [synthTime, setSynthTime] = useState<number | null>(null);
  const [normalizedText, setNormalizedText] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/tts");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ available: false, error: "Tekshirib bo'lmadi" });
    }
  }, []);

  useEffect(() => {
    checkHealth();
    const interval = setInterval(checkHealth, 10_000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  useEffect(() => {
    return () => {
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
  }, [audioUrl]);

  async function synthesize() {
    if (!text.trim()) return;
    setLoading(true);
    setError(null);
    setSynthTime(null);
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "main", speed }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error + (errData.hint ? `\n\n${errData.hint}` : "")
        );
      }
      const synthSec = res.headers.get("X-Synthesis-Time-Sec");
      if (synthSec) setSynthTime(parseFloat(synthSec));
      const normHeader = res.headers.get("X-Normalized-Text");
      if (normHeader) {
        try {
          setNormalizedText(decodeURIComponent(normHeader));
        } catch {
          setNormalizedText(normHeader);
        }
      } else {
        setNormalizedText(null);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setTimeout(() => audioRef.current?.play().catch(() => undefined), 50);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setLoading(false);
    }
  }

  const backendReady = health?.available && health?.model_loaded;

  return (
    <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-3">
      <div className="flex items-start gap-2">
        <Sparkles className="h-4 w-4 text-accent mt-0.5" />
        <div>
          <h2 className="text-sm font-semibold">Mening Ovozim — TTS Sinov</h2>
          <p className="text-xs text-fg-muted">
            Matn kiriting va sizning ovozingiz bilan eshitiling
          </p>
        </div>
      </div>

      <div
        className={cn(
          "flex items-center gap-2 rounded-md p-2 text-xs",
          backendReady
            ? "bg-success/10 text-success"
            : health?.available
            ? "bg-warning/10 text-warning"
            : "bg-danger/10 text-danger"
        )}
      >
        {backendReady ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : health?.available ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        <span className="flex-1">
          {backendReady
            ? `Server tayyor — ${health.device?.toUpperCase()}${
                health.gpu_name ? ` (${health.gpu_name})` : ""
              }${
                health.vram_allocated_gb
                  ? `, ${health.vram_allocated_gb} GB VRAM`
                  : ""
              }`
            : health?.available
            ? "Server javob bermoqda, lekin model hali yuklanmagan…"
            : `TTS backend ulanmadi — Python serverni ishga tushiring (.\\scripts\\start-tts-server.ps1)`}
        </span>
        <button
          onClick={checkHealth}
          title="Qayta tekshirish"
          className="rounded p-0.5 hover:bg-bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        placeholder="Sintez qilish uchun matnni kiriting…"
        className="w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            synthesize();
          }
        }}
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-xs text-fg-muted">
          Tezlik:
          <input
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={speed}
            onChange={(e) => setSpeed(parseFloat(e.target.value))}
            className="w-32 accent-accent"
          />
          <span className="font-mono w-8">{speed.toFixed(1)}x</span>
        </label>

        <button
          onClick={synthesize}
          disabled={loading || !text.trim() || !backendReady}
          className={cn(
            "flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition ml-auto",
            (loading || !text.trim() || !backendReady) &&
              "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
          {loading ? "Sintez qilinmoqda…" : "Mening ovozim bilan ayt"}
        </button>
      </div>

      <p className="text-xs text-fg-subtle">Ctrl+Enter — tezda sintez qilish</p>

      {error && (
        <div className="rounded-md bg-danger/10 p-3 text-xs text-danger whitespace-pre-wrap">
          {error}
        </div>
      )}

      {audioUrl && (
        <div className="space-y-2">
          <audio ref={audioRef} src={audioUrl} controls className="w-full" />
          {normalizedText && normalizedText !== text && (
            <details className="text-xs text-fg-muted">
              <summary className="cursor-pointer hover:text-fg">
                Modelga yuborilgan matn (avtomatik normalizatsiya)
              </summary>
              <div className="mt-1 rounded-md bg-bg-muted p-2 font-mono text-fg">
                {normalizedText}
              </div>
            </details>
          )}
          <div className="flex items-center justify-between text-xs text-fg-muted">
            {synthTime !== null && (
              <span>Sintez vaqti: {synthTime.toFixed(2)}s</span>
            )}
            <a
              href={audioUrl}
              download={`synth_${Date.now()}.wav`}
              className="flex items-center gap-1 hover:text-fg transition"
            >
              <Download className="h-3 w-3" />
              Yuklab olish
            </a>
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-md bg-bg-muted p-2 text-xs text-fg-muted">
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>
          Hozirgi versiya prototip — q, x, oʻ, gʻ harflari biroz buzilgan
          eshitilishi mumkin. Yakuniy sifat fine-tuning'dan keyin keladi.
        </span>
      </div>
    </div>
  );
}
