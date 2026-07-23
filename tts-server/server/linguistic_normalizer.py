"""
O'zbek matn linguistik normalizatsiya:
   - Raqamlar  → so'z bilan ("19" → "o'n to'qqiz")
   - Vaqtlar   → tabiiy gap ("19:30" → "kechqurun soat yetti yarim")
   - Belgilar  → so'z ("+" → "qo'shuv", "%" → "foiz")
   - Sanalar   → so'z ("2026-yil" → "ikki ming yigirma oltinchi yil")
   - Tartib    → so'z ("1-bosqich" → "birinchi bosqich")

Bu modul matnni TTS modeliga yuborishdan oldin "human readable" qiladi —
shunda model "19:30" deb yozilgan narsani "o'n to'qqiz ikki nuqta o'ttiz" deb
emas, balki "kechqurun yetti yarim" deb tabiiy o'qiydi.
"""

import re

try:
    from server.lexicon import apply_lexicon
except ImportError:  # to'g'ridan-to'g'ri ishga tushirilganda
    from lexicon import apply_lexicon

# Asosiy raqam so'zlari
UZBEK_DIGITS = ["nol", "bir", "ikki", "uch", "to'rt", "besh", "olti", "yetti", "sakkiz", "to'qqiz"]
UZBEK_TENS = ["", "o'n", "yigirma", "o'ttiz", "qirq", "ellik", "oltmish", "yetmish", "sakson", "to'qson"]


