"""
text_normalization.py
=====================

O'zbek tilidagi TTS (Piper / VITS / XTTS) dataset transkripsiyalarini
modelga uzatishdan oldin **production-ready** tarzda tozalash va normallashtirish moduli.

Modul vazifalari:
    1. Apostrof variantlarini bitta standart ' (ASCII) ga keltirish.
    2. Butun sonlarni o'zbek tilidagi so'zga aylantirish (milliardgacha).
    3. O'nlik kasrlar, sanalar va vaqtlarni so'z bilan ifodalash.
    4. Belgilar (%, +, -, =, $, €) va qisqartmalarni so'zga aylantirish.
    5. Umumiy tozalash: ortiqcha probellar, lowercase, strip.

Tartib muhim: avval murakkab pattern'lar (sana, vaqt, kasr), keyin oddiy
butun sonlar va belgilar, eng oxirida lowercase + whitespace tozalash.

Eslatma: bu modul *fonetik* normalizatsiya qilmaydi (q→k, o'→ö va h.k.) —
buning uchun `text_normalizer.py` (light/heavy rejim) ishlatilsin.
"""

from __future__ import annotations

import re
import unicodedata

# ---------------------------------------------------------------------------
# 1. APOSTROF STANDARTLASH
# ---------------------------------------------------------------------------

# O'zbek tilida uchraydigan barcha apostrof variantlari (Unicode kodlari bilan):
#   U+02BB  ʻ  MODIFIER LETTER TURNED COMMA (rasmiy o'zbek standarti)
#   U+02BC  ʼ  MODIFIER LETTER APOSTROPHE
#   U+2018  '  LEFT SINGLE QUOTATION MARK
#   U+2019  '  RIGHT SINGLE QUOTATION MARK
#   U+0060  `  GRAVE ACCENT
#   U+00B4  ´  ACUTE ACCENT
# Hammasini bitta ASCII apostrof (U+0027) ga keltiramiz — model uchun barqaror.
_APOSTROPHE_VARIANTS = "ʻʼ‘’`´"
_STANDARD_APOSTROPHE = "'"
_APO_REGEX = re.compile(f"[{re.escape(_APOSTROPHE_VARIANTS)}]")


def standardize_apostrophes(text: str) -> str:
    """Barcha apostrof variantlarini standart ASCII ' ga keltirish."""
    # NFC normallash — kombinatsion belgilarni yagona shaklga keltiradi.
    text = unicodedata.normalize("NFC", text)
    return _APO_REGEX.sub(_STANDARD_APOSTROPHE, text)


# ---------------------------------------------------------------------------
# 2. BUTUN SONLARNI SO'ZGA AYLANTIRISH (0 .. 999_999_999_999)
# ---------------------------------------------------------------------------

_ONES = (
    "nol", "bir", "ikki", "uch", "to'rt", "besh",
    "olti", "yetti", "sakkiz", "to'qqiz",
)
_TENS = (
    "", "o'n", "yigirma", "o'ttiz", "qirq", "ellik",
    "oltmish", "yetmish", "sakson", "to'qson",
)

# Daraja (10^k) → so'z va minimal qiymat ("ming" oldida "bir" yozilmaydi,
# lekin "ikki ming" yoziladi — quyida hisobga olingan).
_SCALES = (
    (1_000_000_000, "milliard"),
    (1_000_000, "million"),
    (1_000, "ming"),
)


def integer_to_uzbek(n: int) -> str:
    """0 dan 999_999_999_999 gacha butun sonni o'zbek tilida yozish.

    Misol:
        >>> integer_to_uzbek(0)        -> "nol"
        >>> integer_to_uzbek(21)       -> "yigirma bir"
        >>> integer_to_uzbek(2026)     -> "ikki ming yigirma olti"
        >>> integer_to_uzbek(-5)       -> "minus besh"
    """
    if n < 0:
        return "minus " + integer_to_uzbek(-n)
    if n == 0:
        return _ONES[0]
    if n < 10:
        return _ONES[n]
    if n < 100:
        tens, ones = divmod(n, 10)
        return _TENS[tens] if ones == 0 else f"{_TENS[tens]} {_ONES[ones]}"
    if n < 1000:
        hundreds, rest = divmod(n, 100)
        # "yuz" — "bir yuz" emas, faqat "yuz"
        head = "yuz" if hundreds == 1 else f"{_ONES[hundreds]} yuz"
        return head if rest == 0 else f"{head} {integer_to_uzbek(rest)}"
    for scale, name in _SCALES:
        if n >= scale:
            high, rest = divmod(n, scale)
            # "ming" uchun "bir" tushiriladi ("bir ming" emas, "ming").
            # "million" / "milliard" uchun "bir" SAQLANADI — bu o'zbek tilidagi
            # standart so'zlashuv shakli ("bir million", "bir milliard").
            if high == 1 and name == "ming":
                head = name
            else:
                head = f"{integer_to_uzbek(high)} {name}"
            return head if rest == 0 else f"{head} {integer_to_uzbek(rest)}"
    return str(n)  # juda katta sonlar — fallback


