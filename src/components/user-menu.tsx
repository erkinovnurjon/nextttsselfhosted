"use client";

import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useState, useRef, useEffect } from "react";
import { User, LogOut, UserCircle, LogIn, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function UserMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  if (status === "loading") {
    return <div className="h-9 w-9 rounded-xl bg-bg-muted animate-pulse" />;
  }

  // Login bo'lmagan — Kirish tugmasi
  if (!session?.user) {
    return (
      <div className="flex items-center gap-1">
        <Link
          href="/login"
          className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[12px] font-medium text-fg-muted transition hover:bg-bg-muted hover:text-fg"
        >
          <LogIn className="h-3.5 w-3.5" />
          Kirish
        </Link>
        <Link
          href="/register"
          className="hidden sm:flex items-center rounded-xl bg-fg px-3 py-1.5 text-[12px] font-medium text-bg transition hover:opacity-85"
        >
          Ro'yxatdan o'tish
        </Link>
      </div>
    );
  }

  // Login bo'lgan — avatar + dropdown
  const initial = (session.user.name || session.user.email || "?")[0].toUpperCase();

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center gap-2 rounded-xl border border-border px-2 py-1.5 transition hover:bg-bg-muted",
          open && "bg-bg-muted"
        )}
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full brand-gradient text-[10px] font-semibold text-white">
          {initial}
        </span>
        <span className="hidden sm:inline text-[12px] font-medium truncate max-w-[100px]">
          {session.user.name || session.user.email?.split("@")[0]}
        </span>
        <ChevronDown className={cn("h-3 w-3 text-fg-subtle transition", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-xl border border-border bg-bg-subtle/95 shadow-soft backdrop-blur-xl overflow-hidden animate-fade-in z-50">
          <div className="px-3 py-2.5 border-b border-border/60">
            <div className="text-[13px] font-semibold truncate">
              {session.user.name}
            </div>
            <div className="text-[11px] text-fg-muted truncate">
              {session.user.email}
            </div>
            {session.user.role === "admin" && (
              <span className="mt-1 inline-flex items-center rounded-full bg-accent/15 px-2 py-0.5 text-[10px] text-accent">
                Admin
              </span>
            )}
          </div>
          <div className="p-1">
            <Link
              href="/profile"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-fg-muted hover:bg-bg-muted hover:text-fg transition"
            >
              <UserCircle className="h-4 w-4" />
              Profilim
            </Link>
            <button
              onClick={() => {
                setOpen(false);
                signOut({ callbackUrl: "/" });
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] text-fg-muted hover:bg-bg-muted hover:text-fg transition"
            >
              <LogOut className="h-4 w-4" />
              Chiqish
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
