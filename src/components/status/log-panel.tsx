"use client";

/**
 * Log tail ko'rinishi (training / pipeline / ekstraktsiya).
 * JSX/class'lar status/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
export function LogPanel({
  title,
  lines,
  empty,
}: {
  title: string;
  lines: string[];
  empty?: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-subtle">
      <div className="border-b border-border px-3 py-2 text-xs font-semibold flex items-center gap-1.5">
        <span className="h-1 w-1 rounded-full bg-accent" />
        {title}
      </div>
      <div className="max-h-72 overflow-y-auto p-2">
        {lines.length === 0 ? (
          <div className="text-xs text-fg-muted p-2">
            {empty || "Hech qanday qator yo'q"}
          </div>
        ) : (
          <pre className="text-[10px] leading-relaxed font-mono whitespace-pre-wrap break-all text-fg-muted">
            {lines.join("\n")}
          </pre>
        )}
      </div>
    </div>
  );
}
