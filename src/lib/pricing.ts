// ────────────────────────────────────────────────
// Narx / kurs — "erkin summa" modeli
// Foydalanuvchi so'mda summa kiritadi → kreditga aylantiriladi.
// 1 kredit = 1 belgi (sintez). Kursni shu yerda o'zgartiring.
// ────────────────────────────────────────────────

// 1 so'mga necha kredit beriladi. ⚠️ Biznes qaroriga ko'ra sozlang.
// Masalan 10 → 1 000 so'm = 10 000 kredit (≈10 000 belgi).
export const CREDITS_PER_SOM = 10;

// To'ldirish chegaralari (so'm)
export const MIN_TOPUP_SOM = 1_000;
export const MAX_TOPUP_SOM = 10_000_000;

// UI uchun tavsiya etilgan tezkor summalar (so'm)
export const QUICK_AMOUNTS_SOM = [5_000, 10_000, 25_000, 50_000, 100_000];

export function creditsForSom(amountSom: number): number {
  return Math.floor(amountSom * CREDITS_PER_SOM);
}

export function isValidTopupSom(amountSom: number): boolean {
  return (
    Number.isInteger(amountSom) &&
    amountSom >= MIN_TOPUP_SOM &&
    amountSom <= MAX_TOPUP_SOM
  );
}

// Payme tiyinda ishlaydi (1 so'm = 100 tiyin)
export function somToTiyin(amountSom: number): number {
  return amountSom * 100;
}

export function tiyinToSom(amountTiyin: number): number {
  return Math.round(amountTiyin / 100);
}