def _cardinal_to_ordinal(cardinal: str) -> str:
    """'ikki ming yigirma uch' -> 'ikki ming yigirma uchinchi'.

    O'zbek tilidagi tartib qo'shimchasi:
        - unli bilan tugasa (a, e, i, o, u): +nchi (yigirma → yigirmanchi)
        - undosh bilan tugasa:               +inchi (uch → uchinchi)
    """
    if not cardinal:
        return cardinal
    words = cardinal.split()
    last = words[-1]
    # Apostrofni nazarga olmaslik (to'rt → to'rtinchi, undosh `t` da tugaydi).
    last_letter = last.rstrip("'").lower()[-1] if last.rstrip("'") else ""
    suffix = "nchi" if last_letter in "aeiou" else "inchi"
    words[-1] = last + suffix
    return " ".join(words)


# ---------------------------------------------------------------------------
# 3. SANA, VAQT VA KASRLAR
# ---------------------------------------------------------------------------

_MONTHS = {
    1: "yanvar", 2: "fevral", 3: "mart", 4: "aprel",
    5: "may", 6: "iyun", 7: "iyul", 8: "avgust",
    9: "sentyabr", 10: "oktyabr", 11: "noyabr", 12: "dekabr",
}

# DD.MM.YYYY yoki DD/MM/YYYY yoki DD-MM-YYYY
_DATE_RE = re.compile(r"\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})\b")
# YYYY-MM-DD (ISO)
_ISO_DATE_RE = re.compile(r"\b(\d{4})-(\d{1,2})-(\d{1,2})\b")
# HH:MM (24-soat formati)
_TIME_RE = re.compile(r"\b([01]?\d|2[0-3]):([0-5]\d)\b")


def normalize_dates(text: str) -> str:
    """Sanalarni so'z bilan ifodalash.

    Qo'llab-quvvatlanadigan formatlar:
        DD.MM.YYYY  ->  "kun-ordinal oy-nomi yil-ordinal yil"
        DD/MM/YYYY
        DD-MM-YYYY
        YYYY-MM-DD  (ISO)

    Misol:
        12.05.2023 -> "o'n ikkinchi may ikki ming yigirma uchinchi yil"
    """
    def _format(day: int, month: int, year: int, original: str) -> str:
        if not (1 <= day <= 31 and 1 <= month <= 12 and 1 <= year <= 9999):
            return original
        day_ord = _cardinal_to_ordinal(integer_to_uzbek(day))
        month_name = _MONTHS[month]
        year_ord = _cardinal_to_ordinal(integer_to_uzbek(year))
        return f"{day_ord} {month_name} {year_ord} yil"

    def _dmy(m: re.Match) -> str:
        return _format(int(m.group(1)), int(m.group(2)), int(m.group(3)), m.group(0))

    def _iso(m: re.Match) -> str:
        return _format(int(m.group(3)), int(m.group(2)), int(m.group(1)), m.group(0))

    text = _ISO_DATE_RE.sub(_iso, text)
    text = _DATE_RE.sub(_dmy, text)
    return text


def normalize_times(text: str) -> str:
    """HH:MM formatdagi vaqtlarni so'zga aylantirish.

    Soddalashtirilgan (TTS dataset uchun) variant: kun davri ('ertalab',
    'kechqurun', ...) qo'shilmaydi — modelga aniq "soat:minut" yetkaziladi.

    Misol:
        14:30 -> "o'n to'rt o'ttiz"
        09:00 -> "to'qqiz nol nol"
        00:05 -> "nol nol nol besh"
    """
    def _repl(m: re.Match) -> str:
        hour, minute = int(m.group(1)), int(m.group(2))
        h_word = integer_to_uzbek(hour)
        if minute == 0:
            # "to'qqiz nol nol" — modelga vaqt ekanini bildirish uchun
            return f"{h_word} nol nol"
        # Daqiqani butun son sifatida o'qish (yaxlitlash so'zsiz: "o'ttiz")
        m_word = integer_to_uzbek(minute)
        # Bir xonali daqiqalar oldidan "nol" qo'shamiz (05 → "nol besh")
        if minute < 10:
            m_word = f"nol {m_word}"
        return f"{h_word} {m_word}"

    return _TIME_RE.sub(_repl, text)


