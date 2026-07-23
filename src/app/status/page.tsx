"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  RefreshCw,
  Cpu,
  TrendingDown,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusCard } from "@/components/status/status-card";
import { LossCard } from "@/components/status/loss-card";
import { LogPanel } from "@/components/status/log-panel";
import { TrainingProgress } from "@/components/status/training-progress";

interface TrainingStatus {
  extract: {
    log_tail: string[];
    finished: boolean;
  };
  training: {
    running: boolean;
    epoch: number | null;
    epoch_max: number | null;
    step: number | null;
    step_max: number | null;
    global_step: number | null;
    progress_pct: number | null;
    last_loss: number | null;
    last_loss_avg: number | null;
    last_mel_ce: number | null;
    last_mel_ce_avg: number | null;
    last_eval_loss: number | null;
    last_step_time: string | null;
    log_tail: string[];
  };
  pipeline_tail: string[];
  now: string;
}

interface BackendHealth {
  available: boolean;
  model_loaded?: boolean;
  device?: string;
  gpu_name?: string;
  vram_total_gb?: number;
  vram_allocated_gb?: number;
  checkpoint_id?: string;
}

export default function StatusPage() {
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [statusRes, healthRes] = await Promise.all([
        fetch("/api/training/status"),
        fetch("/api/tts"),
      ]);
      if (!statusRes.ok) throw new Error("Status olinmadi");
      setStatus(await statusRes.json());
      if (healthRes.ok) setHealth(await healthRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    }
  }, []);

  useEffect(() => {
    refresh();
    if (!autoRefresh) return;
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh, autoRefresh]);

  const t = status?.training;

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="h-4 w-4 text-accent" />
        <h2 className="text-sm font-semibold">Training kuzatuv paneli</h2>
        <button
          onClick={() => setAutoRefresh((v) => !v)}
          className={cn(
            "ml-auto rounded-md border px-2 py-1 text-[11px] transition",
            autoRefresh
              ? "border-success/40 bg-success/10 text-success"
              : "border-border text-fg-muted hover:bg-bg-muted"
          )}
        >
          {autoRefresh ? "● Live (10s)" : "Pauza"}
        </button>
        <button
          onClick={refresh}
          className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-bg-muted transition"
        >
          <RefreshCw className="h-3 w-3" />
        </button>
      </div>

      {error && (
        <div className="rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</div>
      )}

      {/* GPU/Backend status */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
        <StatusCard
          icon={Cpu}
          label="GPU"
          value={health?.gpu_name || "—"}
          sub={
            health?.device === "cuda"
              ? `${health?.vram_allocated_gb ?? "?"}/${health?.vram_total_gb ?? "?"} GB`
              : health?.device ?? "—"
          }
        />
        <StatusCard
          icon={CheckCircle2}
          label="Server"
          value={
            health?.available
              ? health.model_loaded
                ? "Tayyor"
                : "Yuklanmoqda"
              : "Yo'q"
          }
          sub={health?.checkpoint_id || "—"}
          tone={
            health?.available && health?.model_loaded
              ? "success"
              : health?.available
              ? "warning"
              : "danger"
          }
        />
        <StatusCard
          icon={Activity}
          label="Training"
          value={t?.running ? "Ishlamoqda" : "To'xtagan"}
          sub={
            t?.step && t?.step_max
              ? `step ${t.step.toLocaleString()} / ${t.step_max.toLocaleString()}`
              : "—"
          }
          tone={t?.running ? "success" : undefined}
        />
        <StatusCard
          icon={TrendingDown}
          label="Loss (mel_ce avg)"
          value={t?.last_mel_ce_avg?.toFixed(3) ?? "—"}
          sub={
            t?.last_eval_loss
              ? `eval ${t.last_eval_loss.toFixed(3)}`
              : t?.last_mel_ce
              ? `instant ${t.last_mel_ce.toFixed(3)}`
              : "—"
          }
        />
      </div>

      {/* Progress bar */}
      {t?.progress_pct !== null && t?.progress_pct !== undefined && (
        <TrainingProgress t={t} />
      )}

      {/* Loss qatorlari */}
      <div className="grid gap-3 md:grid-cols-3">
        <LossCard
          label="loss_mel_ce (instant)"
          value={t?.last_mel_ce}
          hint="Eng so'nggi batch loss"
        />
        <LossCard
          label="loss_mel_ce (running avg)"
          value={t?.last_mel_ce_avg}
          hint="Train running average"
        />
        <LossCard
          label="eval avg_loss_mel_ce"
          value={t?.last_eval_loss}
          hint="Eval split (v3 = 3.16)"
          highlight
        />
      </div>

      {/* Log tail */}
      <div className="grid gap-4 md:grid-cols-2">
        <LogPanel title="Training log (oxirgi 25 qator)" lines={t?.log_tail ?? []} />
        <LogPanel
          title="Pipeline log"
          lines={status?.pipeline_tail ?? []}
          empty="Pipeline log mavjud emas"
        />
      </div>

      {status?.extract?.log_tail && status.extract.log_tail.length > 0 && (
        <LogPanel
          title={`Ekstraktsiya log${status.extract.finished ? " · TUGADI" : ""}`}
          lines={status.extract.log_tail}
        />
      )}

      <div className="text-[10px] text-fg-subtle">
        Server vaqti: {status?.now} · Frontend har 10 sekundda yangilanadi
      </div>
    </main>
  );
}
