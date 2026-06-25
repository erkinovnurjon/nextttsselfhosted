"use client";

import { AudioLines, Users, History } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { QuickAction } from "./quick-action";

export function QuickActions() {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("cabinet.dashboard.quickTitle")}</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <QuickAction
          href="/cabinet/sintez"
          icon={<AudioLines className="h-5 w-5" />}
          title={t("cabinet.dashboard.quickSintez")}
          desc={t("cabinet.dashboard.quickSintezDesc")}
          primary
        />
        <QuickAction
          href="/cabinet/ovozlar"
          icon={<Users className="h-5 w-5" />}
          title={t("cabinet.dashboard.quickOvozlar")}
          desc={t("cabinet.dashboard.quickOvozlarDesc")}
        />
        <QuickAction
          href="/cabinet/tarix"
          icon={<History className="h-5 w-5" />}
          title={t("cabinet.dashboard.quickTarix")}
          desc={t("cabinet.dashboard.quickTarixDesc")}
        />
      </div>
    </div>
  );
}
