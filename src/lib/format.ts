import type { Lang } from "@/lib/i18n";

const LOCALES: Record<Lang, string> = {
  uz: "uz-UZ",
  ru: "ru-RU",
  en: "en-US",
};

export function localeOf(lang: Lang): string {
  return LOCALES[lang] ?? "uz-UZ";
}

export function formatDate(
  d: Date | string,
  locale: string,
  opts?: { dateOnly?: boolean }
): string {
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...(opts?.dateOnly
      ? {}
      : { hour: "2-digit", minute: "2-digit" }),
  });
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—";
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s}s`;
}
