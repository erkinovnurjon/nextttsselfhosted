// ────────────────────────────────────────────────
// Rol yordamchilari — client va server uchun xavfsiz (db import qilmaydi).
// "vip" va "admin" — cheksiz (limitsiz) rollar: kredit yechilmaydi.
// ────────────────────────────────────────────────

export const UNLIMITED_ROLES = ["admin", "vip"] as const;
export type Role = "user" | "vip" | "admin";

export function isUnlimited(role: string | null | undefined): boolean {
  return !!role && (UNLIMITED_ROLES as readonly string[]).includes(role);
}

export function isVip(role: string | null | undefined): boolean {
  return role === "vip";
}

export function isAdmin(role: string | null | undefined): boolean {
  return role === "admin";
}
