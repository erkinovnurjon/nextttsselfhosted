"use client";

import { Plus, Loader2 } from "lucide-react";
import { useState } from "react";
import type { Sentence } from "@/lib/types";
import { cn } from "@/lib/utils";

interface AddSentenceFormProps {
  onAdded: (sentence: Sentence) => void;
}

export function AddSentenceForm({ onAdded }: AddSentenceFormProps) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/sentences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Xatolik");
      onAdded(data.sentence as Sentence);
      setText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex items-start gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Yangi jumla kiriting… (masalan: Salom, mening ismim Ahmad.)"
          rows={2}
          maxLength={500}
          className="flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              handleSubmit(e);
            }
          }}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          className={cn(
            "flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-fg hover:opacity-90 transition self-start",
            (loading || !text.trim()) && "opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Plus className="h-4 w-4" />
          )}
          Qo'shish
        </button>
      </div>
      <div className="flex justify-between text-xs text-fg-subtle">
        <span>{error ?? "Ctrl+Enter — tezda qo'shish"}</span>
        <span className={text.length > 450 ? "text-warning" : ""}>
          {text.length} / 500
        </span>
      </div>
    </form>
  );
}
