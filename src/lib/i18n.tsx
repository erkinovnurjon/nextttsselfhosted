"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { Lang, Dict } from "./i18n/types";
import { uz } from "./i18n/locales/uz";
import { ru } from "./i18n/locales/ru";
import { en } from "./i18n/locales/en";

// ────────────────────────────────────────────────
// NextTTS — yengil 3 tilli i18n (uz / ru / en)
// next-intl o'rniga client-context: localStorage'da saqlanadi.
// Tarjima lug'atlari ./i18n/locales/* fayllarida.
// ────────────────────────────────────────────────

export type { Lang };

export const LANGS: { code: Lang; label: string; native: string; flag: string }[] = [
  { code: "uz", label: "O‘zbekcha", native: "UZ", flag: "🇺🇿" },
  { code: "ru", label: "Русский", native: "RU", flag: "🇷🇺" },
  { code: "en", label: "English", native: "EN", flag: "🇬🇧" },
];

const DICTS: Record<Lang, Dict> = { uz, ru, en };

function resolve(dict: Dict, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = dict;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return typeof cur === "string" ? cur : undefined;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : `{${k}}`
  );
}

export type TFunc = (key: string, vars?: Record<string, string | number>) => string;

interface I18nValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: TFunc;
  ready: boolean;
}

const I18nContext = createContext<I18nValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("uz");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem("lang") as Lang | null;
      if (stored && stored in DICTS) {
        setLangState(stored);
        document.documentElement.lang = stored;
      }
    } catch {
      /* ignore */
    }
    setReady(true);
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem("lang", l);
      document.documentElement.lang = l;
    } catch {
      /* ignore */
    }
  }, []);

  const t = useCallback<TFunc>(
    (key, vars) => {
      const val = resolve(DICTS[lang], key) ?? resolve(DICTS.uz, key) ?? key;
      return interpolate(val, vars);
    },
    [lang]
  );

  return (
    <I18nContext.Provider value={{ lang, setLang, t, ready }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within LanguageProvider");
  return ctx;
}
