"use client";

import { User, Mail, ShieldCheck, CalendarDays } from "lucide-react";
import type { TFunc } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { VipBadge } from "@/components/cabinet/vip-badge";
import { InfoRow } from "./info-row";

export function ProfileSection({
  t,
  role,
  vip,
  initial,
  name,
  email,
  memberSince,
  roleLabel,
}: {
  t: TFunc;
  role: string | null | undefined;
  vip: boolean;
  initial: string;
  name: string | null | undefined;
  email: string | null | undefined;
  memberSince: string;
  roleLabel: string;
}) {
  return (
    <section className="card p-6">
      <h3 className="text-sm font-semibold">{t("cabinet.sozlamalar.profileTitle")}</h3>
      <div className="mt-4 flex items-center gap-4">
        <span
          className={cn(
            "flex h-14 w-14 items-center justify-center rounded-2xl text-xl font-semibold text-white shadow-glow",
            vip ? "bg-gradient-to-br from-amber-400 to-yellow-500 ring-2 ring-amber-300/50" : "brand-gradient"
          )}
        >
          {initial}
        </span>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-semibold">{name}</span>
            <VipBadge role={role} size="sm" />
          </div>
          <div className="text-sm text-fg-muted">{email}</div>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <InfoRow icon={<User className="h-4 w-4" />} label={t("cabinet.sozlamalar.name")} value={name ?? "—"} />
        <InfoRow icon={<Mail className="h-4 w-4" />} label={t("cabinet.sozlamalar.email")} value={email ?? "—"} />
        <InfoRow
          icon={<ShieldCheck className="h-4 w-4" />}
          label={t("cabinet.sozlamalar.role")}
          value={roleLabel}
        />
        <InfoRow
          icon={<CalendarDays className="h-4 w-4" />}
          label={t("cabinet.sozlamalar.memberSince")}
          value={memberSince}
        />
      </div>
    </section>
  );
}
