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
        m_word = (number_to_uzbek(millions) + " million") if millions > 1 else "million"
        return m_word + (" " + number_to_uzbek(rest) if rest else "")
    billions, rest = divmod(n, 1_000_000_000)
    b_word = (number_to_uzbek(billions) + " milliard") if billions > 1 else "milliard"
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


def time_to_uzbek(hour: int, minute: int, include_soat: bool = True, include_period: bool = True) -> str:
    """24-soat formatdagi vaqtni tabiiy o'zbek gapga aylantirish.

    Misol:
        time_to_uzbek(19, 30) → "kechqurun soat yetti yarim"
        time_to_uzbek(9, 0)   → "ertalab soat to'qqiz"
        time_to_uzbek(13, 45) → "kunduzi soat birga chorak qoldi"
        time_to_uzbek(7, 15)  → "ertalab soat yettiyu o'n besh daqiqa"
    """
    period = time_of_day(hour) if include_period else ""
    # 24 → 12 soat formatga
    h12 = hour % 12
    if h12 == 0:
        h12 = 12

    h_word = number_to_uzbek(h12)
    soat = "soat " if include_soat else ""
    prefix = (period + " ") if period else ""

    if minute == 0:
        return f"{prefix}{soat}{h_word}".strip()
    if minute == 30:
        return f"{prefix}{soat}{h_word} yarim".strip()
    if minute == 15:
        return f"{prefix}{soat}{h_word}yu o'n besh daqiqa".strip()
    if minute == 45:
        next_h = (h12 % 12) + 1
        next_word = number_to_uzbek(next_h)
        return f"{prefix}{soat}{next_word}ga chorak qoldi".strip()
    return f"{prefix}{soat}{h_word}yu {number_to_uzbek(minute)} daqiqa".strip()


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
        return time_to_uzbek(hour, minute, include_soat=not has_soat, include_period=not has_period)
    return re.sub(r"\b(\d{1,2}):(\d{2})\b", repl, text)


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
            year_word = number_to_uzbek(y)
            month_name = MONTHS[mo]
            day_ord = cardinal_to_ordinal(number_to_uzbek(d))
            return f"{day_ord} {month_name} {year_word}-yil"
        return m.group(0)
    text = re.sub(r"\b(\d{4})-(\d{2})-(\d{2})\b", date_repl, text)

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

    # N-may, N-yanvar va h.k.
    months_alt = "|".join(MONTHS.values())
    def day_month_repl(m):
        d = int(m.group(1))
        month_name = m.group(2)
        if 1 <= d <= 31:
            day_ord = cardinal_to_ordinal(number_to_uzbek(d))
            return f"{day_ord} {month_name}"
        return m.group(0)
    text = re.sub(rf"\b(\d{{1,2}})-({months_alt})\b", day_month_repl, text)

    return text


def normalize_ordinals(text: str) -> str:
    """N-(bosqich|qator|...) → "Ninchi (bosqich|...)" """
    common_nouns = ["bosqich", "qator", "marta", "soni", "kun", "oy", "yil", "asr", "guruh",
                    "darsi", "sinf", "kurs", "qism", "bo'lim", "bob", "modda", "band"]
    pattern = r"\b(\d+)-(" + "|".join(common_nouns) + r")\b"
    def repl(m):
        n = int(m.group(1))
        noun = m.group(2)
        ord_word = cardinal_to_ordinal(number_to_uzbek(n))
        return f"{ord_word} {noun}"
    return re.sub(pattern, repl, text)


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
    """3.14 → 'uch nuqta o'n to'rt', 1,5 → 'bir yarim'"""
    def repl(m):
        whole = int(m.group(1))
        frac = m.group(2)
        whole_word = number_to_uzbek(whole)
        # Maxsus holat: ,5 yoki .5 → yarim
        if frac == "5":
            return f"{whole_word} yarim"
        # Aks holda har raqamni alohida o'qish
        frac_words = " ".join(UZBEK_DIGITS[int(d)] for d in frac if d.isdigit())
        sep = "vergul" if "," in m.group(0) else "nuqta"
        return f"{whole_word} {sep} {frac_words}"
    return re.sub(r"\b(\d+)[.,](\d+)\b", repl, text)


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
    text = normalize_dates(text)
    text = normalize_times(text)
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
