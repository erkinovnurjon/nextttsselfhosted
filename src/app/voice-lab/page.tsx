"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Volume2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { synthesize as synthesizeTts } from "@/lib/tts-client";
import { ParamSlider } from "@/components/synthesis/param-slider";
import {
  CheckpointSidebar,
  type Checkpoint,
} from "@/components/synthesis/checkpoint-sidebar";
import {
  VoiceLabResultCard,
  type SynthResult,
} from "@/components/synthesis/voice-lab-result-card";

interface CheckpointsResponse {
  active: string | null;
  items: Checkpoint[];
}

interface BackendHealth {
  available: boolean;
  model_loaded?: boolean;
  device?: string;
  gpu_name?: string;
  vram_total_gb?: number;
  vram_allocated_gb?: number;
  checkpoint_id?: string;
  error?: string;
}

const TEST_PRESETS = [
  { label: "x · gʻ · oʻ aralash", text: "Oʻzbekiston xalqi qishloq xoʻjaligida gʻalla yetishtiradi" },
  { label: "x test", text: "Xato qildim, lekin xulosalar chiqardim" },
  { label: "gʻ test", text: "Bogʻimdagi gʻunchalar gʻalati ochildi" },
  { label: "q test", text: "Qaynoq qovurilgan qovun va qulupnay" },
  { label: "oʻ test", text: "Oʻgʻil oʻyinda oʻrtoqlari bilan oʻzini koʻrsatdi" },
  { label: "Toshkent", text: "Toshkent shahri qishin yozin xilma-xil va goʻzal" },
  { label: "Maqol", text: "Yaxshi qoʻshni — aziz qarindosh, deyiladi xalqimizda" },
  { label: "Texnik", text: "Aniqlik nol butun mingdan bir darajasida" },
];

// MMS — Meta'ning tug'ma o'zbek modeli. Ovoz cloning yo'q, lekin q/x/oʻ/gʻ to'g'ri.
// Backend'da alohida /synthesize/mms endpoint, parametr sliderlari unga ta'sir qilmaydi.
const MMS_CHECKPOINT: Checkpoint = {
  id: "mms",
  name: "MMS — tug'ma o'zbek (ayol ovozi, klonsiz)",
  size_gb: 0.14,
  mtime: 0,
  kind: "best",
  active: false,
};

