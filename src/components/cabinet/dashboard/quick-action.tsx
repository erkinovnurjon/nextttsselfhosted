import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type React from "react";

export function QuickAction({
  href,
  icon,
  title,
  desc,
  primary,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  primary?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group card p-5 transition-all hover:-translate-y-0.5 hover:border-accent/30"
    >
      <div
        className={
          primary
            ? "flex h-11 w-11 items-center justify-center rounded-xl brand-gradient text-white shadow-glow"
            : "flex h-11 w-11 items-center justify-center rounded-xl bg-accent/10 text-accent"
        }
      >
        {icon}
      </div>
      <div className="mt-4 flex items-center gap-1.5">
        <h4 className="text-sm font-semibold">{title}</h4>
        <ArrowRight className="h-3.5 w-3.5 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
      <p className="mt-1 text-xs text-fg-muted">{desc}</p>
    </Link>
  );
}
