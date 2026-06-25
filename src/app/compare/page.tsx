"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshCw,
  Loader2,
  Music,
  CheckCircle2,
  XCircle,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { SentencePicker } from "@/components/compare/sentence-picker";
import { SampleComparison } from "@/components/compare/sample-comparison";

interface SentenceMeta {
  id: string;
  category: string;
  text: string;
  focus: string;
}

interface SampleItem {
  sentence_id: string;
  url: string;
  size_kb: number;
}

interface CheckpointSamples {
  id: string;
  generated_at: string | null;
  checkpoint_path: string | null;
  samples: SampleItem[];
}

interface SamplesResponse {
  checkpoints: CheckpointSamples[];
  sentences: SentenceMeta[];
}

interface BackendHealth {
  available: boolean;
  model_loaded?: boolean;
}

export default function ComparePage() {
  const [data, setData] = useState<SamplesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<BackendHealth | null>(null);
  const [selectedSentence, setSelectedSentence] = useState<string | null>(null);
  const [hiddenCheckpoints, setHiddenCheckpoints] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const [samplesRes, healthRes] = await Promise.all([
        fetch("/api/samples"),
        fetch("/api/tts"),
      ]);
      if (samplesRes.ok) {
        const d = await samplesRes.json();
        setData(d);
        if (!selectedSentence && d.sentences?.length > 0) {
          setSelectedSentence(d.sentences[0].id);
        }
      } else {
        setData({ checkpoints: [], sentences: [] });
      }
      if (healthRes.ok) setHealth(await healthRes.json());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setLoading(false);
    }
  }, [selectedSentence]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 30_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const sentenceById = useMemo(() => {
    const m = new Map<string, SentenceMeta>();
    data?.sentences?.forEach((s) => m.set(s.id, s));
    return m;
  }, [data]);

  const visibleCheckpoints = useMemo(
    () => data?.checkpoints?.filter((c) => !hiddenCheckpoints.has(c.id)) ?? [],
    [data, hiddenCheckpoints]
  );

  function toggleCheckpoint(id: string) {
    setHiddenCheckpoints((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const selectedMeta = selectedSentence ? sentenceById.get(selectedSentence) : null;

  return (
    <main className="mx-auto max-w-7xl px-4 md:px-6 py-6 space-y-6">
      <div
        className={cn(
          "flex items-center gap-2 rounded-md p-2.5 text-xs",
          health?.available
            ? "bg-success/10 text-success"
            : "bg-danger/10 text-danger"
        )}
      >
        {health?.available ? (
          <CheckCircle2 className="h-3.5 w-3.5" />
        ) : (
          <XCircle className="h-3.5 w-3.5" />
        )}
        <span className="flex-1">
          {health?.available
            ? "Server ulanmoqda — tayyor namunalar yuklanmoqda"
            : "Server bilan bog'lanmadi"}
        </span>
        <button onClick={refresh} className="rounded p-0.5 hover:bg-bg-muted">
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="flex items-start gap-3 rounded-lg border border-border bg-bg-subtle p-4">
        <Music className="h-5 w-5 text-accent mt-0.5" />
        <div className="flex-1 space-y-1">
          <h2 className="text-sm font-semibold">Tayyor namunalar — versiyalar A/B/C/D</h2>
          <p className="text-xs text-fg-muted">
            Bu yerda barcha fine-tuned checkpoint'lar bir xil matn bilan oldindan ovozlangan.
            Quyidagi jumla'ni tanlang — har bir versiya'ning natijasini yonma-yon eshiting va
            qaysi biri sizga eng yaqin ekanligini hal qiling.
          </p>
          <Link
            href="/voice-lab"
            className="inline-flex items-center gap-1 text-[11px] text-accent hover:underline"
          >
            <Sparkles className="h-3 w-3" />
            Yangi matn sinash — Voice Lab
          </Link>
        </div>
      </div>

      {loading && !data ? (
        <div className="flex items-center justify-center py-16 text-fg-muted">
          <Loader2 className="h-5 w-5 animate-spin mr-2" />
          Yuklanmoqda…
        </div>
      ) : error ? (
        <div className="rounded-lg bg-danger/10 p-3 text-xs text-danger">{error}</div>
      ) : !data || data.checkpoints.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-xs text-fg-muted">
          Hali tayyor namunalar yo'q.
          <br />
          <code className="text-[11px]">generate_samples.py</code> ishga tushgach,
          orchestrator har bir versiyani avtomatik ovozlaydi.
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
          {/* Sentence picker */}
          <SentencePicker
            sentences={data.sentences}
            checkpoints={data.checkpoints}
            selectedSentence={selectedSentence}
            onSelectSentence={setSelectedSentence}
            hiddenCheckpoints={hiddenCheckpoints}
            onToggleCheckpoint={toggleCheckpoint}
          />

          {/* Comparison area */}
          <SampleComparison
            selectedMeta={selectedMeta}
            visibleCheckpoints={visibleCheckpoints}
            selectedSentence={selectedSentence}
          />
        </div>
      )}
    </main>
  );
}
