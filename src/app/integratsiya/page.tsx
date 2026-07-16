import Link from "next/link";
import {
  Plug,
  Rocket,
  MousePointerClick,
  Code2,
  KeyRound,
  AudioLines,
  AlertTriangle,
  Gauge,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { CodeBlock, CodeTabs } from "@/components/integratsiya/snippet";

export const metadata = {
  title: "Integratsiya qo'llanmasi — NextTTS",
  description:
    "TTS'ni o'z loyihangizga ulash: bir qatorli vidjet yoki REST API. API kalit, ovoz dvigatellari, xatolar va limitlar.",
};

const TOC = [
  { id: "umumiy", label: "Umumiy" },
  { id: "boshlash", label: "3 qadamda" },
  { id: "vidjet", label: "Vidjet" },
  { id: "api", label: "REST API" },
  { id: "kalitlar", label: "Kalit turlari" },
  { id: "ovozlar", label: "Ovoz dvigatellari" },
  { id: "xatolar", label: "Xatolar" },
  { id: "limitlar", label: "Limitlar" },
];

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
      <div className="space-y-3 text-sm leading-relaxed text-fg-muted">{children}</div>
    </section>
  );
}

function Code({ children }: { children: React.ReactNode }) {
  return (
    <code className="rounded bg-bg-muted px-1 py-0.5 font-mono text-[12px] text-fg">
      {children}
    </code>
  );
}

