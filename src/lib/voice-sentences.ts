// Shaxsiy ovoz reference uchun jumlalar — KLIENT-XAVFSIZ (fs import yo'q).
// Foydalanuvchi shularni o'qiydi → matn ANIQ bo'lgani uchun Whisper kerak emas,
// reference transkripti = shu jumlalar. x/gʻ/q/ch/sh fonemalarni qamrab oladi (~20-30s).
export const REFERENCE_SENTENCES: string[] = [
  "Assalomu alaykum, bu mening shaxsiy ovozim, uni sun'iy intellekt o'rganadi.",
  "O'zbekiston tarixi g'oyat boy, tog'lari ko'rkam, shaharlari obod va go'zal.",
  "Maxsus xushxabar keldi, hamma xursand bo'lib, bog'larga to'planishdi.",
  "Bahor kelib, daraxtlar gullaganda, qushlar mayin va shod sayraydi.",
];

// Sifatli klon uchun tavsiya etilgan minimal yozuv davomiyligi (sekund).
export const MIN_REF_SECONDS = 12;
