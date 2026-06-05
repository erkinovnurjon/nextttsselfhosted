"use client";

import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export function ProfileLogoutButton() {
  return (
    <button
      onClick={() => signOut({ callbackUrl: "/" })}
      className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-medium text-fg-muted hover:bg-bg-muted hover:text-fg transition"
    >
      <LogOut className="h-3.5 w-3.5" />
      Chiqish
    </button>
  );
}