def number_to_uzbek(n: int) -> str:
    """0 dan 999_999_999 gacha bo'lgan butun sonni o'zbek tilida yozish."""
    if n < 0:
        return "minus " + number_to_uzbek(-n)
    if n == 0:
        return "nol"
    if n < 10:
        return UZBEK_DIGITS[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        if ones == 0:
            return UZBEK_TENS[tens]
        return UZBEK_TENS[tens] + " " + UZBEK_DIGITS[ones]
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        h_word = (UZBEK_DIGITS[hundreds] + " yuz") if hundreds > 1 else "yuz"
        return h_word + (" " + number_to_uzbek(rest) if rest else "")
    if n < 1_000_000:
        thousands, rest = divmod(n, 1000)
        t_word = (number_to_uzbek(thousands) + " ming") if thousands > 1 else "ming"
        return t_word + (" " + number_to_uzbek(rest) if rest else "")
    if n < 1_000_000_000:
        millions, rest = divmod(n, 1_000_000)
        # "yuz"/"ming"dan farqli — million/milliard doim "bir" oladi (1 000 000 = "bir million")
        m_word = number_to_uzbek(millions) + " million"
        return m_word + (" " + number_to_uzbek(rest) if rest else "")
    billions, rest = divmod(n, 1_000_000_000)
    b_word = number_to_uzbek(billions) + " milliard"
    return b_word + (" " + number_to_uzbek(rest) if rest else "")


def cardinal_to_ordinal(cardinal_phrase: str) -> str:
    """'yigirma besh' → 'yigirma beshinchi'."""
    if not cardinal_phrase:
        return cardinal_phrase
    words = cardinal_phrase.split()
    last = words[-1]
    # Apostrof ba'zi so'zlarning oxirida bo'ladi (to'rt → to'rtinchi)
    last_letter = last.rstrip("'`ʻʼ").rstrip()[-1] if last else ""
    suffix = "nchi" if last_letter in "aeiouöüı" else "inchi"
    words[-1] = last + suffix
    return " ".join(words)


# Kun davri (24 soat → o'zbek kun nomi)
def time_of_day(hour: int) -> str:
    """Soatga qarab kun davrini qaytarish."""
    if 5 <= hour <= 11:
        return "ertalab"
    if 12 <= hour <= 16:
        return "kunduzi"
    if 17 <= hour <= 20:
        return "kechqurun"
    if 21 <= hour <= 23:
        return "kechasi"
    return "tunda"  # 0-4


def _vowel_connector(word: str) -> str:
    """So'z oxiriga -u/-yu bog'lovchisini qo'shish ('to'qqiz'→'to'qqizu', 'olti'→'oltiyu')."""
    last = word.rstrip("'`ʻ")[-1:].lower()
    return word + ("yu" if last in "aeiouoʻ" else "u")


def time_to_uzbek(
    hour: int,
    minute: int,
    include_soat: bool = True,
    include_period: bool = True,
    suffix: str = "",
) -> str:
    """24-soat formatdagi vaqtni tabiiy, izchil o'zbek gapga aylantirish.

    Tartib: [kun davri] soat [soat] [daqiqa]. Ortidan kelgan o'zbekcha qo'shimcha
    (`da`/`dan`/`gacha`/`ga`) OXIRGI so'zga grammatik yopishadi — yolg'iz osilib
    qolmaydi. Barcha shakl qo'shimcha oladi (ilgari "chorak qoldi" + "da" g'aliz edi).

    Misol:
        time_to_uzbek(15, 30, suffix="da") → "kunduzi soat uch yarimda"
        time_to_uzbek(9, 0)                → "ertalab soat to'qqiz"
        time_to_uzbek(23, 45, suffix="da") → "kechasi soat o'n biru qirq besh daqiqada"
    """
    period = time_of_day(hour) if include_period else ""
    h12 = hour % 12 or 12
    h_word = number_to_uzbek(h12)

    parts: list[str] = []
    if period:
        parts.append(period)
    if include_soat:
        parts.append("soat")

    if minute == 0:
        parts.append(h_word + suffix)
    elif minute == 30:
        parts.append(h_word)
        parts.append("yarim" + suffix)
    else:
        parts.append(_vowel_connector(h_word))
        parts.append(number_to_uzbek(minute))
        parts.append("daqiqa" + suffix)

    return " ".join(parts).strip()


# Oy nomlari (raqam → so'z)
MONTHS = {
    1: "yanvar", 2: "fevral", 3: "mart", 4: "aprel", 5: "may", 6: "iyun",
    7: "iyul", 8: "avgust", 9: "sentyabr", 10: "oktyabr", 11: "noyabr", 12: "dekabr",
}

# Matematik belgilar
MATH_SYMBOLS = {
    "+": "qo'shuv",
    "−": "ayirish",
    "=": "teng",
    "×": "ko'paytirilgan",
    "÷": "bo'lingan",
    "≠": "teng emas",
    "≈": "taxminan",
    "<": "kichik",
    ">": "katta",
    "≤": "kichik yoki teng",
    "≥": "katta yoki teng",
}

# Pul birliklari
CURRENCY = {
    "$": "dollar",
    "€": "yevro",
    "₽": "rubl",
    "₸": "tenge",
    "£": "funt",
    "¥": "yen",
    "so'm": "so'm",
}

# Boshqa belgilar
OTHER_SYMBOLS = {
    "°": "gradus",
    "%": "foiz",
    "‰": "promille",
    "&": "va",
    "@": "et",
    "№": "raqam",
}


_PERIOD_WORDS = {"ertalab", "kunduzi", "kechqurun", "kechasi", "tunda", "tushlikda"}


def normalize_times(text: str) -> str:
    """HH:MM formatdagi vaqtlarni so'zga aylantirish.

    Agar matnda allaqachon 'soat' yoki kun davri so'zi ('ertalab', 'kechqurun', ...)
    bo'lsa, ularni qaytarmaymiz.
    """
    def repl(m):
        hour = int(m.group(1))
        minute = int(m.group(2))
        if not (0 <= hour <= 23 and 0 <= minute <= 59):
            return m.group(0)
        suffix = m.group(3) or ""  # ortidagi da/dan/gacha/ga — vaqt so'ziga yopishtiramiz
        # Vaqtdan oldingi so'zni tekshirish (oxirgi 1-2 so'z)
        before = text[: m.start()].rstrip()
        last_word = ""
        prev_word = ""
        words = before.split()
        if words:
            last_word = words[-1].lower().strip(".,!?;:")
        if len(words) >= 2:
            prev_word = words[-2].lower().strip(".,!?;:")
        has_soat = last_word == "soat" or prev_word == "soat"
        has_period = last_word in _PERIOD_WORDS or prev_word in _PERIOD_WORDS
        # "soat" oldindan bo'lsa kun davrini ham qo'shmaymiz — "soat kunduzi..." g'aliz
        # tartibning oldini olish uchun (foydalanuvchi "soat X" shaklini xohlagan).
        return time_to_uzbek(
            hour,
            minute,
            include_soat=not has_soat,
            include_period=not has_period and not has_soat,
            suffix=suffix,
        )
    # Vaqt + ixtiyoriy o'zbekcha qo'shimcha (uzunroq variant avval: dagi/dan/gacha)
    return re.sub(r"\b(\d{1,2}):(\d{2})(?:\s+(dagi|dan|gacha|da|ga))?\b", repl, text)


def normalize_dates(text: str) -> str:
    """Sanalarni so'zga aylantirish."""
    # 2026-05-26 yoki 2026-05-26 yil → "ikki ming yigirma oltinchi yilning beshinchi oyi yigirma oltinchisi"
    # Soddaroq: 2026-yil → "ikki ming yigirma oltinchi yil"
    # 26-may → "yigirma oltinchi may"
    # 26-may, 2026 → "yigirma oltinchi may ikki ming yigirma oltinchi yil"

    # YYYY-MM-DD
    def date_repl(m):
        y, mo, d = int(m.group(1)), int(m.group(2)), int(m.group(3))
        if 1 <= mo <= 12 and 1 <= d <= 31:
            # Yil ham TARTIB son + probel: ilgari "...olti-yil" chiqib, defis
            # o'qilardi va yil tartib songa aylanmasdi.
            year_word = cardinal_to_ordinal(number_to_uzbek(y))
            month_name = MONTHS[mo]
            day_ord = cardinal_to_ordinal(number_to_uzbek(d))
            return f"{day_ord} {month_name} {year_word} yil"
        return m.group(0)
    text = re.sub(r"\b(\d{4})-(\d{2})-(\d{2})\b", date_repl, text)

    # DD.MM.YYYY va DD/MM/YYYY — foydalanuvchi ENG KO'P shu shaklda yozadi.
    # Ilgari nuqta o'nlik kasr ("22.07" -> "yigirma ikki butun nol yetti") va
    # gap oxiri deb o'qilib, sana butunlay parchalanardi. Ajratgich bir xil
    # bo'lishi shart (orqaga-havola \2) — "22.07/2026" kabi aralashmasin.
    def dmy_repl(m):
        d, mo, y = int(m.group(1)), int(m.group(3)), int(m.group(4))
        if 1 <= mo <= 12 and 1 <= d <= 31 and 1000 <= y <= 9999:
            day_ord = cardinal_to_ordinal(number_to_uzbek(d))
            year_ord = cardinal_to_ordinal(number_to_uzbek(y))
            return f"{day_ord} {MONTHS[mo]} {year_ord} yil"
        return m.group(0)
    text = re.sub(r"\b(\d{1,2})([./])(\d{1,2})\2(\d{4})\b", dmy_repl, text)

    # N-yil ("2026-yil" yoki "1995-yilda")
    def year_repl(m):
        y = int(m.group(1))
        suffix = m.group(2) or ""
        if 1000 <= y <= 9999:
            year_word = number_to_uzbek(y)
            ord_word = cardinal_to_ordinal(year_word)
            return f"{ord_word} yil{suffix}"
        return m.group(0)
    text = re.sub(r"\b(\d{4})-yil(da|i|ning|ga|dan)?\b", year_repl, text)

    # N-may, N-yanvar va h.k. Kelishik qo'shimchasi bilan ham ("14-iyulda"):
    # qo'shimchasiz \b oy nomidan keyin uzilib, namuna mos kelmay qolardi va
    # "o'n to'rt-iyulda" (defis o'qiladi, tartib son yo'q) chiqardi.
    # Imlo variantlari: "sentabr"/"oktabr" (y'siz) ham keng yoziladi. Faqat
    # TANIB OLISH uchun — chiqishda foydalanuvchi yozgan shakl saqlanadi.
    month_spellings = list(MONTHS.values()) + ["sentabr", "oktabr"]
    months_alt = "|".join(sorted(month_spellings, key=len, reverse=True))
    def day_month_repl(m):
        d = int(m.group(1))
        month_name = m.group(2)
        suffix = m.group(3) or ""
        if 1 <= d <= 31:
            day_ord = cardinal_to_ordinal(number_to_uzbek(d))
            return f"{day_ord} {month_name}{suffix}"
        return m.group(0)
    # Uzunroq qo'shimchalar avval: "dagi" < "dan" < "da", "gacha" < "ga".
    text = re.sub(rf"\b(\d{{1,2}})-({months_alt})(dagi|dan|gacha|da|ga|ning|i)?\b",
                  day_month_repl, text)

    return text


def normalize_ordinals(text: str) -> str:
    """N-(bosqich|qator|...) → "Ninchi (bosqich|...)" """
    # Ilgari bu qat'iy ro'yxat edi va ro'yxatda yo'q ot uchun ishlamasdi:
    # "1-o'rin" -> "bir-o'rin" (tartib son yo'q, defis o'qiladi). Sana, diapazon va
    # oy nomlari BU BOSQICHDAN OLDIN qayta ishlangani uchun bu yerda qolgan
    # "<son>-<so'z>" deyarli har doim tartib son bo'ladi — umumlashtiramiz.
    def repl(m):
        n = int(m.group(1))
        noun = m.group(2)
        ord_word = cardinal_to_ordinal(number_to_uzbek(n))
        return f"{ord_word} {noun}"
    return re.sub(r"\b(\d+)-([^\W\d_][\w'ʻʼ’]{1,})\b", repl, text, flags=re.UNICODE)


_ROMAN_MAP = {"I": 1, "V": 5, "X": 10, "L": 50, "C": 100, "D": 500, "M": 1000}
_ROMAN_PAT = r"(?=[MDCLXVI])M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})"
_ROMAN_NOUNS = ["asr", "bob", "jild", "qism", "tip", "guruh", "sinf", "kurs", "tom", "jahon"]


def roman_to_int(s: str) -> int:
    total, prev = 0, 0
    for ch in reversed(s.upper()):
        v = _ROMAN_MAP.get(ch, 0)
        if v < prev:
            total -= v
        else:
            total += v
            prev = v
    return total


def normalize_roman(text: str) -> str:
    """Rim raqami + kontekst so'z (asr/bob/...) → tartib son.

    Faqat BOSH HARFLI rim raqamlari va aniq kontekst bilan — oddiy harf/o'zgaruvchi
    (X, V) tasodifan buzilmasligi uchun.
    """
    nouns = "|".join(_ROMAN_NOUNS)
    # Kontekst so'z + ixtiyoriy o'zbekcha qo'shimcha (asr → asrda, asrning ...)
    pat = re.compile(rf"\b({_ROMAN_PAT})[-\s]+({nouns})([a-zʻ']*)\b")

    def repl(m: re.Match) -> str:
        n = roman_to_int(m.group(1))
        if n <= 0 or n > 3000:
            return m.group(0)
        return f"{cardinal_to_ordinal(number_to_uzbek(n))} {m.group(2)}{m.group(3)}"

    return pat.sub(repl, text)


def normalize_phone_numbers(text: str) -> str:
    """Telefon raqamini RAQAMLAB o'qish: "+998 90 123 45 67".

    Aks holda har bo'lak alohida katta son bo'lib ketadi ("to'qqiz yuz to'qson
    sakkiz to'qson ming yuz yigirma uch...") va "+" o'qilmay qoladi; defisli
    shakl ("71-200-00-00") esa diapazon/matematikaga tushib "ayirish" chiqaradi.

    Diapazon va matematikadan OLDIN ishlashi shart — ular raqamni bo'lib yuboradi.
    """
    def spell(digits: str) -> str:
        return " ".join(UZBEK_DIGITS[int(d)] for d in digits if d.isdigit())

    def repl(m):
        raw = m.group(0)
        plus = "plyus " if raw.lstrip().startswith("+") else ""
        groups = re.findall(r"\d+", raw)
        # guruhlar orasida vergul = qisqa pauza (odam ham shunday o'qiydi)
        return plus + ", ".join(spell(g) for g in groups)

    # +998 90 123 45 67  /  90-123-45-67  /  71-200-00-00
    pat = re.compile(
        r"(?<![\d.,])"
        r"(?:\+\s?\d{1,3}[\s-]?)?"          # ixtiyoriy mamlakat kodi
        r"\d{2,3}[\s-]\d{2,3}[\s-]\d{2}[\s-]\d{2}"
        r"(?![\d.,])"
    )
    return pat.sub(repl, text)


def normalize_long_digit_runs(text: str) -> str:
    """Uzun raqam ketma-ketligi (JSHSHIR, karta, IMEI) — RAQAMLAB, 3 talab.

    12+ xonali xom raqam deyarli har doim identifikator: uni katta son deb
    o'qib bo'lmaydi ("bir million..."), espeak esa yopishtirib g'o'ldiraydi.
    Uch xonadan guruhlab, vergul bilan pauza qo'yamiz — odam ham shunday o'qiydi.

    Chegara 12: hech kim 12+ xonali sonni ATAYLAB xom kardinal qilib yozmaydi
    (ajratgichsiz), demak minglik guruhlash (250 000) buzilmaydi. Telefondan
    KEYIN, lekin minglik guruh birlashtirishdan OLDIN — u ajratgichlarni yo'qotib
    12 xonali qoldiq yaratishi mumkin (masalan "1 000 000 000" -> "1000000000").
    """
    def repl(m):
        d = m.group(0)
        chunks = [d[i:i + 3] for i in range(0, len(d), 3)]
        return ", ".join(" ".join(UZBEK_DIGITS[int(c)] for c in ch) for ch in chunks)
    return re.sub(r"(?<![\d.,+\-])\d{12,}(?![\d.,])", repl, text)


def normalize_negative_numbers(text: str) -> str:
    """Manfiy son: "-15°C" -> "minus o'n besh ...".

    Ilgari minus belgisi xom holicha qolib, o'qilmasdan tushib qolardi
    (harorat matnida ma'no teskarisiga o'zgaradi). Faqat son OLDIDAN va
    gap boshi / bo'shliq / ochilgan qavsdan keyin kelganda — ayirish
    amali ("10-3") va diapazon tegilmasin.
    """
    return re.sub(r"(?<![\w\d])[-−](?=\d)", "minus ", text)


def normalize_scores(text: str) -> str:
    """Sport hisobi "3:2" -> "uch, ikki" (vergul = pauza).

    normalize_times'dan KEYIN ishlaydi: haqiqiy vaqt ("14:35") allaqachon
    o'zgargan bo'ladi, bu yerda faqat vaqt bo'lmagan qoldiq qoladi. Ilgari
    ikki nuqta xom holicha qolardi ("uch:ikki").
    """
    return re.sub(r"\b(\d{1,3}):(\d{1,3})\b", r"\1, \2", text)


def normalize_ranges(text: str) -> str:
    """Son DIAPAZONI — "1941-1945-yillar", "10-15 kishi".

    normalize_math() `\\d+-\\d+` ni ayirish deb oladi va "ming to'qqiz yuz qirq bir
    AYIRISH ming to'qqiz yuz qirq besh" chiqaradi. Tarixiy/statistik matnda bu
    juda ko'p uchraydi, shuning uchun diapazon math'dan OLDIN ajratib olinadi.

    Ayirishdan farqi: diapazonda defis atrofida probel yo'q va ifodada `=` yo'q
    ("10-3=7" matematika bo'lib qoladi).
    """
    # 1) Yil diapazoni -> ikkala son TARTIB songa ("qirq birinchi ... beshinchi yillar")
    def year_range(m):
        a, b, suf = int(m.group(1)), int(m.group(2)), m.group(3) or ""
        oa = cardinal_to_ordinal(number_to_uzbek(a))
        ob = cardinal_to_ordinal(number_to_uzbek(b))
        return f"{oa}, {ob} yil{suf}"   # vergul = pauza, aks holda bitta uzun son
    text = re.sub(r"\b(\d{4})\s*[-–—]\s*(\d{4})-yil(lar|larda|larga|lardan|da|dagi|ga|dan|i)?\b",
                  year_range, text)

    # 2) Umumiy diapazon: defis o'rniga VERGUL — espeak uni qisqa pauza qiladi.
    #    Probelgina qo'ysak "220-250 gr" -> "ikki yuz yigirma ikki yuz ellik"
    #    bo'lib BITTA uzun son kabi eshitiladi. Odam ham bu yerda pauza qiladi.
    #    `=` ergashsa — bu matematika, tegmaymiz.
    text = re.sub(r"\b(\d{1,4})[-–—](\d{1,4})\b(?!\s*=)", r"\1, \2", text)
    return text


def collapse_numeral_duplicates(text: str) -> str:
    """Rasmiy hujjat uslubi: "3 (uch) ish kuni" -> "3 ish kuni".

    Hujjatlarda son ham raqam, ham so'z bilan yoziladi. Ikkalasini ham o'qisak
    "uch (uch) ish kuni" bo'lib chiqadi — tester buni darrov sezadi.
    Qavs ichidagi matn AYNAN o'sha sonning so'z shakli bo'lgandagina olib
    tashlanadi (boshqa izohli qavslar tegilmaydi).
    """
    def repl(m):
        num, inner = m.group(1), m.group(2).strip()
        try:
            if inner.lower() == number_to_uzbek(int(num)).lower():
                return num
        except (ValueError, KeyError):
            pass
        return m.group(0)
    return re.sub(r"\b(\d{1,9})\s*\(([^()]{1,30})\)", repl, text)


def normalize_math(text: str) -> str:
    """5+3=8 → 'besh qo'shuv uch teng sakkiz'

    Iterativ qo'llaniladi — chain holatda (5+3=8) hammasi o'zgaradi.
    """
    pattern = re.compile(r"(\d+(?:[.,]\d+)?)\s*([+\-×÷*/=<>])\s*(\d+(?:[.,]\d+)?)")
    prev = None
    while prev != text:
        prev = text
        text = pattern.sub(lambda m: f"{m.group(1)} {_op_word(m.group(2))} {m.group(3)}", text)
    return text


def _op_word(op: str) -> str:
    mapping = {
        "+": "qo'shuv", "-": "ayirish", "−": "ayirish",
        "×": "ko'paytirilgan", "*": "ko'paytirilgan",
        "÷": "bo'lingan", "/": "bo'lingan",
        "=": "teng", "<": "kichik", ">": "katta",
    }
    return mapping.get(op, op)


def normalize_percent(text: str) -> str:
    """100% → 'yuz foiz'"""
    return re.sub(r"(\d+(?:[.,]\d+)?)\s*%", lambda m: f"{m.group(1)} foiz", text)


def normalize_symbols(text: str) -> str:
    """Qolgan belgilar: °, & va h.k."""
    for sym, word in OTHER_SYMBOLS.items():
        if sym in text and sym not in "%":  # % alohida
            # Faqat alphanumeric tomonida bo'lsa o'zgartiramiz
            text = text.replace(sym, f" {word} ")
    return text


def normalize_decimal_numbers(text: str) -> str:
    """O'nlik kasrlar: '92,3' → 'to'qson ikki butun uch', '2,5' → 'ikki yarim'.

    O'zbekchada o'nlik kasr 'butun' bilan o'qiladi — 'vergul'/'nuqta' tinish belgisi
    nomlari bo'lib, sun'iy eshitiladi. Maxsus holat: ',5' → 'yarim' (tabiiy).
    """
    def repl(m):
        whole = int(m.group(1))
        frac = m.group(2)
        whole_word = number_to_uzbek(whole)
        # ,5 yoki .5 → yarim ("ikki yarim"); butun qism nol bo'lsa faqat "yarim"
        if frac == "5":
            return "yarim" if whole == 0 else f"{whole_word} yarim"
        # Kasr qismi: ko'p raqamli va boshida nol yo'q bo'lsa — butun son sifatida
        # ("14"→"o'n to'rt", "45"→"qirq besh"); aks holda raqamlab (nolni saqlash: "05"→"nol besh")
        if len(frac) >= 2 and frac[0] != "0":
            frac_words = number_to_uzbek(int(frac))
        else:
            frac_words = " ".join(UZBEK_DIGITS[int(d)] for d in frac if d.isdigit())
        return f"{whole_word} butun {frac_words}"
    return re.sub(r"\b(\d+)[.,](\d+)\b", repl, text)


def normalize_grouped_numbers(text: str) -> str:
    """Bo'sh joy bilan ajratilgan minglik guruhlarni bitta songa birlashtirish.

    '250 000' → '250000', '461 750 000' → '461750000', '1 847' → '1847'.
    Aks holda har guruh alohida o'qilib "ikki yuz ellik nol" kabi xato chiqadi.
    Oddiy/uzun/tor bo'sh joy (' ', NBSP, NNBSP) ajratkichlarini qo'llab-quvvatlaydi.
    Faqat 1-3 raqamli bosh guruh + 3 raqamli guruhlar (standart tipografiya) —
    telefon raqami (+998 90 ...) yoki yil kabi 4 raqamli sonlar tegilmaydi.
    """
    sep = r"[     ]"  # oddiy, NBSP, NNBSP, ingichka, raqam boshligi
    text = re.sub(
        rf"\b\d{{1,3}}(?:{sep}\d{{3}})+\b",
        lambda m: re.sub(sep, "", m.group(0)),
        text,
    )
    # Vergul/nuqta bilan ajratilgan minglik ("1,433,230" / "1.433.230").
    # KAMIDA IKKI guruh talab qilinadi: "3,14" o'zbekchada o'nlik kasr — uni
    # minglik deb olsak xato bo'ladi. Ikki guruhdan boshlab ma'no bir xil
    # ("1,433,230" hech qachon kasr emas). Oldin: "bir butun to'rt yuz o'ttiz uch,..."
    text = re.sub(r"\b\d{1,3}(?:,\d{3}){2,}\b", lambda m: m.group(0).replace(",", ""), text)
    text = re.sub(r"\b\d{1,3}(?:\.\d{3}){2,}\b", lambda m: m.group(0).replace(".", ""), text)
    return text


# Qisqartma yoyilmasi oxiridagi so'zlar — foydalanuvchi ularni takrorlashi mumkin
# ("QQS solig'i" → "...solig'i solig'i"). Faqat shu oq ro'yxatdagi ketma-ket takror yig'iladi
# (o'zbekcha ta'kid takrori "juda juda"/"bir-bir" buzilmasligi uchun umumiy dedup EMAS).
_ABBR_TAIL_DUPES = [
    "solig'i", "solig'ini", "solig'ining", "jamiyat", "jamiyati", "vazirligi",
    "vazirligining", "tashkiloti", "tashkilotining", "markazi", "markazining",
    "hamdo'stligi", "muassasasi", "raqami", "solig‘i",
]


def collapse_abbrev_tail_dupes(text: str) -> str:
    """Qisqartma yoyilmasidan kelib chiqqan ketma-ket so'z takrorini yig'ish."""
    for w in _ABBR_TAIL_DUPES:
        text = re.sub(rf"\b({re.escape(w)})\s+{re.escape(w)}\b", r"\1", text, flags=re.IGNORECASE)
    return text


def normalize_integers(text: str) -> str:
    """Qolgan butun sonlarni so'zga aylantirish (oxirgi qadam)."""
    def repl(m):
        n_str = m.group(0)
        try:
            n = int(n_str)
            if n > 999_999_999_999:
                return n_str  # juda katta — qo'lda qo'yib qo'yamiz
            return number_to_uzbek(n)
        except ValueError:
            return n_str
    # Faqat alohida turgan raqamlarni almashtiramiz (so'z ichidagi emas)
    return re.sub(r"\b\d+\b", repl, text)


def normalize_uzbek_text(text: str) -> str:
    """Asosiy entry — barcha normalizatsiyalarni tartibli qo'llash.

    Tartib muhim:
    1. Sanalar (eng aniq pattern) — avval, raqamlar yo'q bo'lishidan oldin
    2. Vaqtlar (HH:MM)
    3. Tartib raqamlar (N-bosqich)
    4. Matematik ifodalar (5+3=8)
    5. Foiz (100%)
    6. O'nlik kasrlar (3.14)
    7. Qolgan belgilar (°, & va h.k.)
    8. Yakuniy: qolgan butun sonlarni so'zga (eng oxirgi)
    """
    # 0. Lug'at qatlami: qisqartma/valyuta/birlik/chet so'zlar (raqamlarga tegmaydi)
    text = apply_lexicon(text)
    # 0.1. Qisqartma yoyilmasidagi ketma-ket so'z takrorini yig'ish ("solig'i solig'i")
    text = collapse_abbrev_tail_dupes(text)
    # 0.5. Ilmiy/matematik ifodalar (x², √, ∫, π, m/s², 10⁻³...) — sonlar so'zga
    # aylanishidan OLDIN belgilarni so'zga aylantiramiz (lazy import: circular'dan saqlanish).
    try:
        from server.sci_normalizer import normalize_scientific
    except ImportError:
        from sci_normalizer import normalize_scientific
    text = normalize_scientific(text)
    # Telefon ENG AVVAL: normalize_grouped_numbers "90 123" ni "90123" deb
    # birlashtirib yuboradi va raqam telefon bo'lmay qoladi.
    text = normalize_phone_numbers(text)
    # Uzun ID (12+ xona) — telefondan KEYIN, guruh birlashtirishdan OLDIN
    text = normalize_long_digit_runs(text)
    # Bo'sh joyli minglik guruhlari ("250 000") — raqamlarni o'qishdan OLDIN birlashtirish
    text = normalize_grouped_numbers(text)
    text = normalize_roman(text)
    text = normalize_dates(text)
    text = normalize_times(text)
    text = normalize_scores(text)
    # Manfiy son diapazon/matematikadan KEYIN: "10-3" ayirish bo'lib qolsin
    text = normalize_negative_numbers(text)
    # Diapazon MANA SHU YERDA bo'lishi shart:
    #   - normalize_dates'dan KEYIN — aks holda "2026-05-26" sanasi "2026 05" bo'lib parchalanadi
    #   - normalize_ordinals'dan OLDIN — u "1945-yillar"ni yolg'iz o'zi yeb qo'yadi va
    #     "1941-" osilib qoladi ("...qirq bir-ming to'qqiz yuz qirq beshinchi yillar")
    #   - normalize_math'dan OLDIN — aks holda "1941-1945" = "... ayirish ..."
    text = normalize_ranges(text)
    # "3 (uch)" — sonlar so'zga aylanishidan OLDIN, raqam shakli hali turganda
    text = collapse_numeral_duplicates(text)
    text = normalize_ordinals(text)
    text = normalize_math(text)
    text = normalize_percent(text)
    text = normalize_decimal_numbers(text)
    text = normalize_symbols(text)
    text = normalize_integers(text)
    # Bo'shliqlarni tozalash
    text = re.sub(r"\s+", " ", text).strip()
    return text


if __name__ == "__main__":
    tests = [
        "Hozir soat 19:30.",
        "Ertalab 09:00 da uchrashamiz.",
        "Kechqurun 21:45 da darsim bor.",
        "Tushlikda soat 13:15 ga uchrashamiz.",
        "5+3=8 va 10-4=6 boʻladi.",
        "Mening yoshim 25 da.",
        "Universitetga 1995-yilda kirganman.",
        "Bu yil 2026-yil, 26-may.",
        "Birinchi sinfda 30 ta o'quvchi bor.",
        "1-bosqich, 2-bosqich, 3-bosqich.",
        "Bahodir 100% to'g'ri javob berdi.",
        "Narxi 50000 so'm yoki 5 dollar.",
        "PI = 3.14 va Avogadro soni 6.022 ga teng.",
        "Yoshim 18.5 ga teng emas, 19 ga teng.",
        "Bugun soat 23:30 da uxlaymiz.",
    ]
    print("Linguistik normalizatsiya testi:\n")
    for t in tests:
        n = normalize_uzbek_text(t)
        print(f"  IN:  {t}")
        print(f"  OUT: {n}")
        print()