# Yetarli darajada universal "kasr/butun" tipidagi raqamlar uchun pattern.
# Avval sana/vaqtlardan keyin chaqirilishi shart, aks holda 12.05 ni kasr deb qabul qiladi.
_DECIMAL_RE = re.compile(r"(?<!\d)(-?\d+)[.,](\d+)(?!\d)")

# 10^k uchun denominator nomlari ("o'ndan", "yuzdan", "mingdan", ...).
_DENOM_NAMES = {
    1: "o'ndan",
    2: "yuzdan",
    3: "mingdan",
    4: "o'n mingdan",
    5: "yuz mingdan",
    6: "milliondan",
    7: "o'n milliondan",
    8: "yuz milliondan",
    9: "milliarddan",
}


def normalize_decimals(text: str, use_fraction_form: bool = True) -> str:
    """O'nlik kasrlarni so'zga aylantirish.

    use_fraction_form=True (tavsiya):
        3.14  -> "uch butun yuzdan o'n to'rt"
        3.5   -> "uch butun o'ndan besh"
        3.142 -> "uch butun mingdan yuz qirq ikki"

    use_fraction_form=False (oddiy fallback):
        3.14  -> "uch butun o'n to'rt"
        3.5   -> "uch butun besh"

    Eslatma: agar kasr qismi 9 xonadan oshsa, har bir raqam alohida o'qiladi.
    """
    def _repl(m: re.Match) -> str:
        whole_str, frac_str = m.group(1), m.group(2)
        try:
            whole = int(whole_str)
        except ValueError:
            return m.group(0)
        whole_word = integer_to_uzbek(whole)

        # Kasr qismidagi yetakchi nollarni ham hisobga olamiz (3.05).
        n_digits = len(frac_str)
        frac_int = int(frac_str)

        if not use_fraction_form:
            frac_word = integer_to_uzbek(frac_int)
            return f"{whole_word} butun {frac_word}"

        if n_digits in _DENOM_NAMES:
            denom = _DENOM_NAMES[n_digits]
            frac_word = integer_to_uzbek(frac_int)
            return f"{whole_word} butun {denom} {frac_word}"

        # Juda uzun kasr: har bir raqamni alohida o'qiymiz.
        frac_word = " ".join(_ONES[int(d)] for d in frac_str)
        return f"{whole_word} butun {frac_word}"

    return _DECIMAL_RE.sub(_repl, text)


# ---------------------------------------------------------------------------
# 4. BELGILAR VA QISQARTMALAR
# ---------------------------------------------------------------------------

# Pul birliklari — raqamdan keyin ham, oldin ham kelishi mumkin.
_CURRENCY_WORDS = {
    "$": "dollar",
    "€": "yevro",
    "£": "funt",
    "₽": "rubl",
    "₸": "tenge",
    "¥": "yen",
}

# Matematik belgilar — odatda ikki son orasida turadi.
_MATH_WORDS = {
    "+": "qo'shuv",
    "-": "ayirish",
    "−": "ayirish",   # U+2212 MINUS SIGN
    "=": "teng",
    "×": "ko'paytirilgan",
    "*": "ko'paytirilgan",
    "÷": "bo'lingan",
    "/": "bo'lingan",
    "<": "kichik",
    ">": "katta",
}

# "Yakka" belgilar — qaerda turishidan qat'i nazar shu so'zga aylanadi.
_GENERIC_SYMBOLS = {
    "%": "foiz",
    "‰": "promille",
    "°": "gradus",
    "&": "va",
    "@": "et",
    "№": "raqam",
}