export default function IntegratsiyaPage() {
  return (
    <main className="mx-auto max-w-4xl px-4 py-10 animate-fade-in md:px-6">
      {/* Header */}
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl brand-gradient text-white shadow-glow">
          <Plug className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Integratsiya qo'llanmasi</h1>
          <p className="text-sm text-fg-muted">
            TTS'ni istalgan loyihangizga ulang — bir qatorli vidjet yoki REST API bilan
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
          {/* ───── Umumiy ───── */}
          <Section id="umumiy" icon={AudioLines} title="Umumiy">
            <p>
              NextTTS matnni tabiiy o'zbek nutqiga aylantiradi. Uni o'z saytingizga ikki yo'l
              bilan ulash mumkin:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border bg-bg-subtle/60 p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <MousePointerClick className="h-4 w-4 text-accent" />
                  Vidjet
                </div>
                <p className="mt-1 text-[13px]">
                  Bitta <Code>&lt;script&gt;</Code> qatori. Matn yoniga "Tinglash" tugmasi
                  qo'shiladi. Kod yozishni bilmasangiz — shu yetadi.
                </p>
              </div>
              <div className="rounded-xl border border-border bg-bg-subtle/60 p-4">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-fg">
                  <Code2 className="h-4 w-4 text-accent" />
                  REST API
                </div>
                <p className="mt-1 text-[13px]">
                  Serverdan <Code>POST</Code> so'rov → WAV audio. To'liq nazorat kerak
                  bo'lganda (backend, mobil ilova, avtomatlashtirish).
                </p>
              </div>
            </div>
            <p>
              Ikkalasi ham <b>API kalit</b> bilan ishlaydi. Kalitni{" "}
              <Link href="/cabinet/api-kalitlar" className="text-accent hover:underline">
                Kabinet → API kalitlar
              </Link>{" "}
              bo'limida yaratasiz.
            </p>
          </Section>

          {/* ───── 3 qadamda ───── */}
          <Section id="boshlash" icon={Rocket} title="3 qadamda ishga tushirish">
            <ol className="space-y-4">
              <Step n={1} title="Kalit yarating">
                <Link href="/cabinet/api-kalitlar" className="text-accent hover:underline">
                  Kabinet → API kalitlar
                </Link>{" "}
                bo'limiga o'ting. Vidjet uchun <b>ommaviy</b> (<Code>pk_live_…</Code>) kalit
                tanlang va saytingiz domenini kiriting (masalan{" "}
                <Code>https://lms.uz</Code>). Kalit bir marta ko'rsatiladi — nusxalab oling.
              </Step>
              <Step n={2} title="Skriptni sahifaga qo'shing">
                Saytingizning HTML'iga, <Code>&lt;/body&gt;</Code> dan oldin:
                <div className="mt-2">
                  <CodeBlock
                    lang="html"
                    code={`<script src="__BASE__/widget.js" data-key="pk_live_SIZNING_KALIT"></script>`}
                  />
                </div>
              </Step>
              <Step n={3} title="Matnni belgilang">
                O'qitmoqchi bo'lgan matnga <Code>data-nexttts</Code> atributini qo'ying —
                yoniga tugma o'zi paydo bo'ladi:
                <div className="mt-2">
                  <CodeBlock
                    lang="html"
                    code={`<p data-nexttts>Bugungi darsda kimyoning asosiy qonunlarini o'rganamiz.</p>`}
                  />
                </div>
              </Step>
            </ol>
            <div className="rounded-xl border border-success/30 bg-success/5 p-3 text-[13px]">
              <b className="text-fg">Tayyor.</b> Sahifani oching — matn yonida "Tinglash"
              tugmasi turadi. Bosilganda o'zbekcha ovoz eshitiladi.
            </div>
          </Section>

          {/* ───── Vidjet ───── */}
          <Section id="vidjet" icon={MousePointerClick} title="Vidjet">
            <p>
              Vidjet ikki xil ishlatiladi: matnni belgilash orqali (avtomatik tugma) yoki
              JavaScript'dan chaqirib.
            </p>

            <h3 className="pt-1 text-[13px] font-semibold text-fg">1. Belgilash bilan</h3>
            <p>
              Har qanday elementga <Code>data-nexttts</Code> qo'ysangiz, uning ichidagi matn
              o'qiladi. Boshqa matn o'qitmoqchi bo'lsangiz — atributga qiymat bering:
            </p>
            <CodeBlock
              lang="html"
              code={`<!-- Element matni o'qiladi -->
<p data-nexttts>Salom, darsimizni boshlaymiz.</p>

<!-- Atributdagi matn o'qiladi (element matni emas) -->
<button data-nexttts="Javob to'g'ri!">✓</button>`}
            />

            <h3 className="pt-1 text-[13px] font-semibold text-fg">2. JavaScript'dan</h3>
            <p>
              Skript <Code>window.NextTTS</Code> obyektini beradi. Masalan tugma bosilganda
              yoki biror hodisada o'qitish:
            </p>
            <CodeBlock
              lang="javascript"
              code={`// Matnni o'qish
NextTTS.speak("Bu matn ovoz bilan o'qiladi.");

// Ovozni to'xtatish
NextTTS.stop();

// Parametr bilan (dvigatel, tezlik)
NextTTS.speak("Sekinroq o'qiladi.", { engine: "piper", speed: 0.9 });`}
            />

            <h3 className="pt-1 text-[13px] font-semibold text-fg">Sozlamalar</h3>
            <p>
              Skript tegidagi <Code>data-</Code> atributlar barcha o'qishlar uchun standart
              qiymat bo'ladi:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-muted/60 text-left text-fg">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Atribut</th>
                    <th className="px-3 py-2 font-semibold">Standart</th>
                    <th className="px-3 py-2 font-semibold">Ma'nosi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <AttrRow a="data-key" d="—" m="API kalit (majburiy, pk_live_...)" />
                  <AttrRow a="data-engine" d="piper" m="Ovoz dvigateli (pastdagi jadval)" />
                  <AttrRow a="data-voice" d="main" m="Ovoz tanlovi (dvigatelga bog'liq)" />
                  <AttrRow a="data-speed" d="1" m="Tezlik: 0.9 sekinroq, 1.1 tezroq" />
                </tbody>
              </table>
            </div>
            <div className="rounded-xl border border-border bg-bg-subtle/60 p-3 text-[13px]">
              <b className="text-fg">Kesh:</b> bir xil matn ikkinchi marta bosilganda qayta
              so'rov yuborilmaydi — darrov o'ynaydi va kredit sarflanmaydi. React/Vue kabi
              dinamik sahifalarda keyin qo'shilgan matnlar ham avtomatik ushlanadi.
            </div>
          </Section>

          {/* ───── REST API ───── */}
          <Section id="api" icon={Code2} title="REST API">
            <p>
              Serverdan to'g'ridan-to'g'ri sintez qilish uchun <b>maxfiy</b> (
              <Code>sk_live_…</Code>) kalit ishlating. So'rov <Code>WAV</Code> audio qaytaradi.
            </p>
            <div className="rounded-xl border border-border bg-bg-subtle/60 p-3 font-mono text-[12.5px]">
              <span className="text-accent">POST</span> /api/v1/tts
            </div>
            <p>
              <b>Sarlavha:</b> <Code>Authorization: Bearer sk_live_…</Code> ·{" "}
              <b>Tana (JSON):</b> <Code>text</Code> majburiy; <Code>engine</Code>,{" "}
              <Code>voice</Code>, <Code>speed</Code> ixtiyoriy.
            </p>
            <CodeTabs
              tabs={[
                {
                  label: "JavaScript",
                  lang: "javascript",
                  code: `const res = await fetch("__BASE__/api/v1/tts", {
  method: "POST",
  headers: {
    "Authorization": "Bearer sk_live_SIZNING_KALIT",
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    text: "Assalomu alaykum, darsni boshlaymiz.",
    engine: "piper",
  }),
});
const audioBlob = await res.blob();     // WAV
const url = URL.createObjectURL(audioBlob);
new Audio(url).play();`,
                },
                {
                  label: "PHP",
                  lang: "php",
                  code: `<?php
$ch = curl_init("__BASE__/api/v1/tts");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer sk_live_SIZNING_KALIT",
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "text" => "Assalomu alaykum, darsni boshlaymiz.",
    "engine" => "piper",
  ]),
]);
$wav = curl_exec($ch);              // WAV baytlari
file_put_contents("ovoz.wav", $wav);`,
                },
                {
                  label: "Python",
                  lang: "python",
                  code: `import requests

res = requests.post(
    "__BASE__/api/v1/tts",
    headers={"Authorization": "Bearer sk_live_SIZNING_KALIT"},
    json={"text": "Assalomu alaykum, darsni boshlaymiz.", "engine": "piper"},
)
with open("ovoz.wav", "wb") as f:
    f.write(res.content)          # WAV`,
                },
                {
                  label: "curl",
                  lang: "bash",
                  code: `curl -X POST __BASE__/api/v1/tts \\
  -H "Authorization: Bearer sk_live_SIZNING_KALIT" \\
  -H "Content-Type: application/json" \\
  -d '{"text":"Assalomu alaykum, darsni boshlaymiz.","engine":"piper"}' \\
  --output ovoz.wav`,
                },
              ]}
            />
            <p className="text-[13px]">
              To'liq texnik ma'lumot (barcha maydonlar, javob sarlavhalari):{" "}
              <Link href="/api-docs" className="text-accent hover:underline">
                interaktiv API hujjati
              </Link>{" "}
              (Swagger).
            </p>
          </Section>

          {/* ───── Kalit turlari ───── */}
          <Section id="kalitlar" icon={KeyRound} title="Kalit turlari — muhim">
            <p>
              Ikki xil kalit bor va ularni chalkashtirmaslik xavfsizlik uchun muhim:
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-danger/30 bg-danger/5 p-4">
                <div className="font-mono text-[13px] font-semibold text-fg">sk_live_…</div>
                <div className="mt-0.5 text-[12px] font-medium text-danger">Maxfiy</div>
                <p className="mt-2 text-[13px]">
                  Faqat serverda ishlating (backend, .env fayl). To'liq huquq. Brauzerga —
                  HTML, JavaScript, vidjetga — <b>hech qachon</b> qo'ymang.
                </p>
              </div>
              <div className="rounded-xl border border-success/30 bg-success/5 p-4">
                <div className="font-mono text-[13px] font-semibold text-fg">pk_live_…</div>
                <div className="mt-0.5 text-[12px] font-medium text-success">Ommaviy</div>
                <p className="mt-2 text-[13px]">
                  Vidjet va brauzer uchun. Faqat siz ro'yxatdan o'tkazgan domendan ishlaydi —
                  o'g'irlansa ham begona saytda foydasiz.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-2 rounded-xl border border-accent/30 bg-accent/5 p-3 text-[13px]">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              <span>
                <b className="text-fg">Nega ikkitasi?</b> Brauzerdagi kodni har kim ko'ra
                oladi. Maxfiy kalit u yerda tursa, uni o'g'irlab hisobingizdan cheksiz sintez
                qilishadi. Ommaviy kalit esa domenga bog'langani uchun o'g'irlash foydasiz.
              </span>
            </div>
          </Section>

          {/* ───── Ovoz dvigatellari ───── */}
          <Section id="ovozlar" icon={AudioLines} title="Ovoz dvigatellari">
            <p>
              <Code>engine</Code> maydoni qaysi model ovoz chiqarishini belgilaydi:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-muted/60 text-left text-fg">
                  <tr>
                    <th className="px-3 py-2 font-semibold">engine</th>
                    <th className="px-3 py-2 font-semibold">Ovoz</th>
                    <th className="px-3 py-2 font-semibold">Tezlik</th>
                    <th className="px-3 py-2 font-semibold">Qachon</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <EngineRow
                    e="piper"
                    v="Nativ o'zbek (ayol)"
                    s="Juda tez"
                    w="Standart tanlov — x, gʻ, q to'g'ri"
                  />
                  <EngineRow e="mms" v="Erkak / ayol" s="Tez" w="Boshqa ovoz kerak bo'lsa" />
                  <EngineRow
                    e="f5"
                    v="Tabiiy ayol"
                    s="Sekinroq"
                    w="Eng tabiiy ohang (GPU)"
                  />
                  <EngineRow e="xtts" v="Ko'p tilli" s="Sekin" w="Eski, klonlash uchun" />
                </tbody>
              </table>
            </div>
            <p className="text-[13px]">
              Ishonchingiz komil bo'lmasa — <Code>piper</Code> ni ishlating. U tez, o'zbek
              tovushlarini to'g'ri talaffuz qiladi va serverda alohida GPU talab qilmaydi.
            </p>
          </Section>

          {/* ───── Xatolar ───── */}
          <Section id="xatolar" icon={AlertTriangle} title="Xatolar">
            <p>
              So'rov muvaffaqiyatsiz bo'lsa, javob <Code>JSON</Code> bo'ladi va{" "}
              <Code>error</Code> maydonida o'zbekcha sabab turadi. Asosiy holatlar:
            </p>
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-bg-muted/60 text-left text-fg">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Kod</th>
                    <th className="px-3 py-2 font-semibold">Ma'nosi</th>
                    <th className="px-3 py-2 font-semibold">Yechim</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <ErrRow c="401" m="Kalit yo'q yoki yaroqsiz" f="Kalitni tekshiring" />
                  <ErrRow
                    c="403"
                    m="Ommaviy kalit ruxsatsiz domendan"
                    f="Domenni kalitga qo'shing"
                  />
                  <ErrRow c="402" m="Kredit yetarli emas" f="Balansni to'ldiring" />
                  <ErrRow
                    c="429"
                    m="So'rovlar juda tez-tez"
                    f="Retry-After sarlavhasicha kuting"
                  />
                  <ErrRow c="400" m="Matn bo'sh yoki 5000 belgidan uzun" f="Matnni bo'laklang" />
                  <ErrRow c="503" m="Sintez xizmati ishlamayapti" f="Biroz kutib qayta urinib ko'ring" />
                </tbody>
              </table>
            </div>
          </Section>

          {/* ───── Limitlar ───── */}
          <Section id="limitlar" icon={Gauge} title="Limitlar">
            <ul className="grid gap-2 sm:grid-cols-2">
              <Limit label="Bir so'rovdagi matn" value="5 000 belgigacha" />
              <Limit label="Kredit" value="1 belgi = 1 kredit (vip/admin cheksiz)" />
              <Limit label="Maxfiy kalit tezligi" value="120 so'rov / daqiqa" />
              <Limit label="Ommaviy kalit tezligi" value="30 so'rov / daqiqa" />
            </ul>
            <p className="text-[13px]">
              Har javobda <Code>X-Credit-Balance</Code> (qolgan kredit) va{" "}
              <Code>X-RateLimit-Remaining</Code> (shu daqiqada qolgan so'rovlar) sarlavhalari
              bo'ladi.
            </p>
          </Section>

          {/* CTA */}
          <div className="rounded-2xl border border-accent/30 bg-accent/5 p-5">
            <div className="text-sm font-semibold">Kalit yaratishga tayyormisiz?</div>
            <p className="mt-1 text-sm text-fg-muted">
              Kabinetda bir daqiqada kalit oling va yuqoridagi misolni ishga tushiring.
            </p>
            <Link
              href="/cabinet/api-kalitlar"
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg brand-gradient px-3.5 py-2 text-[13px] font-medium text-white shadow-glow transition hover:opacity-90"
            >
              API kalitlar bo'limi
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/12 text-[12px] font-semibold text-accent">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-semibold text-fg">{title}</div>
        <div className="mt-1 text-[13px] text-fg-muted">{children}</div>
      </div>
    </li>
  );
}

function AttrRow({ a, d, m }: { a: string; d: string; m: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-[12px] text-fg">{a}</td>
      <td className="px-3 py-2 font-mono text-[12px] text-fg-muted">{d}</td>
      <td className="px-3 py-2 text-fg-muted">{m}</td>
    </tr>
  );
}

function EngineRow({ e, v, s, w }: { e: string; v: string; s: string; w: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-[12px] font-medium text-fg">{e}</td>
      <td className="px-3 py-2 text-fg-muted">{v}</td>
      <td className="px-3 py-2 text-fg-muted">{s}</td>
      <td className="px-3 py-2 text-fg-muted">{w}</td>
    </tr>
  );
}

function ErrRow({ c, m, f }: { c: string; m: string; f: string }) {
  return (
    <tr>
      <td className="px-3 py-2 font-mono text-[12px] font-semibold text-fg">{c}</td>
      <td className="px-3 py-2 text-fg-muted">{m}</td>
      <td className="px-3 py-2 text-fg-muted">{f}</td>
    </tr>
  );
}

function Limit({ label, value }: { label: string; value: string }) {
  return (
    <li className="rounded-xl border border-border bg-bg-subtle/60 p-3">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
        {label}
      </div>
      <div className="mt-0.5 text-[13px] text-fg">{value}</div>
    </li>
  );
}
