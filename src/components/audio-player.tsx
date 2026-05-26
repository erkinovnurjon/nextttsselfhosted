"use client";

import { Play, Pause } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface AudioPlayerProps {
  src: string;
  compact?: boolean;
}

export function AudioPlayer({ src, compact = false }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => {
      setProgress(audio.currentTime);
      setDuration(audio.duration || 0);
    };
    const onEnd = () => setPlaying(false);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onTime);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  function toggle() {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      audio.play();
      setPlaying(true);
    }
  }

  const pct = duration > 0 ? (progress / duration) * 100 : 0;

  if (compact) {
    return (
      <button
        onClick={toggle}
        className="flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs hover:bg-bg-muted transition"
      >
        <audio ref={audioRef} src={src} preload="metadata" />
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
        <span className="font-mono">
          {progress.toFixed(1)}/{duration.toFixed(1)}s
        </span>
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-bg-subtle px-3 py-2">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        onClick={toggle}
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-fg text-bg hover:opacity-90 transition flex-shrink-0"
        )}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-0.5" />}
      </button>
      <div className="flex-1 min-w-0">
        <div className="h-1.5 rounded-full bg-bg-muted overflow-hidden">
          <div
            className="h-full bg-fg transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
      <span className="font-mono text-xs text-fg-muted whitespace-nowrap">
        {progress.toFixed(1)} / {duration.toFixed(1)}s
      </span>
    </div>
  );
}