def normalize_symbols(text: str) -> str:
    """Belgilarni o'zbek tilidagi so'zga aylantirish.

    Tartib:
        1. Foiz (100% -> "yuz foiz") — raqamga yopishgan.
        2. Pul belgilari (5$ yoki $5 -> "besh dollar").
        3. Matematik ifodalar (2+3=5 -> "ikki qo'shuv uch teng besh").
        4. Qolgan generic belgilar.
    """
    # 4.1. Foiz — raqamdan keyin keladi.
    text = re.sub(
        r"(-?\d+(?:[.,]\d+)?)\s*%",
        lambda m: f"{m.group(1)} foiz",
        text,
    )

    # 4.2. Pul birliklari.
    for sym, word in _CURRENCY_WORDS.items():
        esc = re.escape(sym)
        # "$5" yoki "$ 5" -> "5 dollar"
        text = re.sub(rf"{esc}\s*(-?\d+(?:[.,]\d+)?)", rf"\1 {word}", text)
        # "5$" yoki "5 $" -> "5 dollar"
        text = re.sub(rf"(-?\d+(?:[.,]\d+)?)\s*{esc}", rf"\1 {word}", text)

    # 4.3. Matematik ifodalar. Iterativ — "2+3=5" zanjirini ham qamrab oladi.
    math_chars = "".join(re.escape(c) for c in _MATH_WORDS)
    math_re = re.compile(rf"(-?\d+(?:[.,]\d+)?)\s*([{math_chars}])\s*(-?\d+(?:[.,]\d+)?)")
    prev = None
    while prev != text:
        prev = text
        text = math_re.sub(
            lambda m: f"{m.group(1)} {_MATH_WORDS[m.group(2)]} {m.group(3)}",
            text,
        )

    # 4.4. Probel bilan o'ralgan yakka matematik belgilar (raqamlar zanjirisiz):
    # "Yarim - 0.5" -> "Yarim ayirish 0.5". Emdash (—) va so'z ichidagi defislarga
    # ta'sir qilmaydi (chunki ular probel bilan o'ralmagan yoki boshqa kod nuqtasiga ega).
    _LONE_OP_MAP = {"+": "qo'shuv", "-": "ayirish", "=": "teng", "<": "kichik", ">": "katta"}
    for op, word in _LONE_OP_MAP.items():
        text = re.sub(rf"(?<=\s){re.escape(op)}(?=\s)", word, text)

    # 4.5. Qolgan generic belgilar (har joyda).
    for sym, word in _GENERIC_SYMBOLS.items():
        text = text.replace(sym, f" {word} ")

    return text


# ---------------------------------------------------------------------------
# 5. QOLGAN BUTUN SONLAR VA UMUMIY TOZALASH
# ---------------------------------------------------------------------------

# Faqat alohida (so'z ichida bo'lmagan, kasrning bir qismi bo'lmagan) butun sonlar.
# Diqqat: bu chaqirilgunga qadar `normalize_decimals` allaqachon kasrlarni so'zga aylantirgan,
# shu sababli `.` yoki `,` raqamga ergashishi mumkin emas — faqat raqam tekshiramiz.
_INTEGER_RE = re.compile(r"(?<!\d)-?\d+(?!\d)")


def normalize_remaining_integers(text: str) -> str:
    """Sana / vaqt / kasr / belgilardan keyin qolgan yalang'och butun sonlarni
    so'zga aylantirish. Bu — eng oxirgi raqam-bosqich."""
    def _repl(m: re.Match) -> str:
        s = m.group(0)
        try:
            return integer_to_uzbek(int(s))
        except ValueError:
            return s
    return _INTEGER_RE.sub(_repl, text)


def cleanup_whitespace(text: str) -> str:
    """Ortiqcha bo'shliqlarni siqish va chetdagilarni olib tashlash."""
    return re.sub(r"\s+", " ", text).strip()


# ---------------------------------------------------------------------------
# 6. ASOSIY ENTRY POINT
# ---------------------------------------------------------------------------

def normalize_text(text: str, *, use_fraction_form: bool = True) -> str:
    """O'zbek matnini TTS dataset uchun to'liq normallashtirish.

    Bosqichlar (tartib qat'iy):
        1. Apostrof standartlash    (' va variantlar -> ASCII ')
        2. Sanalar                  (DD.MM.YYYY va boshqalar)
        3. Vaqtlar                  (HH:MM)
        4. Belgilar (foiz, pul, matematika, &, @, va h.k.)
        5. O'nlik kasrlar           (3.14 -> "uch butun yuzdan o'n to'rt")
        6. Qolgan butun sonlar
        7. Lowercase + bo'shliq tozalash

    Args:
        text: kirish matni (transkripsiya).
        use_fraction_form: True bo'lsa, kasrni "butun yuzdan ..." shaklida
            o'qiydi; False bo'lsa — soddalashgan "butun N" shaklida.

    Returns:
        normallashgan, lowercase, bo'shliqsiz, modelga uzatishga tayyor matn.
    """
    if not isinstance(text, str):
        raise TypeError(f"normalize_text expects str, got {type(text).__name__}")

    text = standardize_apostrophes(text)
    text = normalize_dates(text)
    text = normalize_times(text)
    text = normalize_symbols(text)
    text = normalize_decimals(text, use_fraction_form=use_fraction_form)
    text = normalize_remaining_integers(text)
    text = text.lower()
    text = cleanup_whitespace(text)
    return text


