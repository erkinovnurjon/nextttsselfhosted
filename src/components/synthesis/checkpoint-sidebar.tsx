"use client";

import { Loader2, RefreshCw, Cpu, Layers } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Checkpoint {
  id: string;
  name: string;
  size_gb: number;
  mtime: number;
  kind: "best" | "step";
  active: boolean;
}

/**
 * voice-lab checkpoint (versiya) tanlash paneli + tanlangan checkpoint kartochkasi.
 * JSX/class'lar voice-lab/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
export function CheckpointSidebar({
  checkpoints,
  selectedId,
  selectedCheckpoint,
  loadingCp,
  onSelect,
  onRefresh,
}: {
  checkpoints: Checkpoint[];
  selectedId: string | null;
  selectedCheckpoint: Checkpoint | undefined;
  loadingCp: boolean;
  onSelect: (id: string) => void;
  onRefresh: () => void;
}) {
  return (
    <aside className="space-y-3">
      <div className="rounded-lg border border-border bg-bg-subtle p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold flex items-center gap-1.5">
            <Layers className="h-3.5 w-3.5 text-accent" />
            Versiyalar
          </h3>
          <button
            onClick={onRefresh}
            className="rounded p-0.5 hover:bg-bg-muted"
            title="Qayta yuklash"
          >
            <RefreshCw className="h-3 w-3" />
          </button>
        </div>
        {loadingCp ? (
          <div className="flex items-center gap-2 text-xs text-fg-muted py-3">
            <Loader2 className="h-3 w-3 animate-spin" />
            Yuklanmoqda…
          </div>
        ) : checkpoints.length === 0 ? (
          <div className="text-xs text-fg-muted py-3">
            Hech qanday checkpoint topilmadi
          </div>
        ) : (
          <div className="space-y-1">
            {checkpoints.map((cp) => (
              <button
                key={cp.id}
                onClick={() => onSelect(cp.id)}
                className={cn(
                  "w-full text-left rounded-md p-2 text-xs transition",
                  cp.id === selectedId
                    ? "bg-accent/20 border border-accent/40 text-fg"
                    : "border border-transparent hover:bg-bg-muted text-fg-muted hover:text-fg"
                )}
              >
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      cp.active ? "bg-success" : "bg-fg-subtle"
                    )}
                  />
                  <span className="font-medium font-mono text-[11px] truncate">
                    {cp.id}
                  </span>
                </div>
                <div className="text-[10px] text-fg-subtle flex items-center gap-2">
                  <span>{cp.size_gb} GB</span>
                  <span>·</span>
                  <span>{cp.kind}</span>
                  {cp.active && (
                    <>
                      <span>·</span>
                      <span className="text-success">aktiv</span>
                    </>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedCheckpoint && (
        <div className="rounded-lg border border-border bg-bg-subtle p-3 text-[11px] space-y-1">
          <div className="text-xs font-semibold mb-1.5 flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 text-accent" />
            Tanlangan
          </div>
          <div className="text-fg-muted break-all">
            {selectedCheckpoint.name}
          </div>
          {selectedCheckpoint.mtime > 0 && (
            <div className="text-fg-subtle">
              {new Date(selectedCheckpoint.mtime * 1000).toLocaleString("uz")}
            </div>
          )}
          <div className="text-fg-subtle">
            {selectedCheckpoint.id === "mms"
              ? "Meta MMS · tug'ma o'zbek talaffuz · ovoz cloning yo'q · birinchi sintez ~25s (model yuklanadi)."
              : "Kichik switch (~10-20s) faqat birinchi sintezda boʻladi."}
          </div>
        </div>
      )}
    </aside>
  );
}
