"use client";

import { useMemo, useState } from "react";
import { Search, Filter } from "lucide-react";
import type { Sentence } from "@/lib/types";
import { SentenceRow } from "./sentence-row";
import { cn } from "@/lib/utils";

type Filter = "all" | "pending" | "recorded";

interface SentenceListProps {
  sentences: Sentence[];
  onUpdated: (sentence: Sentence) => void;
  onDeleted: (id: string) => void;
}

export function SentenceList({ sentences, onUpdated, onDeleted }: SentenceListProps) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(() => {
    return sentences.filter((s) => {
      if (filter === "pending" && s.audioPath) return false;
      if (filter === "recorded" && !s.audioPath) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        return (
          s.text.toLowerCase().includes(q) || s.id.includes(q.replace(/^#/, ""))
        );
      }
      return true;
    });
  }, [sentences, query, filter]);

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-fg-subtle" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Qidirish (matn yoki #raqam)…"
            className="w-full rounded-md border border-border bg-bg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-bg p-1">
          <FilterButton active={filter === "all"} onClick={() => setFilter("all")}>
            Hammasi ({sentences.length})
          </FilterButton>
          <FilterButton
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          >
            Kutilmoqda ({sentences.filter((s) => !s.audioPath).length})
          </FilterButton>
          <FilterButton
            active={filter === "recorded"}
            onClick={() => setFilter("recorded")}
          >
            Yozilgan ({sentences.filter((s) => s.audioPath).length})
          </FilterButton>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-bg-subtle py-12 text-center text-sm text-fg-muted">
          <Filter className="h-6 w-6 mx-auto mb-2 opacity-50" />
          Jumla topilmadi
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((s) => (
            <SentenceRow
              key={s.id}
              sentence={s}
              onUpdated={onUpdated}
              onDeleted={onDeleted}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded px-3 py-1.5 text-xs font-medium transition whitespace-nowrap",
        active ? "bg-fg text-bg" : "text-fg-muted hover:bg-bg-muted"
      )}
    >
      {children}
    </button>
  );
}