# ---------------------------------------------------------------------------
# 7. TESTLAR
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    # (kirish, kutilgan natija) — diqqat: kutilgan qiymatlar lowercase.
    test_cases = [
        # Apostrof variantlari
        (
            "Oʻzbekiston — gʻoyat go‘zal mamlakat.",
            "o'zbekiston — g'oyat go'zal mamlakat.",
        ),
        (
            "Bog`im, to´rt nok va o'rik.",
            "bog'im, to'rt nok va o'rik.",
        ),

        # Butun sonlar
        (
            "Hozir 2026 yil.",
            "hozir ikki ming yigirma olti yil.",
        ),
        (
            "Bu kitobda 1234567890 ta so'z bor.",
            "bu kitobda bir milliard ikki yuz o'ttiz to'rt million besh yuz oltmish yetti ming sakkiz yuz to'qson ta so'z bor.",
        ),
        (
            "Mening yoshim 25.",
            "mening yoshim yigirma besh.",
        ),

        # Sanalar
        (
            "Bugun 12.05.2023.",
            "bugun o'n ikkinchi may ikki ming yigirma uchinchi yil.",
        ),
        (
            "Sana: 01/01/2026.",
            "sana: birinchi yanvar ikki ming yigirma oltinchi yil.",
        ),
        (
            "ISO: 2024-03-08.",
            "iso: sakkizinchi mart ikki ming yigirma to'rtinchi yil.",
        ),

        # Vaqtlar
        (
            "Soat 14:30 da uchrashamiz.",
            "soat o'n to'rt o'ttiz da uchrashamiz.",
        ),
        (
            "Ertalab 09:00 da boshlanadi.",
            "ertalab to'qqiz nol nol da boshlanadi.",
        ),
        (
            "Tunda 00:05 da uyg'ondim.",
            "tunda nol nol besh da uyg'ondim.",
        ),

        # O'nlik kasrlar (use_fraction_form=True)
        (
            "PI taxminan 3.14 ga teng.",
            "pi taxminan uch butun yuzdan o'n to'rt ga teng.",
        ),
        (
            "Yarim - 0.5.",
            "yarim ayirish nol butun o'ndan besh.",
        ),
        (
            "Aniqlik 0.001 darajasida.",
            "aniqlik nol butun mingdan bir darajasida.",
        ),

        # Belgilar va matematika
        (
            "100% to'g'ri.",
            "yuz foiz to'g'ri.",
        ),
        (
            "Narxi 50 $ yoki 45 €.",
            "narxi ellik dollar yoki qirq besh yevro.",
        ),
        (
            "2 + 3 = 5 va 10 - 4 = 6.",
            "ikki qo'shuv uch teng besh va o'n ayirish to'rt teng olti.",
        ),
        (
            "Bahodir & Aziz @ Toshkent.",
            "bahodir va aziz et toshkent.",
        ),

        # Murakkab — barchasi birga
        (
            "12.05.2023 da soat 14:30 da $100 to'lab, 5+5=10 deb yozdim.",
            "o'n ikkinchi may ikki ming yigirma uchinchi yil da soat o'n to'rt o'ttiz da yuz dollar to'lab, besh qo'shuv besh teng o'n deb yozdim.",
        ),

        # Whitespace
        (
            "   ko'p     bo'shliqli   matn.   ",
            "ko'p bo'shliqli matn.",
        ),
    ]

    print("=" * 70)
    print("text_normalization.py — testlar")
    print("=" * 70)

    passed = 0
    failed = 0
    for i, (raw, expected) in enumerate(test_cases, 1):
        result = normalize_text(raw)
        ok = result == expected
        status = "PASS" if ok else "FAIL"
        if ok:
            passed += 1
        else:
            failed += 1
        print(f"\n[{i:02d}] {status}")
        print(f"  IN:       {raw!r}")
        print(f"  OUT:      {result!r}")
        if not ok:
            print(f"  EXPECTED: {expected!r}")

    print("\n" + "=" * 70)
    print(f"Yakun: {passed}/{len(test_cases)} muvaffaqiyatli, {failed} xato.")
    print("=" * 70)

    # Fallback ham ishlashini ko'rsatamiz.
    print("\nKasr soddalashgan (use_fraction_form=False) shakli:")
    print(f"  3.14  -> {normalize_text('3.14', use_fraction_form=False)!r}")
    print(f"  0.5   -> {normalize_text('0.5', use_fraction_form=False)!r}")
    print(f"  2.718 -> {normalize_text('2.718', use_fraction_form=False)!r}")
