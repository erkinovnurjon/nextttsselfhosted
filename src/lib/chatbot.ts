// NextTTS loyiha-yordamchi chatbot: system prompt + API-kalitsiz FAQ fallback.
// Server-only (route handler ichida ishlatiladi).

export const CHATBOT_MODEL = process.env.CHATBOT_MODEL || "claude-opus-4-8";

// Loyiha bilimlari — bot FAQAT NextTTS haqida javob beradi.
const PROJECT_FACTS = `
NextTTS — o'zbek tilida matnni tabiiy nutqqa aylantiruvchi self-hosted platforma
(asosan OTM/universitet talabalari uchun MVP).

ASOSIY IMKONIYATLAR:
- Matndan nutq (sintez): kabinet → "Matndan nutq" → matn yoziladi, ovoz tanlanadi, tezlik sozlanadi, eshitiladi va WAV yuklab olinadi.
- Ovozlar:
  • "Ayol (nativ)" / Piper — nativ o'zbek ayol ovozi, tez (CPU), x/gʻ/q to'g'ri talaffuz; standart tanlov.
  • F5 ovozlari (Feruza, Jonli, Ayol) — tabiiy, iliq ayol ovozlari (sekinroq, GPU).
  • "Erkak" va "Asosiy" (MMS) — tez ovozlar.
- "MENING OVOZIM" (eng muhim funksiya): foydalanuvchi 4 ta jumlani o'qib ~20-30 soniya o'z ovozini yozdiradi → tizim uni ZERO-SHOT klonlaydi (alohida og'ir trening shart emas, soniyalarda tayyor) → keyin istalgan matnni O'Z OVOZIDA eshitishi mumkin. Joyi: kabinet → "Mening ovozim". Yozib bo'lgach "Sinab ko'rish" yoki "Matndan nutq → Mening ovozim".
- Nutqdan matn (transkripsiya): mikrofonga gapirish yoki audio yuklash → matn (Whisper).
- Balans/kredit: 1 kredit = 1 belgi. Ro'yxatdan o'tganda 10 000 kredit bonus. To'ldirish Payme yoki Click orqali (kabinet → Balans). VIP/admin = cheksiz.
- Tillar: o'zbek, rus, ingliz. Mavzu: yorug'/qorong'i.
- Hisob: username yoki email bilan ro'yxatdan o'tish/kirish.
`.trim();

export function buildSystemPrompt(lang: string): string {
  const langName =
    lang === "ru" ? "ruscha" : lang === "en" ? "inglizcha" : "o'zbekcha";
  return `Sen — NextTTS platformasining yordamchi chatbotisan. Vazifang: foydalanuvchilarga NextTTS'dan qanday foydalanishni tushuntirish va savollariga javob berish.

QOIDALAR:
- FAQAT NextTTS (bu platforma) haqida javob ber. Mavzudan tashqari savol (umumiy bilim, boshqa mahsulotlar, kod yozish va h.k.) berilsa, muloyimlik bilan rad et va NextTTS bo'yicha yordam taklif qil.
- Foydalanuvchining tilida javob ber. Interfeys tili hozir: ${langName}. Savol boshqa tilda bo'lsa, o'sha tilda javob ber.
- QISQA va aniq javob ber (odatda 1-4 jumla). Ortiqcha muqaddima ("Albatta!", "Mana...") ishlatma — to'g'ridan-to'g'ri javobdan boshla. Markdown sarlavhalar shart emas.
- Faqat quyidagi ma'lumotlarga asoslan. Bilmagan narsangni o'ylab topma; aniq bo'lmasa, "buni aniq bilmayman, qo'llab-quvvatlash bilan bog'laning" deb ayt.
- Iloji boricha aniq qadamlarni ko'rsat (masalan: "Kabinet → Mening ovozim").

NEXTTTS HAQIDA MA'LUMOT:
${PROJECT_FACTS}`;
}

// API kaliti yo'q bo'lsa — oddiy kalit-so'z bo'yicha FAQ (pilot ishlashda davom etsin).
export function faqFallback(question: string): string {
  const q = question.toLowerCase();
  const has = (...ws: string[]) => ws.some((w) => q.includes(w));

  if (has("mening ovoz", "o'z ovoz", "oz ovoz", "klon", "clone", "мой голос", "my voice"))
    return "“Mening ovozim” bilan o'z ovozingizni klonlashingiz mumkin: Kabinet → “Mening ovozim” → ko'rsatilgan jumlalarni ~20-30 soniya o'qib yozing → “Sinab ko'rish”. Keyin “Matndan nutq”da “Mening ovozim”ni tanlab, istalgan matnni o'z ovozingizda eshitasiz.";
  if (has("ovoz", "voice", "голос"))
    return "NextTTS'da bir nechta ovoz bor: nativ o'zbek ayol (Piper, tez), tabiiy F5 ayol ovozlari, erkak va tez MMS ovozlari, hamda o'zingiz klonlagan “Mening ovozim”. Kabinet → “Matndan nutq”da tanlanadi.";
  if (has("balans", "kredit", "to'lov", "tolov", "to'la", "pul", "payme", "click", "баланс", "оплат", "credit", "pay"))
    return "1 kredit = 1 belgi. Ro'yxatdan o'tganda 10 000 kredit bonus olasiz. Balansni Payme yoki Click orqali to'ldirasiz: Kabinet → Balans.";
  if (has("transkrip", "nutqdan matn", "matnga", "speech to text", "распозна"))
    return "Nutqdan matn: Kabinet → “Nutqdan matn” bo'limida mikrofonga gapiring yoki audio yuklang — matnga aylantiriladi.";
  if (has("til", "language", "язык", "rus", "ingliz", "english"))
    return "NextTTS o'zbek, rus va ingliz tillarini qo'llab-quvvatlaydi. Tilni kabinet yuqorisidagi til almashtirgichdan o'zgartirasiz.";
  if (has("ro'yxat", "royxat", "kirish", "login", "register", "akkaunt", "hisob", "регистр", "войти"))
    return "Username yoki email bilan ro'yxatdan o'tib/kirib, kabinetdan barcha imkoniyatlardan foydalanasiz. Yangi foydalanuvchiga 10 000 kredit bonus.";

  return "Salom! Men NextTTS yordamchisiman. Matndan nutq, ovozlar, “Mening ovozim” (ovoz klonlash), nutqdan matn yoki balans bo'yicha savol bering. (Aqlli rejim uchun administrator API kalitini sozlashi kerak.)";
}
