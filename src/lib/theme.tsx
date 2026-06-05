"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// ────────────────────────────────────────────────
// Yorug‘ / tungi rejim — localStorage + <html>.dark
// Dastlabki holat layout'dagi inline-script tomonidan o‘rnatiladi
// (FOUC bo‘lmasligi uchun).
// ────────────────────────────────────────────────

export type Theme = "light" | "dark";

interface ThemeValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  useEffect(() => {
    try {
      const stored = (localStorage.getItem("theme") as Theme | null) ?? "dark";
      setThemeState(stored);
      document.documentElement.classList.toggle("dark", stored === "dark");
    } catch {
      /* ignore */
    }
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem("theme", t);
      document.documentElement.classList.toggle("dark", t === "dark");
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = useCallback(() => {
    setThemeState((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      try {
        localStorage.setItem("theme", next);
        document.documentElement.classList.toggle("dark", next === "dark");
      } catch {
        /* ignore */
      }
      return next;
    });
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
