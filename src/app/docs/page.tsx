import Link from "next/link";
import { DocTopBar } from "@/components/doc-topbar";
import {
  BookOpen,
  Volume2,
  GitCompare,
  Sparkles,
  Mic2,
  Activity,
  Cpu,
  Languages,
  Workflow,
  Plug,
  ArrowRight,
} from "lucide-react";

export const metadata = {
  title: "Hujjatlar — NextTTS",
  description: "NextTTS qo'llanmasi: sahifalar, MMS vs XTTS, fine-tuning, texnik stack.",
};

function Section({
  id,
  icon: Icon,
  title,
  children,
}: {
  id: string;
  icon: React.ElementType;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-20 space-y-3">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/12 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        {title}
      </h2>
      <div className="space-y-2.5 text-sm leading-relaxed text-fg-muted">{children}</div>
    </section>
  );
}

const TOC = [
  { id: "umumiy", label: "Umumiy" },
  { id: "sahifalar", label: "Sahifalar" },
  { id: "engine", label: "MMS vs XTTS" },
  { id: "finetune", label: "Fine-tuning" },
  { id: "stack", label: "Texnik stack" },
];

export default function DocsPage() {
  return (
    <>
    <DocTopBar />
    <main className="mx-auto max-w-4xl px-4 py-10 animate-fade-in md:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient text-white shadow-glow">
          <BookOpen className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Hujjatlar</h1>
          <p className="text-sm text-fg-muted">
            NextTTS — o'zbek tilida self-hosted matn-nutqqa (TTS) platformasi
          </p>
        </div>
      </div>

      <div className="grid gap-8 md:grid-cols-[180px_1fr]">
        {/* Mundarija */}
        <nav className="hidden md:block">
          <div className="sticky top-20 space-y-1">
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-fg-subtle">
              Mundarija
            </div>
            {TOC.map((t) => (
              <a
                key={t.id}
                href={`#${t.id}`}
                className="block rounded-lg px-2.5 py-1.5 text-[13px] text-fg-muted transition hover:bg-bg-muted hover:text-fg"
              >
                {t.label}
              </a>
            ))}
          </div>
        </nav>

        {/* Kontent */}
        <div className="space-y-10">
          <Section id="umumiy" icon={Languages} title="Umumiy">
            <p>
              NextTTS — bu o'zbek tilida ravon gapiradigan, o'z serveringizda (self-hosted)
              ishlaydigan TTS tizimi. U yozgan matningizni tabiiy o'zbek nutqiga aylantiradi.
            </p>
            <p>
              Tizim ikki ovoz dvigatelini (engine) qo'llab-quvvatlaydi: <b>MMS</b> (tug'ma
              o'zbek, fine-tune qilinadigan) va <b>XTTS</b> (voice cloning). Eng oson boshlash
              uchun{" "}
              <Link href="/sinov" className="text-accent hover:underline">
                Sinov
              </Link>{" "}
              sahifasiga o'ting.
            </p>
          </Section>

          <Section id="sahifalar" icon={Workflow} title="Sahifalar">
            <ul className="space-y-3">
              <DocItem icon={Plug} href="/integratsiya" title="Integratsiya qo'llanmasi">
                TTS'ni o'z loyihangizga ulash: bir qatorli vidjet yoki REST API. API kalit,
                kod misollari (JS, PHP, Python, curl), ovoz dvigatellari va limitlar.
              </DocItem>
              <DocItem icon={Volume2} href="/sinov" title="Sinov">
                Eng oddiy sahifa: matn yozing, ovozni (MMS yoki XTTS) tanlang, "Eshitish"
                bosing. Natija avtomatik o'ynaydi, yuklab olsa bo'ladi.
              </DocItem>
              <DocItem icon={GitCompare} href="/compare" title="Solishtirish">
                Bir xil 10 ta jumla har xil model versiyalarida oldindan ovozlangan — yonma-yon
                eshitib, qaysi biri ravonroq ekanini taqqoslaysiz (base MMS, fine-tuned MMS, XTTS).
              </DocItem>
              <DocItem icon={Sparkles} href="/voice-lab" title="Voice Lab">
                Kengaytirilgan sinov: aniq checkpoint tanlash, temperature/tezlik kabi
                parametrlarni sozlash, sintez tarixi.
              </DocItem>
              <DocItem icon={Mic2} href="/record" title="Batch yozish">
                O'z ovozingizdan dataset to'plash rejimi (XTTS voice cloning uchun). Klaviatura
                shortcutlari bilan tez yozish.
              </DocItem>
              <DocItem icon={Activity} href="/status" title="Training holati">
                GPU progress, loss qiymatlari va checkpoint'lar — fine-tuning jarayonini kuzatish.
              </DocItem>
            </ul>
          </Section>

          <Section id="engine" icon={Cpu} title="MMS vs XTTS — qaysi biri?">
            <div className="overflow-hidden rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-muted/60 text-left text-fg">
                  <tr>
                    <th className="px-3 py-2 font-semibold"> </th>
                    <th className="px-3 py-2 font-semibold">MMS</th>
                    <th className="px-3 py-2 font-semibold">XTTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <Row k="Til" a="Tug'ma o'zbek (kirill)" b="Turk fonemalari orqali" />
                  <Row k="q · x · oʻ · gʻ" a="To'g'ri ✓" b="Noaniq ⚠️" />
                  <Row k="Ovoz" a="Fikslangan / fine-tune" b="Istalgan ovozni klonlash" />
                  <Row k="Tezlik" a="Juda tez (~0.2s)" b="Sekinroq" />
                  <Row k="Eng yaxshi" a="Ravon o'zbek kerak bo'lsa" b="Aniq ovoz kerak bo'lsa" />
                </tbody>
              </table>
            </div>
            <p>
              O'zbek matnni MMS kirill modeliga uzatishdan oldin avtomatik{" "}
              <b>Latin → Kirill</b> transliteratsiya qilinadi (masalan{" "}
              <code className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[12px]">
                gʻalla → ғалла
              </code>
              ).
            </p>
          </Section>

          <Section id="finetune" icon={Sparkles} title="Fine-tuning (MMS'ni o'qitish)">
            <p>
              Bazaviy MMS ravon, lekin biroz monoton. Uni jonli spiker ovozida{" "}
              <b>fine-tune</b> qilib, ohang, pauza va tabiiylikni oshiramiz. Model qayerda
              to'xtashni, qanday ohangda gapirishni o'sha jonli ovozdan o'rganadi.
            </p>
            <p>
              Hozir <b>ISSAI USC</b> (o'zbek nutq korpusi) datasetining bir spikeri ishlatilmoqda.
              Kelajakda <b>FeruzaSpeech</b> (60 soat, professional ayol ovozi) bilan yanada
              jonliroq natija olinadi.
            </p>
            <p className="text-fg-subtle">
              Texnik: <code className="font-mono text-[12px]">facebook/mms-tts-uzb-script_cyrillic</code>{" "}
              modeli VITS arxitekturasida GAN fine-tuning orqali RTX 3060 GPU'da o'rgatiladi.
            </p>
          </Section>

          <Section id="stack" icon={Cpu} title="Texnik stack">
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Tech label="Frontend" value="Next.js 16 · React 19 · Tailwind" />
              <Tech label="Backend" value="Python · FastAPI" />
              <Tech label="TTS engine" value="MMS (VITS) · Coqui XTTS v2" />
              <Tech label="GPU" value="NVIDIA RTX 3060 12GB · CUDA 12.1" />
              <Tech label="Audio" value="16 kHz / 22 kHz mono WAV" />
              <Tech label="Til" value="O'zbek (lotin + kirill)" />
            </ul>
          </Section>

          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
            <div className="text-sm font-semibold">Tayyormisiz?</div>
            <p className="mt-1 text-sm text-fg-muted">
              Eng oddiy yo'l — Sinov sahifasida matn yozib, ovozni eshiting.
            </p>
            <Link
              href="/sinov"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg brand-gradient px-3.5 py-2 text-[13px] font-medium text-white shadow-glow transition hover:opacity-90"
            >
              Sinovga o'tish
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
    </>
  );
}

function DocItem({
  icon: Icon,
  href,
  title,
  children,
}: {
  icon: React.ElementType;
  href: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="group flex gap-3 rounded-xl border border-border bg-bg-subtle/60 p-3 transition hover:bg-bg-muted"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/12 text-accent">
          <Icon className="h-4 w-4" />
        </span>
        <span>
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-fg">
            {title}
            <ArrowRight className="h-3 w-3 text-fg-subtle transition group-hover:translate-x-0.5 group-hover:text-accent" />
          </span>
          <span className="mt-0.5 block text-[12px] text-fg-muted">{children}</span>
        </span>
      </Link>
    </li>
  );
}

function Row({ k, a, b }: { k: string; a: string; b: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-medium text-fg">{k}</td>
      <td className="px-3 py-2 text-fg-muted">{a}</td>
      <td className="px-3 py-2 text-fg-muted">{b}</td>
    </tr>
  );
}

function Tech({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-border bg-bg-subtle/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] text-fg">{value}</div>
    </li>
  );
}
