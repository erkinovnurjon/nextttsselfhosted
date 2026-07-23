"use client";

/**
 * voice-lab inference parametri uchun slayder.
 * JSX/class'lar voice-lab/page.tsx dan AYNAN ko'chirilgan — xulq o'zgarmaydi.
 */
export function ParamSlider({
  label,
  value,
  onChange,
  min,
  max,
  step,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-[11px]">
      <div className="flex items-center justify-between">
        <span className="font-medium text-fg-muted">{label}</span>
        <span className="font-mono text-fg">{value.toFixed(step < 1 ? 2 : 0)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full accent-accent"
      />
      {hint && <span className="text-[10px] text-fg-subtle">{hint}</span>}
    </label>
  );
}
