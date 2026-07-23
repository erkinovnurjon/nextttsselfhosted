import { Keyboard } from "lucide-react";
import { Kbd } from "@/components/record/kbd";

export function KeyboardHints() {
  return (
    <footer className="border-t border-border bg-bg-subtle">
      <div className="mx-auto max-w-4xl px-4 py-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-fg-muted">
        <span className="flex items-center gap-1.5">
          <Keyboard className="h-3.5 w-3.5" />
        </span>
        <Kbd k="Space" desc="Yozish / Toʻxtatish" />
        <Kbd k="Enter" desc="Saqlash" />
        <Kbd k="Esc" desc="Qayta yozish" />
        <Kbd k="→" desc="Keyingi" />
        <Kbd k="←" desc="Oldingi" />
      </div>
    </footer>
  );
}
