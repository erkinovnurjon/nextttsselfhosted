export function Kbd({ k, desc }: { k: string; desc: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <kbd className="rounded border border-border bg-bg px-1.5 py-0.5 font-mono text-[10px]">
        {k}
      </kbd>
      <span>{desc}</span>
    </span>
  );
}