export default function VoiceLabPage() {
  const [text, setText] = useState(TEST_PRESETS[0].text);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checkpoints, setCheckpoints] = useState<Checkpoint[]>([]);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [results, setResults] = useState<SynthResult[]>([]);
  const [loadingSynth, setLoadingSynth] = useState(false);
  const [loadingCp, setLoadingCp] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Inference parameters
  const [temperature, setTemperature] = useState(0.65);
  const [speed, setSpeed] = useState(1.0);
  const [repetitionPenalty, setRepetitionPenalty] = useState(5.0);
  const [topK, setTopK] = useState(50);
  const [topP, setTopP] = useState(0.85);

  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const refreshCheckpoints = useCallback(async () => {
    setLoadingCp(true);
    try {
      const res = await fetch("/api/checkpoints");
      if (!res.ok) throw new Error("Checkpoint'lar olinmadi");
      const data: CheckpointsResponse = await res.json();
      // MMS'ni ro'yxat tepasiga qo'shamiz — XTTS bilan yonma-yon sinash uchun
      setCheckpoints([MMS_CHECKPOINT, ...data.items]);
      if (!selectedId) {
        setSelectedId(data.active ?? data.items[0]?.id ?? MMS_CHECKPOINT.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setLoadingCp(false);
    }
  }, [selectedId]);

  const refreshHealth = useCallback(async () => {
    try {
      const res = await fetch("/api/tts");
      const data = await res.json();
      setHealth(data);
    } catch {
      setHealth({ available: false, error: "Server javob bermayapti" });
    }
  }, []);

  useEffect(() => {
    refreshCheckpoints();
    refreshHealth();
    const interval = setInterval(refreshHealth, 15_000);
    return () => clearInterval(interval);
  }, [refreshCheckpoints, refreshHealth]);

  useEffect(() => {
    // Cleanup audio object URLs on unmount
    return () => {
      results.forEach((r) => URL.revokeObjectURL(r.audioUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function synthesize() {
    if (!text.trim() || !selectedId) return;
    setLoadingSynth(true);
    setError(null);
    try {
      const {
        url,
        timeSec: synthTime,
        checkpointId: checkpointIdHeader,
        normalizedText: normalized,
      } = await synthesizeTts(
        {
          text: text.trim(),
          voice: "main",
          speed,
          temperature,
          repetition_penalty: repetitionPenalty,
          top_k: topK,
          top_p: topP,
          checkpoint_id: selectedId,
        },
        { errorFallback: (status) => `Server xatosi (${status})` }
      );
      const checkpointId = checkpointIdHeader || selectedId;
      let normText: string | null = null;
      if (normalized) {
        try {
          normText = decodeURIComponent(normalized);
        } catch {
          normText = normalized;
        }
      }
      const result: SynthResult = {
        id: crypto.randomUUID(),
        text: text.trim(),
        normalizedText: normText,
        audioUrl: url,
        checkpointId,
        synthTime,
        params: {
          temperature,
          speed,
          repetition_penalty: repetitionPenalty,
          top_k: topK,
          top_p: topP,
        },
        createdAt: Date.now(),
      };
      setResults((prev) => [result, ...prev]);
      // Auto-play
      setTimeout(() => audioRefs.current[result.id]?.play().catch(() => undefined), 100);
      // Server holatini yangilash (yangi modelning yuklangani ko'rinadi)
      refreshHealth();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setLoadingSynth(false);
    }
  }

  function removeResult(id: string) {
    setResults((prev) => {
      const removed = prev.find((r) => r.id === id);
      if (removed) URL.revokeObjectURL(removed.audioUrl);
      return prev.filter((r) => r.id !== id);
    });
  }

  function clearResults() {
    results.forEach((r) => URL.revokeObjectURL(r.audioUrl));
    setResults([]);
  }

  const backendReady = health?.available && health?.model_loaded;
  const selectedCheckpoint = checkpoints.find((c) => c.id === selectedId);

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-6">
      {/* Backend status banner */}
      <div
        className={cn(
          "flex items-center gap-2 rounded-md p-2.5 text-xs",
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
                health.gpu_name ? ` · ${health.gpu_name}` : ""
              }${
                health.vram_allocated_gb
                  ? ` · ${health.vram_allocated_gb}/${health.vram_total_gb} GB VRAM`
                  : ""
              }${health.checkpoint_id ? ` · faol: ${health.checkpoint_id}` : ""}`
            : health?.available
            ? "Server javob bermoqda, lekin model hali yuklanmagan…"
            : "TTS backend ulanmadi. Python serverni ishga tushiring: cd tts-server; uvicorn server.main:app --port 8000"}
        </span>
        <button
          onClick={refreshHealth}
          className="rounded p-0.5 hover:bg-bg-muted"
          title="Qayta tekshirish"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
        {/* Checkpoint tanlash sidebar */}
        <CheckpointSidebar
          checkpoints={checkpoints}
          selectedId={selectedId}
          selectedCheckpoint={selectedCheckpoint}
          loadingCp={loadingCp}
          onSelect={setSelectedId}
          onRefresh={refreshCheckpoints}
        />

        {/* Asosiy ish maydoni */}
        <div className="space-y-4 min-w-0">
          <div className="rounded-lg border border-border bg-bg-subtle p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-accent mt-0.5" />
              <div>
                <h2 className="text-sm font-semibold">Sinov matni</h2>
                <p className="text-xs text-fg-muted">
                  Quyidagi presetlardan birini tanlang yoki o'z matningizni yozing
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {TEST_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setText(p.text)}
                  className={cn(
                    "rounded-full border px-2.5 py-0.5 text-[11px] transition",
                    text === p.text
                      ? "border-accent bg-accent/15 text-accent"
                      : "border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={3}
              placeholder="Sintez qilish uchun matn…"
              className="w-full resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) synthesize();
              }}
            />

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <ParamSlider
                label="Temperature"
                value={temperature}
                onChange={setTemperature}
                min={0.1}
                max={1.5}
                step={0.05}
                hint="past = aniq"
              />
              <ParamSlider
                label="Speed"
                value={speed}
                onChange={setSpeed}
                min={0.5}
                max={2}
                step={0.1}
                hint="ovoz tezligi"
              />
              <ParamSlider
                label="Rep. penalty"
                value={repetitionPenalty}
                onChange={setRepetitionPenalty}
                min={1}
                max={20}
                step={0.5}
                hint="takror oldini olish"
              />
              <ParamSlider
                label="Top-K"
                value={topK}
                onChange={(v) => setTopK(Math.round(v))}
                min={1}
                max={200}
                step={1}
                hint="diversitet"
              />
              <ParamSlider
                label="Top-P"
                value={topP}
                onChange={setTopP}
                min={0.1}
                max={1}
                step={0.05}
                hint="nucleus"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                onClick={synthesize}
                disabled={loadingSynth || !text.trim() || !backendReady || !selectedId}
                className={cn(
                  "flex items-center gap-1.5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition",
                  (loadingSynth || !text.trim() || !backendReady || !selectedId) &&
                    "opacity-50 cursor-not-allowed"
                )}
              >
                {loadingSynth ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
                {loadingSynth ? "Sintez qilinmoqda…" : `Sintez qil${selectedCheckpoint ? ` (${selectedCheckpoint.id})` : ""}`}
              </button>
              <span className="text-[11px] text-fg-subtle">Ctrl+Enter — tezda sintez</span>
              {results.length > 0 && (
                <button
                  onClick={clearResults}
                  className="ml-auto flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-muted transition"
                >
                  <Trash2 className="h-3 w-3" />
                  Tarixni tozalash
                </button>
              )}
            </div>

            {error && (
              <div className="rounded-md bg-danger/10 p-3 text-xs text-danger whitespace-pre-wrap">
                {error}
              </div>
            )}
          </div>

          {/* Audio history */}
          <div className="space-y-3">
            <h3 className="text-xs font-semibold flex items-center gap-2 text-fg-muted">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Tarix · {results.length} sintez
            </h3>
            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-fg-muted">
                Hali hech qanday sintez qilinmagan.<br />
                Matn kiritib, versiya tanlang va "Sintez qil" tugmasini bosing.
              </div>
            ) : (
              <div className="space-y-2">
                {results.map((r) => (
                  <VoiceLabResultCard
                    key={r.id}
                    result={r}
                    onDelete={() => removeResult(r.id)}
                    audioRef={(el) => (audioRefs.current[r.id] = el)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
