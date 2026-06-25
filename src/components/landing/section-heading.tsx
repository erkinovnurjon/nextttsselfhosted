export function SectionHeading({
  kicker,
  title,
  sub,
}: {
  kicker: string;
  title: string;
  sub?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
        {kicker}
      </div>
      <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{title}</h2>
      {sub && <p className="mx-auto mt-2 max-w-md text-sm text-fg-muted">{sub}</p>}
    </div>
  );
}
