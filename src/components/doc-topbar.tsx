import Link from "next/link";
import { AudioLines, LayoutDashboard } from "lucide-react";

// ────────────────────────────────────────────────
// Hujjat/qo'llanma sahifalari uchun yengil yuqori panel.
//
// Nega kerak: /integratsiya va /docs ildiz layout'ida (kabinet yon-menyusi yo'q).
// Usiz sahifaga kirgan foydalanuvchi faqat brauzer "orqaga" tugmasi bilan chiqa
// olardi. Logotip — bosh sahifaga, o'ngdagi tugma — kabinetga (ko'pincha
// foydalanuvchi o'sha yerdan keladi).
//
// SiteHeader (marketing) qo'yilmadi: uning markaziy navigatsiyasi #features kabi
// faqat bosh sahifada mavjud bo'lgan lentalarga ishora qiladi — bu yerda ular
// hech qayerga olib bormaydi.
//
// Server komponenti: mijoz hook'lari yo'q, shuning uchun metadata'li server
// sahifalarga to'g'ridan-to'g'ri qo'yiladi.
// ────────────────────────────────────────────────
export function DocTopBar() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl brand-gradient text-white shadow-glow">
            <AudioLines className="h-[17px] w-[17px]" />
          </span>
          <span className="text-[15px] font-semibold tracking-tight">
            Next<span className="brand-text">TTS</span>
          </span>
        </Link>

        <Link
          href="/cabinet"
          className="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 text-[13px] text-fg-muted transition hover:bg-bg-muted hover:text-fg"
        >
          <LayoutDashboard className="h-4 w-4" />
          Kabinet
        </Link>
      </div>
    </header>
  );
}
