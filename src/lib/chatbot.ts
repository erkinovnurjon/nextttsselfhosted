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
- "MENING OVOZIM" (eng muhim funksiya): foydalanuvchi o'z ovozidan model tayyorlaydi — tizim uni ZERO-SHOT klonlaydi (alohida og'ir trening shart emas, soniyalarda tayyor), keyin istalgan matnni O'Z OVOZIDA eshitishi mumkin. Joyi: kabinet → "Mening ovozim". IKKI USUL bor:
  • Ovoz yozdirish: sahifada ko'rsatilgan tayyor jumlalarni ~20-30 soniya mikrofonga o'qib beriladi → darhol klonlanadi.
  • Video yoki qo'shiqdan: gapirayotgan odam bo'lgan video/audio HAVOLASINI (masalan YouTube) qo'yadi YOKI faylni yuklaydi → AI ovozni avtomatik ajratib oladi (musiqa/shovqindan tozalaydi) va klonlaydi. Bu ~1-2 daqiqa. Eng yaxshi natija — aniq gapirayotgan yakka ovoz (intervyu/vlog).
  Har ikki usuldan keyin "Sinab ko'rish" tugmasi yoki "Matndan nutq → Mening ovozim"ni tanlab o'z ovozida eshitiladi. Yangi klon oldingi shaxsiy ovozни almashtiradi.
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

  if (has("video", "youtube", "qo'shiq", "qoshiq", "havola", "url", "fayl", "видео", "yukla"))
    return "Video yoki qo'shiqdan ovoz klonlash: Kabinet → “Mening ovozim” → “Video yoki qo'shiqdan klonlash” bo'limiga video/audio havolasini (masalan YouTube) qo'ying yoki faylni yuklang → “Ajratib klonlash”. AI ovozni avtomatik ajratib oladi (~1-2 daqiqa). Eng yaxshi natija — aniq gapirayotgan yakka ovoz (intervyu/vlog).";
  if (has("mening ovoz", "o'z ovoz", "oz ovoz", "klon", "clone", "мой голос", "my voice", "model tayyor", "ovozimdan"))
    return "“Mening ovozim”da o'z ovozingizdan model tayyorlaysiz — 2 usul: (1) Kabinet → “Mening ovozim” → ko'rsatilgan jumlalarni ~20-30 soniya o'qib yozing; yoki (2) gapirayotgan video/qo'shiq havolasini qo'ying/faylni yuklang — AI ovozni ajratib oladi. So'ng “Sinab ko'rish” yoki “Matndan nutq → Mening ovozim” bilan istalgan matnni o'z ovozingizda eshitasiz.";
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
