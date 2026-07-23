"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clapperboard,
  Download,
  FileVideo,
  Link2,
  Loader2,
  Play,
  X,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

// Video dublyaj sahifasi — ingliz video -> o'zbekcha voiceover.
// Og'ir ish serverda alohida python jarayonida ketadi; bu sahifa jobni boshlaydi
// va holatini so'rab turadi (poll). Sintez sahifasidan ATAYLAB alohida: oqim ham,
// kutish vaqti ham butunlay boshqacha.

type Stage = "queued" | "audio" | "asr" | "translate" | "tts" | "mux" | "done" | "error";

interface Job {
  id: string;
  stage: Stage;
  segmentsDone: number;
  segmentsTotal: number;
  durationSec: number;
  error: string | null;
  sourceName: string;
}

interface Segment {
  start: number;
  end: number;
  en: string;
  uz: string;
}

/** Bosqichlar tartibi — progress chizig'i va "bajarildi" belgisi uchun. */
const STAGES: Stage[] = ["audio", "asr", "translate", "tts", "mux"];

const POLL_MS = 1500;

export default function DublyajPage() {
  const { t } = useI18n();

  const [mode, setMode] = useState<"file" | "url">("file");
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState("");
  const [translator, setTranslator] = useState<"nllb" | "claude">("nllb");
  const [duck, setDuck] = useState(0.18);

  const [job, setJob] = useState<Job | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [segments, setSegments] = useState<Segment[] | null>(null);
  const [showText, setShowText] = useState(false);

  const fileInput = useRef<HTMLInputElement>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const running = job !== null && job.stage !== "done" && job.stage !== "error";

  // ── Holatni so'rab turish ──
  const poll = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/dub?id=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Xato");
      const j: Job = data.job;
      setJob(j);
      if (j.stage !== "done" && j.stage !== "error") {
        pollRef.current = setTimeout(() => void poll(id), POLL_MS);
      } else if (j.stage === "error") {
        setError(j.error);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    }
  }, []);

  // Sahifadan chiqishda pollni to'xtatamiz (job serverda davom etadi).
  useEffect(() => {
    return () => {
      if (pollRef.current) clearTimeout(pollRef.current);
    };
  }, []);

  // Sahifa ochilganda: server tomonda ishlayotgan job bo'lsa unga ulanamiz
  // (foydalanuvchi yangilagan/qaytib kelgan bo'lishi mumkin).
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dub");
        if (!res.ok) return;
        const data = await res.json();
        const active = (data.jobs as Job[] | undefined)?.find(
          (j) => j.stage !== "done" && j.stage !== "error"
        );
        if (active) {
          setJob(active);
          void poll(active.id);
        }
      } catch {
        // sahifa baribir ishlayveradi
      }
    })();
  }, [poll]);

  async function start() {
    setError(null);
    setSegments(null);
    setShowText(false);
    setStarting(true);
    try {
      const form = new FormData();
      if (mode === "file") {
        if (!file) throw new Error(t("cabinet.dublyaj.pickFile"));
        form.append("file", file);
      } else {
        if (!url.trim()) throw new Error(t("cabinet.dublyaj.urlPlaceholder"));
        form.append("url", url.trim());
      }
      form.append("translator", translator);
      form.append("duck", String(duck));

      const res = await fetch("/api/dub", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || `Xato (${res.status})`);
      setJob(data.job);
      void poll(data.job.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Xato");
    } finally {
      setStarting(false);
    }
  }

  async function cancel() {
    if (!job) return;
    if (pollRef.current) clearTimeout(pollRef.current);
    await fetch(`/api/dub?id=${encodeURIComponent(job.id)}`, { method: "DELETE" }).catch(
      () => undefined
    );
    setJob(null);
  }

  async function loadSegments() {
    if (!job || segments) {
      setShowText((v) => !v);
      return;
    }
    try {
      const res = await fetch(`/api/dub/${job.id}/segments`);
      const data = await res.json();
      if (res.ok) setSegments(data.segments);
      setShowText(true);
    } catch {
      setShowText(true);
    }
  }

  function reset() {
    setJob(null);
    setSegments(null);
    setShowText(false);
    setError(null);
    setFile(null);
    setUrl("");
  }

  const stageIndex = job ? STAGES.indexOf(job.stage) : -1;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      {/* Sarlavha */}
      <div className="space-y-1.5">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-fg">
          <Clapperboard className="size-6 text-accent" />
          {t("cabinet.dublyaj.title")}
        </h1>
        <p className="text-sm text-fg-muted">{t("cabinet.dublyaj.sub")}</p>
      </div>

      {/* Kutilmani to'g'ri qo'yamiz: bu lab-sinxron dublyaj EMAS */}
      <p className="rounded-xl border border-border bg-bg-subtle p-3 text-xs leading-relaxed text-fg-muted">
        {t("cabinet.dublyaj.note")}
      </p>

      {/* ── Kirish forma (job yo'q paytda) ── */}
      {!job && (
        <div className="space-y-5 rounded-2xl border border-border bg-bg-subtle p-5">
          {/* Manba turi */}
          <div className="flex gap-2">
            {(
              [
                ["file", FileVideo, "sourceFile"],
                ["url", Link2, "sourceUrl"],
              ] as const
            ).map(([m, Icon, key]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition",
                  mode === m
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border text-fg-muted hover:bg-bg-muted"
                )}
              >
                <Icon className="size-4" />
                {t(`cabinet.dublyaj.${key}`)}
              </button>
            ))}
          </div>

          {/* Manba */}
          {mode === "file" ? (
            <div>
              <input
                ref={fileInput}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-6 text-sm text-fg-muted transition hover:border-accent hover:text-accent"
              >
                <FileVideo className="size-4" />
                {file ? file.name : t("cabinet.dublyaj.pickFile")}
              </button>
            </div>
          ) : (
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("cabinet.dublyaj.urlPlaceholder")}
              className="w-full rounded-xl border border-border bg-bg px-3.5 py-2.5 text-sm text-fg outline-none transition focus:border-accent"
            />
          )}

          {/* Tarjimon */}
          <div className="space-y-2">
            <div className="text-xs font-medium text-fg-muted">
              {t("cabinet.dublyaj.translator")}
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["nllb", "translatorNllb", "translatorNllbHint"],
                  ["claude", "translatorClaude", "translatorClaudeHint"],
                ] as const
              ).map(([id, label, hint]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTranslator(id)}
                  className={cn(
                    "rounded-xl border px-3.5 py-3 text-left transition",
                    translator === id
                      ? "border-accent bg-accent/10"
                      : "border-border hover:bg-bg-muted"
                  )}
                >
                  <div
                    className={cn(
                      "text-sm font-medium",
                      translator === id ? "text-accent" : "text-fg"
                    )}
                  >
                    {t(`cabinet.dublyaj.${label}`)}
                  </div>
                  <div className="mt-0.5 text-xs text-fg-subtle">
                    {t(`cabinet.dublyaj.${hint}`)}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Original ovoz balandligi */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-medium text-fg-muted">
              <span>{t("cabinet.dublyaj.duck")}</span>
              <span className="tabular-nums text-fg">{Math.round(duck * 100)}%</span>
            </div>
            <input
              type="range"
              min={0}
              max={0.6}
              step={0.02}
              value={duck}
              onChange={(e) => setDuck(Number(e.target.value))}
              className="w-full accent-accent"
            />
            <div className="text-xs text-fg-subtle">{t("cabinet.dublyaj.duckHint")}</div>
          </div>

          <button
            type="button"
            onClick={start}
            disabled={starting || (mode === "file" ? !file : !url.trim())}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-base font-semibold text-accent-fg transition hover:opacity-90 disabled:opacity-50"
          >
            {starting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Play className="size-4" />
            )}
            {t("cabinet.dublyaj.start")}
          </button>
        </div>
      )}

      {/* ── Progress ── */}
      {job && running && (
        <div className="space-y-4 rounded-2xl border border-border bg-bg-subtle p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <Loader2 className="size-4 shrink-0 animate-spin text-accent" />
              <span className="truncate text-sm font-medium text-fg">
                {t(`cabinet.dublyaj.stages.${job.stage}`)}
              </span>
            </div>
            <button
              type="button"
              onClick={cancel}
              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-fg-muted transition hover:border-danger hover:text-danger"
            >
              <X className="size-3.5" />
              {t("cabinet.dublyaj.cancel")}
            </button>
          </div>

          {/* Bosqichlar */}
          <div className="flex gap-1">
            {STAGES.map((s, i) => (
              <div
                key={s}
                className={cn(
                  "h-1 flex-1 rounded-full transition",
                  stageIndex > i
                    ? "bg-accent"
                    : stageIndex === i
                      ? "bg-accent/40"
                      : "bg-border"
                )}
              />
            ))}
          </div>

          {/* TTS bosqichida segment progressi — eng uzun bosqich, jim qolmasin */}
          {job.stage === "tts" && job.segmentsTotal > 0 && (
            <div className="text-xs tabular-nums text-fg-muted">
              {t("cabinet.dublyaj.segmentProgress", {
                done: String(job.segmentsDone),
                total: String(job.segmentsTotal),
              })}
            </div>
          )}
          {job.segmentsTotal > 0 && job.durationSec > 0 && job.stage !== "tts" && (
            <div className="text-xs text-fg-subtle">
              {t("cabinet.dublyaj.videoInfo", {
                segments: String(job.segmentsTotal),
                duration: String(Math.round(job.durationSec)),
              })}
            </div>
          )}

          <p className="text-xs text-fg-subtle">{t("cabinet.dublyaj.longHint")}</p>
        </div>
      )}

      {/* ── Natija ── */}
      {job?.stage === "done" && (
        <div className="space-y-4 rounded-2xl border border-border bg-bg-subtle p-5">
          <div className="text-sm font-medium text-fg">
            {t("cabinet.dublyaj.resultTitle")}
          </div>

          <video
            src={`/api/dub/${job.id}/video`}
            controls
            className="w-full rounded-xl border border-border bg-black"
          />

          <div className="flex flex-wrap gap-2">
            <a
              href={`/api/dub/${job.id}/video`}
              download={`dub_${job.sourceName || "video"}.mp4`}
              className="flex items-center gap-2 rounded-xl bg-accent px-3.5 py-2.5 text-sm font-semibold text-accent-fg transition hover:opacity-90"
            >
              <Download className="size-4" />
              {t("cabinet.dublyaj.download")}
            </a>
            <button
              type="button"
              onClick={loadSegments}
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm text-fg-muted transition hover:bg-bg-muted"
            >
              {showText ? t("cabinet.dublyaj.hideText") : t("cabinet.dublyaj.showText")}
            </button>
            <button
              type="button"
              onClick={reset}
              className="rounded-xl border border-border px-3.5 py-2.5 text-sm text-fg-muted transition hover:bg-bg-muted"
            >
              {t("cabinet.dublyaj.newDub")}
            </button>
          </div>

          {/* Tarjima matni — sifatni ko'z bilan tekshirish uchun */}
          {showText && segments && (
            <div className="max-h-80 space-y-2.5 overflow-y-auto rounded-xl border border-border bg-bg-muted p-3">
              {segments.map((s, i) => (
                <div key={i} className="space-y-0.5 text-xs">
                  <div className="tabular-nums text-fg-subtle">{s.start.toFixed(1)}s</div>
                  <div className="text-fg-muted">{s.en}</div>
                  <div className="text-fg">{s.uz}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Xato */}
      {error && (
        <div className="space-y-3 rounded-xl border border-danger/30 bg-danger/10 p-3">
          <div className="whitespace-pre-line text-sm text-danger">{error}</div>
          {job?.stage === "error" && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-fg-muted transition hover:bg-bg-muted"
            >
              {t("cabinet.dublyaj.newDub")}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
