"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { StatsBar } from "@/components/stats-bar";
import { AddSentenceForm } from "@/components/add-sentence-form";
import { SentenceList } from "@/components/sentence-list";
import type { Sentence, DatasetStats } from "@/lib/types";

export default function DashboardPage() {
  const [sentences, setSentences] = useState<Sentence[]>([]);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, []);

  async function fetchAll() {
    try {
      const [sRes, statsRes] = await Promise.all([
        fetch("/api/sentences"),
        fetch("/api/stats"),
      ]);
      if (!sRes.ok || !statsRes.ok) throw new Error("Maʼlumot yuklanmadi");
      const sData = await sRes.json();
      const statsData = await statsRes.json();
      setSentences(sData.sentences);
      setStats(statsData.stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nomalum xato");
    } finally {
      setLoading(false);
    }
  }

  function refreshStats() {
    fetch("/api/stats")
      .then((r) => r.json())
      .then((d) => setStats(d.stats))
      .catch(() => undefined);
  }

  function handleAdded(sentence: Sentence) {
    setSentences((prev) => [...prev, sentence]);
    refreshStats();
  }

  function handleUpdated(sentence: Sentence) {
    setSentences((prev) =>
      prev.map((s) => (s.id === sentence.id ? sentence : s))
    );
    refreshStats();
  }

  function handleDeleted(id: string) {
    setSentences((prev) => prev.filter((s) => s.id !== id));
    refreshStats();
  }

  return (
    <main className="mx-auto max-w-6xl px-4 md:px-6 py-6 space-y-6">
      {loading ? (
        <div className="flex items-center justify-center py-24 text-fg-muted">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Yuklanmoqda…
        </div>
      ) : error ? (
        <div className="rounded-lg border border-danger/30 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      ) : (
        <>
          {stats && <StatsBar stats={stats} />}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Yangi jumla qoʻshish
            </h2>
            <AddSentenceForm onAdded={handleAdded} />
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-accent" />
              Jumlalar dataset'i
            </h2>
            <SentenceList
              sentences={sentences}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          </section>
        </>
      )}
    </main>
  );
}
