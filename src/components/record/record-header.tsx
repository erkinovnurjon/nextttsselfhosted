"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ModeBtn } from "@/components/record/mode-btn";

type Mode = "pending" | "all";

export function RecordHeader({
  progress,
  currentIdx,
  total,
  mode,
  onModeChange,
}: {
  progress: number;
  currentIdx: number;
  total: number;
  mode: Mode;
  onModeChange: (mode: Mode) => void;
}) {
  return (
    <header className="border-b border-border bg-bg-subtle">
      <div className="mx-auto max-w-4xl px-4 py-3 flex items-center justify-between gap-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-bg-muted transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <div className="flex-1 flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-bg-muted overflow-hidden">
            <div
              className="h-full bg-accent transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs font-mono text-fg-muted whitespace-nowrap">
            {currentIdx + 1} / {total}
          </span>
        </div>
        <div className="flex items-center gap-1 rounded-md border border-border bg-bg p-0.5">
          <ModeBtn active={mode === "pending"} onClick={() => onModeChange("pending")}>
            Kutilmoqda
          </ModeBtn>
          <ModeBtn active={mode === "all"} onClick={() => onModeChange("all")}>
            Hammasi
          </ModeBtn>
        </div>
      </div>
    </header>
  );
}
