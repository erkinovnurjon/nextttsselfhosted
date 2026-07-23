"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Loader2,
  Mic,
  Square,
  Trash2,
  Play,
  Fingerprint,
  Sparkles,
  AudioLines,
  Link2,
  Upload,
  Wand2,
  AlertTriangle,
  CheckCircle2,
  ImagePlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { blobToWav } from "@/lib/wav-encoder";
import { synthesize } from "@/lib/tts-client";
import { REFERENCE_SENTENCES, MIN_REF_SECONDS } from "@/lib/voice-sentences";

type VoiceItem = {
  id: string;
  name: string;
  hasImage: boolean;
  status: string;
  durationSec: number | null;
  createdAt: string;
  updatedAt: string;
};

const MAX_SOURCES = 4;
const MAX_VOICES = 8;
const NAME_MAX = 40;

export default function MyVoicePage() {
  const [voices, setVoices] = useState<VoiceItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testUrl, setTestUrl] = useState<string | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);

  // ── Yangi ovoz: nom (majburiy) + rasm (ixtiyoriy) — ikkala usulga umumiy ──
  const [voiceName, setVoiceName] = useState("");
  const [voiceImage, setVoiceImage] = useState<File | null>(null);

  // ── Video/qo'shiqdan klonlash (bir xil odamning 1-4 manbasi) ──
  const [cloneUrls, setCloneUrls] = useState<string[]>([""]);
  const [cloneFiles, setCloneFiles] = useState<File[]>([]);
  const [cloning, setCloning] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [cloneInfo, setCloneInfo] = useState<string | null>(null);

  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef<number>(0);

  async function refreshVoices() {
    try {
      const r = await fetch("/api/voice");
      const d = await r.json();
      setVoices(Array.isArray(d.voices) ? d.voices : []);
    } catch {
      /* ignore */
    }
  }

  useEffect(() => {
    refreshVoices().finally(() => setLoaded(true));
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const nameOk = voiceName.trim().length > 0;
  const atLimit = voices.length >= MAX_VOICES;

  function clearNewVoiceForm() {
    setVoiceName("");
    setVoiceImage(null);
    setCloneUrls([""]);
    setCloneFiles([]);
  }

  // ── Ovoz yozdirish ──
  async function start() {
    if (recording || saving) return;
    if (!nameOk) {
      setError("Avval ovozga nom kiriting (masalan: \"Mening ovozim\").");
      return;
    }
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const rec = new MediaRecorder(stream);
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = handleStop;
      recRef.current = rec;
      rec.start();
      startedRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(
        () => setElapsed((Date.now() - startedRef.current) / 1000),
        200
      );
      setRecording(true);
    } catch {
      setError("Mikrofonga ruxsat berilmadi.");
    }
  }

  function stop() {
    if (recRef.current && recording) {
      recRef.current.stop();
      setRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  }

  async function handleStop() {
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 3000) {
      setError("Yozuv juda qisqa. Qaytadan urinib ko'ring.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const { wav, duration } = await blobToWav(blob, 24000);
      const fd = new FormData();
      fd.append("audio", wav, "reference.wav");
      fd.append("text", REFERENCE_SENTENCES.join(" "));
      fd.append("duration", String(duration));
      fd.append("name", voiceName.trim());
      if (voiceImage) fd.append("image", voiceImage, voiceImage.name);
      const res = await fetch("/api/voice", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Saqlashda xato");
      await refreshVoices();
      setCloneInfo(
        `"${data.voice?.name}" tayyor — yuqorida sinab ko'rib, modellar safiga qo'shing.`
      );
      clearNewVoiceForm();
      setTestUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setSaving(false);
    }
  }

  // ── Sinash: konkret ovoz bilan qisqa sintez ──
  async function test(v: VoiceItem) {
    setTestingId(v.id);
    setTestUrl(null);
    setError(null);
    try {
      const { url } = await synthesize(
        {
          // Model nomi matnga qo'shilmaydi: chet so'zlar (Ronaldo, don carleone...)
          // sintezda g'ovlaydi va sinov taassurotini buzadi.
          text: "Salom! Bu sinov gapi. Endi istalgan matnni men shu ovozda o'qib beraman.",
          checkpoint_id: "f5",
          voice: "__me__",
          user_voice_id: v.id,
          // 1.0 = manba (video) tezligi — ovoz uslubi o'zgartirilmaydi
          speed: 1.0,
        },
        { errorFallback: () => "Sintez xatosi" }
      );
      setTestUrl(url);
      window.dispatchEvent(new Event("nexttts:credits-changed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setTestingId(null);
    }
  }

  // ── Klonlash ──
  const validCloneUrls = cloneUrls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  const sourceCount = cloneFiles.length + validCloneUrls.length;

  async function cloneFromMedia() {
    if (cloning) return;
    if (!nameOk) {
      setError("Avval ovozga nom kiriting (masalan: \"Ronaldo\").");
      return;
    }
    if (sourceCount === 0) {
      setError("Video/audio URL kiriting yoki fayl tanlang.");
      return;
    }
    if (sourceCount > MAX_SOURCES) {
      setError(`Ko'pi bilan ${MAX_SOURCES} ta manba yuboring.`);
      return;
    }
    setCloning(true);
    setError(null);
    setWarning(null);
    setCloneInfo(null);
    setTestUrl(null);
    try {
      const fd = new FormData();
      fd.append("name", voiceName.trim());
      if (voiceImage) fd.append("image", voiceImage, voiceImage.name);
      for (const f of cloneFiles) fd.append("file", f, f.name);
      fd.append("urls", JSON.stringify(validCloneUrls));
      const res = await fetch("/api/clone", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Klonlashda xato");
      await refreshVoices();
      setWarning(data.warning ?? null);
      if (sourceCount > 1 && typeof data.meta?.winner_index === "number") {
        setCloneInfo(
          `"${data.voice?.name}" tayyor (${data.meta.winner_index + 1}-manba eng sifatli deb tanlandi` +
            (data.meta?.snr != null ? `, SNR ${data.meta.snr} dB` : "") +
            `) — yuqorida sinab ko'rib, modellar safiga qo'shing.`
        );
      } else {
        setCloneInfo(
          `"${data.voice?.name}" tayyor — yuqorida sinab ko'rib, modellar safiga qo'shing.`
        );
      }
      clearNewVoiceForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setCloning(false);
    }
  }

  // O'chirish — window.confirm YO'Q: karta ichida ikki bosqichli inline tasdiqlash
  // (birinchi bosish "O'chirilsinmi? Ha/Yo'q" ga aylanadi).
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  async function remove(v: VoiceItem) {
    setRemovingId(v.id);
    setError(null);
    try {
      await fetch(`/api/voice?id=${encodeURIComponent(v.id)}`, {
        method: "DELETE",
      });
      await refreshVoices();
      setCloneInfo(`"${v.name}" o'chirildi.`);
      setTestUrl(null);
    } catch {
      setError("O'chirishda xato — qayta urinib ko'ring.");
    } finally {
      setRemovingId(null);
      setDeleteConfirmId(null);
    }
  }

  // Ikki bosqichli o'chirish tugmasi (drafts va tasdiqlangan ro'yxatda bir xil)
  function DeleteControl({ v, label = false }: { v: VoiceItem; label?: boolean }) {
    if (deleteConfirmId === v.id) {
      return (
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-fg-muted">
            O&apos;chirilsinmi?
          </span>
          <button
            onClick={() => remove(v)}
            disabled={removingId !== null}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[12px] font-semibold transition",
              removingId !== null
                ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                : "bg-danger text-white hover:opacity-90"
            )}
          >
            {removingId === v.id ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Ha
          </button>
          <button
            onClick={() => setDeleteConfirmId(null)}
            disabled={removingId !== null}
            className="inline-flex items-center rounded-lg border border-border px-2.5 py-2 text-[12px] font-medium text-fg-muted transition hover:bg-bg-muted"
          >
            Yo&apos;q
          </button>
        </span>
      );
    }
    return (
      <button
        onClick={() => setDeleteConfirmId(v.id)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border border-danger/30 px-2.5 py-2 text-danger transition hover:bg-danger/10",
          label && "px-3 text-[12px]"
        )}
        aria-label="O'chirish"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {label ? "O'chirish" : null}
      </button>
    );
  }

  // Draft ovozni tasdiqlash — modellar safiga qo'shish (sintezda ko'rinadi)
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  async function confirmVoice(v: VoiceItem) {
    setConfirmingId(v.id);
    setError(null);
    try {
      const res = await fetch("/api/voice", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: v.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Tasdiqlashda xato");
      await refreshVoices();
      setCloneInfo(`"${v.name}" modellar safiga qo'shildi — sintez sahifasida tayyor.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setConfirmingId(null);
    }
  }

  const drafts = voices.filter((v) => v.status === "draft");
  const confirmed = voices.filter((v) => v.status !== "draft");

  // ── Modelni yaxshilash: tanlangan modelga 1-3 qo'shimcha video/URL ──
  const MAX_IMPROVE_SOURCES = 3;
  const [improveId, setImproveId] = useState<string | null>(null);
  const [improveUrls, setImproveUrls] = useState<string[]>([""]);
  const [improveFiles, setImproveFiles] = useState<File[]>([]);
  const [improving, setImproving] = useState(false);

  const validImproveUrls = improveUrls
    .map((u) => u.trim())
    .filter((u) => /^https?:\/\//.test(u));
  const improveCount = improveFiles.length + validImproveUrls.length;

  function openImprove(v: VoiceItem) {
    setImproveId(improveId === v.id ? null : v.id);
    setImproveUrls([""]);
    setImproveFiles([]);
  }

  async function improveVoice(v: VoiceItem) {
    if (improving || improveCount === 0) return;
    if (improveCount > MAX_IMPROVE_SOURCES) {
      setError(`Ko'pi bilan ${MAX_IMPROVE_SOURCES} ta yangi manba yuboring.`);
      return;
    }
    setImproving(true);
    setError(null);
    setWarning(null);
    setCloneInfo(null);
    try {
      const fd = new FormData();
      fd.append("voice_id", v.id);
      for (const f of improveFiles) fd.append("file", f, f.name);
      fd.append("urls", JSON.stringify(validImproveUrls));
      const res = await fetch("/api/clone", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Yaxshilashda xato");
      await refreshVoices();
      setWarning(data.warning ?? null);
      setCloneInfo(
        data.keptExisting
          ? `"${v.name}" tekshirildi — mavjud namuna eng sifatlisi bo'lib qoldi (model o'zgartirilmadi).`
          : `"${v.name}" yangilandi — yangi manbadan sifatliroq namuna olindi` +
              (data.meta?.snr != null ? ` (SNR ${data.meta.snr} dB).` : ".")
      );
      setImproveId(null);
      setImproveUrls([""]);
      setImproveFiles([]);
      setTestUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Xato");
    } finally {
      setImproving(false);
    }
  }

  const enough = elapsed >= MIN_REF_SECONDS;
  const busy = cloning || saving || recording;

  return (
    <div className="mx-auto max-w-2xl space-y-7 animate-fade-in">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl border border-accent/20 bg-bg-subtle/50 px-6 py-8 text-center backdrop-blur-md">
        <div className="pointer-events-none absolute inset-0 bg-app-gradient opacity-70" />
        <div className="relative space-y-3">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl brand-gradient text-white shadow-glow">
            <Fingerprint className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Mening ovozlarim
          </h2>
          <p className="mx-auto max-w-md text-sm text-fg-muted">
            Turli ovozlardan model yarating ({MAX_VOICES} tagacha) — har biriga nom
            bering, sun'iy intellekt istalgan matnni <b>o'sha ovozda, o'sha
            uslubda</b> gapiradi. Buni <b>2 usul</b> bilan qilish mumkin:
          </p>
          <div className="mx-auto flex max-w-md flex-col gap-2 pt-1 text-left sm:flex-row">
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-bg/50 px-3 py-2 text-[12px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full brand-gradient text-[11px] font-bold text-white">1</span>
              <span className="text-fg-muted"><b className="text-fg">Video/qo'shiqdan</b> — havola yoki fayl</span>
            </div>
            <div className="flex flex-1 items-center gap-2 rounded-xl border border-border bg-bg/50 px-3 py-2 text-[12px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full brand-gradient text-[11px] font-bold text-white">2</span>
              <span className="text-fg-muted"><b className="text-fg">Ovoz yozdirish</b> — jumlalarni o'qing</span>
            </div>
          </div>
        </div>
      </div>

      {!loaded ? (
        <div className="flex justify-center py-10 text-fg-subtle">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <>
          {/* Sinovdagi (draft) modellar — sinab ko'rib tasdiqlanadi yoki o'chiriladi */}
          {drafts.length > 0 && (
            <div className="space-y-3 rounded-2xl border border-accent/40 bg-accent/5 p-5">
              <div className="text-sm font-semibold">
                Yangi model — sinab ko'ring va qaror qiling
              </div>
              <ul className="space-y-2">
                {drafts.map((v) => (
                  <li
                    key={v.id}
                    className="space-y-3 rounded-xl border border-border bg-bg/60 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {v.hasImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/voice/image/${v.id}`}
                          alt={v.name}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                          <Fingerprint className="h-5 w-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{v.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                            <AlertTriangle className="h-3 w-3" />
                            Tasdiqlanmagan
                          </span>
                        </div>
                        <div className="text-[11px] text-fg-subtle">
                          Sinab ko'ring — keyin safga qo'shing yoki o'chiring
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => test(v)}
                        disabled={testingId !== null}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-[12px] font-semibold transition",
                          testingId !== null
                            ? "cursor-not-allowed text-fg-subtle"
                            : "hover:bg-bg-muted"
                        )}
                      >
                        {testingId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Sinash
                      </button>
                      <button
                        onClick={() => confirmVoice(v)}
                        disabled={confirmingId !== null}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition",
                          confirmingId !== null
                            ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                            : "brand-gradient text-white shadow-glow hover:opacity-90"
                        )}
                      >
                        {confirmingId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Modellar safiga qo'shish
                      </button>
                      <span className="ml-auto">
                        <DeleteControl v={v} label />
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              {testUrl && (
                <audio src={testUrl} controls autoPlay className="h-10 w-full" />
              )}
            </div>
          )}

          {/* Tasdiqlangan modellar kutubxonasi */}
          {confirmed.length > 0 && (
            <div className="card-glow space-y-3 p-5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold">
                  Modellaringiz{" "}
                  <span className="text-[11px] font-normal text-fg-subtle">
                    · {voices.length}/{MAX_VOICES}
                  </span>
                </div>
                <Link
                  href="/cabinet/sintez"
                  className="inline-flex items-center gap-1.5 text-[12px] font-medium text-accent transition hover:opacity-80"
                >
                  <AudioLines className="h-3.5 w-3.5" />
                  Sintezga o'tish
                </Link>
              </div>
              <ul className="space-y-2">
                {confirmed.map((v) => (
                  <li
                    key={v.id}
                    className="space-y-3 rounded-xl border border-border bg-bg/50 p-3"
                  >
                    <div className="flex items-center gap-3">
                      {v.hasImage ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={`/api/voice/image/${v.id}`}
                          alt={v.name}
                          className="h-10 w-10 shrink-0 rounded-full object-cover"
                        />
                      ) : (
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent">
                          <Fingerprint className="h-5 w-5" />
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold">{v.name}</span>
                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Tasdiqlangan
                          </span>
                        </div>
                        <div className="text-[11px] text-fg-subtle">
                          {v.durationSec ? `${v.durationSec.toFixed(0)}s namuna · ` : ""}
                          matndan nutq sahifasida chiqadi
                        </div>
                      </div>
                      <button
                        onClick={() => test(v)}
                        disabled={testingId !== null}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold transition",
                          testingId !== null
                            ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                            : "brand-gradient text-white hover:opacity-90"
                        )}
                      >
                        {testingId === v.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Play className="h-3.5 w-3.5" />
                        )}
                        Sinash
                      </button>
                      <button
                        onClick={() => openImprove(v)}
                        disabled={improving}
                        className={cn(
                          "inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-[12px] font-semibold transition",
                          improveId === v.id
                            ? "border-accent/50 bg-accent/10 text-accent"
                            : "border-border text-fg-muted hover:bg-bg-muted hover:text-fg"
                        )}
                      >
                        <Wand2 className="h-3.5 w-3.5" />
                        Yaxshilash
                      </button>
                      <DeleteControl v={v} />
                    </div>

                    {/* Yaxshilash paneli: 1-3 qo'shimcha video/URL — eng sifatlisi tanlanadi */}
                    {improveId === v.id && (
                      <div className="space-y-3 rounded-xl border border-accent/30 bg-accent/5 p-3">
                        <div className="text-[12px] text-fg-muted">
                          Shu odamning yana {MAX_IMPROVE_SOURCES} tagacha video/audiosini
                          bering — hozirgi namuna bilan solishtirilib, eng sifatlisi
                          qoladi. Boshqa odam ovozi avtomatik chetlatiladi.
                        </div>
                        {improveUrls.map((u, i) => (
                          <label
                            key={i}
                            className="flex items-center gap-2 rounded-xl border border-border bg-bg/50 px-3 py-2.5 focus-within:border-accent/50"
                          >
                            <Link2 className="h-4 w-4 shrink-0 text-fg-subtle" />
                            <input
                              type="url"
                              value={u}
                              onChange={(e) =>
                                setImproveUrls((prev) =>
                                  prev.map((p, j) => (j === i ? e.target.value : p))
                                )
                              }
                              placeholder="https://… (video yoki audio havolasi)"
                              disabled={improving}
                              className="w-full bg-transparent text-sm outline-none placeholder:text-fg-subtle"
                            />
                            {improveUrls.length > 1 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setImproveUrls((prev) => prev.filter((_, j) => j !== i))
                                }
                                disabled={improving}
                                className="shrink-0 text-fg-subtle transition hover:text-danger"
                                aria-label="URL olib tashlash"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </label>
                        ))}
                        {improveUrls.length + improveFiles.length < MAX_IMPROVE_SOURCES && (
                          <button
                            type="button"
                            onClick={() => setImproveUrls((prev) => [...prev, ""])}
                            disabled={improving}
                            className="text-[12px] font-medium text-accent transition hover:opacity-80"
                          >
                            + Yana URL qo'shish
                          </button>
                        )}
                        <label
                          className={cn(
                            "flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm transition hover:bg-bg-muted",
                            improving && "cursor-not-allowed opacity-60"
                          )}
                        >
                          <Upload className="h-4 w-4 shrink-0 text-fg-subtle" />
                          <span className="truncate text-fg-muted">
                            {improveFiles.length
                              ? `${improveFiles.length} ta fayl tanlandi`
                              : "Video/audio fayl(lar) tanlang"}
                          </span>
                          <input
                            type="file"
                            accept="audio/*,video/*"
                            multiple
                            disabled={improving}
                            onChange={(e) => {
                              const picked = Array.from(e.target.files ?? []);
                              setImproveFiles((prev) =>
                                [
                                  ...prev,
                                  ...picked.filter(
                                    (f) =>
                                      !prev.some(
                                        (p) => p.name === f.name && p.size === f.size
                                      )
                                  ),
                                ].slice(0, MAX_IMPROVE_SOURCES)
                              );
                              e.target.value = "";
                            }}
                            className="hidden"
                          />
                        </label>
                        {improveFiles.length > 0 && (
                          <ul className="space-y-1">
                            {improveFiles.map((f, i) => (
                              <li
                                key={`${f.name}-${i}`}
                                className="flex items-center gap-2 rounded-lg border border-border bg-bg/50 px-3 py-1.5 text-[12px] text-fg-muted"
                              >
                                <span className="truncate">{f.name}</span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setImproveFiles((prev) =>
                                      prev.filter((_, j) => j !== i)
                                    )
                                  }
                                  disabled={improving}
                                  className="ml-auto shrink-0 text-fg-subtle transition hover:text-danger"
                                  aria-label="Faylni olib tashlash"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button
                          onClick={() => improveVoice(v)}
                          disabled={
                            improving || improveCount === 0 || improveCount > MAX_IMPROVE_SOURCES
                          }
                          className={cn(
                            "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition",
                            improving || improveCount === 0
                              ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                              : "brand-gradient text-white shadow-glow hover:opacity-90"
                          )}
                        >
                          {improving ? (
                            <>
                              <Loader2 className="h-4 w-4 animate-spin" />
                              Solishtirilmoqda… (har manba 1–2 daqiqa)
                            </>
                          ) : (
                            <>
                              <Wand2 className="h-4 w-4" />
                              {improveCount > 0
                                ? `Yaxshilash (${improveCount} yangi manba)`
                                : "Manba qo'shing"}
                            </>
                          )}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {drafts.length === 0 && testUrl && (
                <audio src={testUrl} controls autoPlay className="h-10 w-full" />
              )}
            </div>
          )}

          {/* Yangi ovoz: nom (majburiy) + rasm (ixtiyoriy) */}
          <div className="card-glow space-y-4 p-5">
            <div>
              <div className="text-sm font-semibold">Yangi ovoz yaratish</div>
              <div className="text-[12px] text-fg-subtle">
                Avval nom kiriting (majburiy), xohlasangiz rasm qo'shing — keyin
                quyidagi 2 usuldan birini tanlang
              </div>
            </div>

            {atLimit ? (
              <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Limit to'ldi ({MAX_VOICES} ta). Yangi ovoz uchun avval keraksizini
                o'chiring.
              </div>
            ) : (
              <div className="flex gap-3">
                <input
                  type="text"
                  value={voiceName}
                  onChange={(e) => setVoiceName(e.target.value)}
                  maxLength={NAME_MAX}
                  placeholder='Ovoz nomi — masalan: "Ronaldo" (majburiy)'
                  disabled={busy}
                  className="w-full rounded-xl border border-border bg-bg/50 px-3 py-2.5 text-sm outline-none transition focus:border-accent/50 placeholder:text-fg-subtle"
                />
                <label
                  className={cn(
                    "flex shrink-0 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-[12px] text-fg-muted transition hover:bg-bg-muted",
                    busy && "cursor-not-allowed opacity-60"
                  )}
                  title="Rasm (ixtiyoriy)"
                >
                  {voiceImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={URL.createObjectURL(voiceImage)}
                      alt="avatar"
                      className="h-6 w-6 rounded-full object-cover"
                    />
                  ) : (
                    <ImagePlus className="h-4 w-4" />
                  )}
                  Rasm
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      setVoiceImage(e.target.files?.[0] ?? null);
                      e.target.value = "";
                    }}
                    className="hidden"
                  />
                </label>
              </div>
            )}
          </div>

          {/* 1-usul: Video/qo'shiqdan klonlash */}
          <div className={cn("card-glow space-y-4 p-5", atLimit && "opacity-50")}>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-gradient text-sm font-bold text-white">
                1
              </span>
              <div>
                <div className="text-sm font-semibold">Video yoki qo'shiqdan klonlash</div>
                <div className="text-[12px] text-fg-subtle">
                  Bir odamning {MAX_SOURCES} tagacha video/audiosini bering — AI eng
                  sifatlisini tanlab klonlaydi
                </div>
              </div>
            </div>

            {cloneUrls.map((u, i) => (
              <label
                key={i}
                className="flex items-center gap-2 rounded-xl border border-border bg-bg/50 px-3 py-2.5 focus-within:border-accent/50"
              >
                <Link2 className="h-4 w-4 shrink-0 text-fg-subtle" />
                <input
                  type="url"
                  value={u}
                  onChange={(e) =>
                    setCloneUrls((prev) =>
                      prev.map((p, j) => (j === i ? e.target.value : p))
                    )
                  }
                  placeholder="https://… (YouTube, video yoki audio havolasi)"
                  disabled={cloning || atLimit}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-fg-subtle"
                />
                {cloneUrls.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setCloneUrls((prev) => prev.filter((_, j) => j !== i))
                    }
                    disabled={cloning}
                    className="shrink-0 text-fg-subtle transition hover:text-danger"
                    aria-label="URL olib tashlash"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </label>
            ))}

            {cloneUrls.length + cloneFiles.length < MAX_SOURCES && !atLimit && (
              <button
                type="button"
                onClick={() => setCloneUrls((prev) => [...prev, ""])}
                disabled={cloning}
                className="text-[12px] font-medium text-accent transition hover:opacity-80"
              >
                + Yana URL qo'shish
              </button>
            )}

            <div className="flex items-center gap-3 text-[11px] uppercase tracking-wider text-fg-subtle">
              <span className="h-px flex-1 bg-border" />
              yoki / va
              <span className="h-px flex-1 bg-border" />
            </div>

            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-border px-3 py-2.5 text-sm transition hover:bg-bg-muted",
                (cloning || atLimit) && "cursor-not-allowed opacity-60"
              )}
            >
              <Upload className="h-4 w-4 shrink-0 text-fg-subtle" />
              <span className="truncate text-fg-muted">
                {cloneFiles.length
                  ? `${cloneFiles.length} ta fayl tanlandi — yana qo'shish mumkin`
                  : "Video/audio fayl(lar) tanlang"}
              </span>
              <input
                type="file"
                accept="audio/*,video/*"
                multiple
                disabled={cloning || atLimit}
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? []);
                  // Yangi tanlov eskisini ALMASHTIRMAYDI — ustiga qo'shiladi
                  // (bir xil nom+hajm takror qo'shilmaydi).
                  setCloneFiles((prev) =>
                    [
                      ...prev,
                      ...picked.filter(
                        (f) =>
                          !prev.some((p) => p.name === f.name && p.size === f.size)
                      ),
                    ].slice(0, MAX_SOURCES)
                  );
                  e.target.value = "";
                }}
                className="hidden"
              />
            </label>

            {cloneFiles.length > 0 && (
              <ul className="space-y-1">
                {cloneFiles.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center gap-2 rounded-lg border border-border bg-bg/50 px-3 py-1.5 text-[12px] text-fg-muted"
                  >
                    <span className="truncate">{f.name}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setCloneFiles((prev) => prev.filter((_, j) => j !== i))
                      }
                      disabled={cloning}
                      className="ml-auto shrink-0 text-fg-subtle transition hover:text-danger"
                      aria-label="Faylni olib tashlash"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={cloneFromMedia}
              disabled={
                cloning || atLimit || !nameOk || sourceCount === 0 || sourceCount > MAX_SOURCES
              }
              className={cn(
                "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition",
                cloning || atLimit || !nameOk || sourceCount === 0 || sourceCount > MAX_SOURCES
                  ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                  : "brand-gradient text-white shadow-glow hover:opacity-90"
              )}
            >
              {cloning ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ajratilmoqda… (har manba 1–2 daqiqa)
                </>
              ) : (
                <>
                  <Wand2 className="h-4 w-4" />
                  {!nameOk
                    ? "Avval nom kiriting"
                    : sourceCount > 1
                      ? `Ajratib klonlash (${sourceCount} manbadan eng yaxshisi)`
                      : "Ajratib klonlash"}
                </>
              )}
            </button>

            <div className="flex items-start gap-2 text-[11px] text-fg-subtle">
              <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
              Eng yaxshi natija — gapirayotgan odam (intervyu/vlog). Bir necha manba
              bersangiz, hammasi BIR XIL odam bo'lsin — eng tozasi avtomatik tanlanadi.
              Klon manbadagidek gapiradi: tez gapirsa tez, sekin gapirsa sekin.
            </div>
          </div>

          {/* 2-usul: Ovoz yozdirish */}
          <div className={cn("card-glow space-y-5 p-5", atLimit && "opacity-50")}>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg brand-gradient text-sm font-bold text-white">
                2
              </span>
              <div>
                <div className="text-sm font-semibold">Ovoz yozdirish</div>
                <div className="text-[12px] text-fg-subtle">
                  Quyidagi jumlalarni tabiiy ohangda o'qing
                </div>
              </div>
            </div>

            <ol className="space-y-2">
              {REFERENCE_SENTENCES.map((s, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-border bg-bg/50 p-3 text-[15px] leading-relaxed"
                >
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 text-[11px] font-semibold text-accent">
                    {i + 1}
                  </span>
                  <span>{s}</span>
                </li>
              ))}
            </ol>

            <div className="flex items-center gap-2 text-[11px] text-fg-subtle">
              <Sparkles className="h-3.5 w-3.5 text-accent" />
              Tinch xonada, mikrofonga yaqin, tabiiy ohangda o'qing. Kamida{" "}
              {MIN_REF_SECONDS} soniya.
            </div>

            {/* Yozish tugmasi */}
            {!recording ? (
              <button
                onClick={start}
                disabled={saving || atLimit || !nameOk}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3.5 text-base font-semibold transition",
                  saving || atLimit || !nameOk
                    ? "cursor-not-allowed bg-bg-muted text-fg-subtle"
                    : "brand-gradient text-white shadow-glow hover:opacity-90"
                )}
              >
                {saving ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Saqlanmoqda…
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    {nameOk ? "Yozishni boshlash" : "Avval nom kiriting"}
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={stop}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-danger bg-danger/15 px-4 py-3.5 text-base font-semibold text-danger transition hover:bg-danger/20"
              >
                <Square className="h-5 w-5 fill-current" />
                To'xtatish · {elapsed.toFixed(0)}s
                <span
                  className={cn(
                    "ml-1 h-2.5 w-2.5 animate-pulse rounded-full",
                    enough ? "bg-emerald-500" : "bg-danger"
                  )}
                />
              </button>
            )}
            {recording && !enough && (
              <div className="text-center text-[11px] text-fg-subtle">
                Yana {(MIN_REF_SECONDS - elapsed).toFixed(0)}s o'qing…
              </div>
            )}
          </div>

          {cloneInfo && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              {cloneInfo}
            </div>
          )}

          {warning && (
            <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {warning}
            </div>
          )}

          {error && (
            <div className="whitespace-pre-line rounded-xl border border-danger/30 bg-danger/10 p-3 text-sm text-danger">
              {error}
            </div>
          )}
        </>
      )}
    </div>
  );
}
