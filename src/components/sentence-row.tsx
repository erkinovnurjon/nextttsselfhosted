"use client";

import { useState } from "react";
import {
  Mic,
  Trash2,
  Edit3,
  Check,
  X,
  Loader2,
  Volume2,
  RotateCcw,
} from "lucide-react";
import type { Sentence } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Recorder } from "./recorder";
import { AudioPlayer } from "./audio-player";

interface SentenceRowProps {
  sentence: Sentence;
  onUpdated: (sentence: Sentence) => void;
  onDeleted: (id: string) => void;
}

export function SentenceRow({ sentence, onUpdated, onDeleted }: SentenceRowProps) {
  const [editing, setEditing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [editText, setEditText] = useState(sentence.text);
  const [busy, setBusy] = useState(false);

  const recorded = sentence.audioPath != null;

  async function saveEdit() {
    const trimmed = editText.trim();
    if (!trimmed || trimmed === sentence.text) {
      setEditing(false);
      setEditText(sentence.text);
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/sentences/${sentence.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (res.ok) {
        onUpdated(data.sentence as Sentence);
      }
    } finally {
      setBusy(false);
      setEditing(false);
    }
  }

  async function handleDelete() {
    if (!confirm(`#${sentence.id} jumlani o'chirishni tasdiqlaysizmi?`)) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/sentences/${sentence.id}`, {
        method: "DELETE",
      });
      if (res.ok) onDeleted(sentence.id);
    } finally {
      setBusy(false);
    }
  }

  async function handleDeleteRecording() {
    if (!confirm("Yozuvni o'chirib qaytadan yozasizmi?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/recordings/${sentence.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) onUpdated(data.sentence as Sentence);
    } finally {
      setBusy(false);
    }
  }

  function speakWithBrowser() {
    const utter = new SpeechSynthesisUtterance(sentence.text);
    utter.lang = "uz-UZ";
    utter.rate = 1.0;
    speechSynthesis.cancel();
    speechSynthesis.speak(utter);
  }

  return (
    <div
      className={cn(
        "rounded-lg border bg-bg-subtle transition",
        recorded ? "border-success/30" : "border-border"
      )}
    >
      <div className="flex items-start gap-3 p-3">
        <div className="flex flex-col items-center gap-1 pt-0.5">
          <span className="text-xs font-mono text-fg-subtle">#{sentence.id}</span>
          {recorded ? (
            <span
              className="h-2 w-2 rounded-full bg-success"
              title="Yozilgan"
            />
          ) : (
            <span
              className="h-2 w-2 rounded-full border border-fg-subtle"
              title="Yozilmagan"
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {editing ? (
            <div className="flex items-start gap-2">
              <textarea
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                rows={2}
                className="flex-1 resize-none rounded-md border border-border bg-bg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
                autoFocus
              />
              <button
                onClick={saveEdit}
                disabled={busy}
                className="rounded-md bg-success p-1.5 text-white hover:opacity-90"
              >
                <Check className="h-4 w-4" />
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditText(sentence.text);
                }}
                disabled={busy}
                className="rounded-md border border-border p-1.5 hover:bg-bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="text-sm leading-relaxed">{sentence.text}</p>
          )}

          {recorded && !editing && (
            <div className="mt-2">
              <AudioPlayer src={`/api/recordings/${sentence.id}/audio`} />
              <div className="mt-1 text-xs text-fg-subtle flex items-center gap-3">
                <span>{sentence.duration?.toFixed(2)}s</span>
                <span>{sentence.sampleRate} Hz</span>
                {sentence.recordedAt && (
                  <span>
                    {new Date(sentence.recordedAt).toLocaleString("uz-UZ")}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {!editing && (
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={speakWithBrowser}
              title="Browser TTS bilan eshitish (test)"
              className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted hover:text-fg transition"
            >
              <Volume2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => setEditing(true)}
              disabled={busy}
              title="Tahrirlash"
              className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted hover:text-fg transition"
            >
              <Edit3 className="h-4 w-4" />
            </button>
            {recorded ? (
              <button
                onClick={handleDeleteRecording}
                disabled={busy}
                title="Yozuvni qayta yozish"
                className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted hover:text-warning transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => setRecording(true)}
                disabled={busy}
                title="Yozib olish"
                className="flex items-center gap-1 rounded-md bg-danger px-2 py-1.5 text-xs font-medium text-white hover:opacity-90 transition"
              >
                <Mic className="h-3.5 w-3.5" />
                Yozish
              </button>
            )}
            <button
              onClick={handleDelete}
              disabled={busy}
              title="Jumlani o'chirish"
              className="rounded-md p-1.5 text-fg-muted hover:bg-bg-muted hover:text-danger transition"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4" />
              )}
            </button>
          </div>
        )}
      </div>

      {recording && (
        <div className="border-t border-border p-3">
          <Recorder
            sentenceId={sentence.id}
            onSaved={(s) => {
              setRecording(false);
              onUpdated(s);
            }}
            onCancel={() => setRecording(false)}
          />
        </div>
      )}
    </div>
  );
}
