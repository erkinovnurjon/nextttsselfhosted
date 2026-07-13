"""
lexicon.py
==========

Qiyin so'zlar talaffuzi uchun lug'at qatlami (matn-normalizatsiya, modelga tegmaydi).

Qoplaydi:
  - Qisqartmalar/akronimlar  ("OTM" → "oliy ta'lim muassasasi", "USB" → "u-es-be")
  - Valyuta belgilari         ("$5" → "5 dollar")
  - O'lchov birliklari        ("5 km" → "5 kilometr", "10kg" → "10 kilogramm")
  - Chet/qarz so'zlar          ("Google" → "gugl", "online" → "onlayn")

Foydalanuvchi YANGI so'zlarni qo'shishi uchun: shu papkada `lexicon_custom.json`
yarating — u avtomatik birlashtiriladi (kod o'zgartirmasdan). Format:

  {
    "abbreviations": { "yhxb": "yo'l harakati xavfsizligi bo'limi" },
    "pronunciation": { "chatgpt": "chat-ji-pi-ti" },
    "units":        { "px": "piksel" },
    "spell":        [ "qr" ]
  }

`spell` ro'yxatidagi tokenlar harflab o'qiladi (akronim sifatida).
"""

from __future__ import annotations

import json
import re
from pathlib import Path

# ───────────────── Lotin harf nomlari (akronimlarni harflab o'qish uchun) ─────────────────
# Natija lotinda — keyin mms_engine uni kirillga o'giradi.
LETTER_NAMES: dict[str, str] = {
    "a": "a", "b": "be", "c": "se", "d": "de", "e": "e", "f": "ef", "g": "ge",
    "h": "ha", "i": "i", "j": "je", "k": "ka", "l": "el", "m": "em", "n": "en",
    "o": "o", "p": "pe", "q": "qu", "r": "er", "s": "es", "t": "te", "u": "u",
    "v": "ve", "w": "dablyu", "x": "iks", "y": "igrek", "z": "ze",
}

# ───────────────── Tanilgan qisqartmalar (kichik harfda kalit → lotin yoyilma) ─────────────────
ABBREVIATIONS: dict[str, str] = {
    # Davlat / xalqaro tashkilotlar
    # "otm" → to'liq yoyilma. ASR-sinov (2026-07-06): "otem"/"o te em" modelda
    # buziladi ("ot endi", "otelda"; 33-60% WER); to'liq nom = 0% WER, tabiiy.
    # "OTMda" → "oliy ta'lim muassasasida".
    "otm": "oliy ta'lim muassasasi",
    "aqsh": "Amerika Qo'shma Shtatlari",
    "bmt": "Birlashgan Millatlar Tashkiloti",
    "mdh": "Mustaqil Davlatlar Hamdo'stligi",
    "jst": "Jahon Savdo Tashkiloti",
    "iiv": "Ichki Ishlar Vazirligi",
    "vm": "Vazirlar Mahkamasi",
    "yhxb": "yo'l harakati xavfsizligi bo'limi",
    "mfy": "mahalla fuqarolar yig'ini",
    "mtt": "maktabgacha ta'lim tashkiloti",
    "xtv": "xalq ta'limi vazirligi",
    # Soliq / hujjat / moliya
    "qqs": "qo'shilgan qiymat solig'i",
    "stir": "soliq to'lovchining identifikatsiya raqami",
    "jshshir": "jismoniy shaxsning shaxsiy identifikatsiya raqami",
    "bhm": "bazaviy hisoblash miqdori",
    # Biznes shakllari
    "mchj": "mas'uliyati cheklangan jamiyat",
    "aj": "aksiyadorlik jamiyati",
    "yatt": "yakka tartibdagi tadbirkor",
    # Valyuta kodlari
    "usd": "dollar",
    "eur": "yevro",
    "rub": "rubl",
    "uzs": "so'm",
    "kzt": "tenge",
    # Davlat idoralari (qo'shimcha)
    "ssv": "sog'liqni saqlash vazirligi",
    "dtm": "davlat test markazi",
    # Texnologiya / umumiy
    "akt": "axborot kommunikatsiya texnologiyalari",
    "oav": "ommaviy axborot vositalari",
    "ai": "sun'iy intellekt",
    "tatu": "Toshkent axborot texnologiyalari universiteti",
    # Ilmiy unvonlar / qisqartmalar
    "prof": "professor",
    "dots": "dotsent",
    "akad": "akademik",
    "h.k": "hokazo",
    "va h.k": "va hokazo",
    "va b": "va boshqalar",
    "mas": "masalan",
}

# Harflab o'qiladigan akronimlar (yoyilmasi yo'q, lekin harf-harf aytiladi).
# DIQQAT: faqat BOSH HARFLI yozilganda qo'llanadi (kichik "it"/"id" so'zlarini buzmaslik uchun).
SPELL_OUT: set[str] = {
    "usb", "sms", "mms", "pdf", "html", "css", "url", "api", "id", "it", "hr",
    "tv", "pc", "cpu", "gpu", "ssd", "vpn", "qr", "gps", "sql", "nfc", "otp",
    "atm", "pin", "imei", "ip", "dns", "http", "https", "ssh", "csv", "xml",
    "ui", "ux", "led", "lcd", "gsm", "lte", "fm", "tts", "asr", "gpt",
    # Ta'lim / idora (harflab o'qiladi). "otm" bu yerda EMAS — u ABBREVIATIONS'da
    # "otem" ravon so'zi sifatida (tabiiylik uchun).
    "lms", "iib", "yei",
}

# ───────────────── O'zbekcha qo'shimchalar (akronimga yopishganda ajratish uchun) ─────────────────
# "OTMda" → "OTM" + "da", "AQSHga" → "AQSH" + "ga". Uzunroq variantlar avval keladi
# (regex jamlashida greedy bo'lishi uchun) — aks holda "ning" o'rniga "ni" ushlanadi.
_UZ_ACRONYM_SUFFIX = (
    r"nikidek|nikida|nikini|niki|ning|niki|dagi|larida|lariga|laridan|larini|"
    r"lardagi|larda|larga|lardan|lari|larni|lar|gacha|siga|sida|sidan|sini|"
    r"siz|da|dan|ga|ka|qa|ni|si|ta|cha|day|dek|li|lik|i|miz|ngiz"
)

# ───────────────── Valyuta belgilari ─────────────────
CURRENCY_SYMBOLS: dict[str, str] = {
    "$": "dollar", "€": "yevro", "₽": "rubl", "₸": "tenge",
    "£": "funt", "¥": "yen", "₴": "grivna",
}

# ───────────────── O'lchov birliklari (raqamga yopishganida) ─────────────────
# Bir harfli xavfli birliklar (m, g, l, t) atayin YO'Q — oddiy so'zlarni buzmaslik uchun.
UNITS: dict[str, str] = {
    "km": "kilometr", "sm": "santimetr", "mm": "millimetr", "nm": "nanometr",
    "kg": "kilogramm", "mg": "milligramm", "ml": "millilitr",
    "gb": "gigabayt", "mb": "megabayt", "kb": "kilobayt", "tb": "terabayt",
    "ghz": "gigagerts", "mhz": "megagerts", "khz": "kilogerts",
    "kvt": "kilovatt", "vt": "vatt", "km/soat": "kilometr soatiga",
    "km/h": "kilometr soatiga", "m/s": "metr sekundiga",
    "°c": "selsiy gradus", "°f": "farengeyt gradus",
}

# ───────────────── Chet / qarz so'zlar (qanday eshitilishi kerak) ─────────────────
PRONUNCIATION: dict[str, str] = {
    # Web / ilovalar
    "google": "gugl", "youtube": "yutub", "facebook": "feysbuk",
    "whatsapp": "votsap", "twitter": "tvitter", "gmail": "gmeyl",
    "yandex": "yandeks", "chrome": "xrom", "firefox": "fayrfoks",
    "windows": "vindovs", "iphone": "ayfon", "macbook": "makbuk",
    "wifi": "vayfay", "bluetooth": "blutus", "email": "imeyl",
    "online": "onlayn", "offline": "oflayn", "website": "vebsayt",
    "browser": "brauzer", "download": "daunlod", "upload": "aplod",
    "chatgpt": "chat-ji-pi-ti", "smartphone": "smartfon",
    # Dasturlash
    "python": "payton", "javascript": "javaskript", "github": "gitxab",
    "json": "jeyson", "linux": "linuks", "nginx": "endjiniks",
    # Brendlar (O'zbekiston + global)
    "uzcard": "uzkard", "click": "klik", "payme": "peyme",
    "beeline": "bilayn", "ucell": "yusel", "uzmobile": "uzmobil",
    "perfectum": "perfektum", "microsoft": "maykrosoft", "apple": "epl",
    "huawei": "xuavey", "xiaomi": "shaomi", "netflix": "netfliks",
    "spotify": "spotifay", "skype": "skayp", "viber": "vayber", "zoom": "zum",
    # Ilovalar / ijtimoiy tarmoq (qo'shimcha)
    "discord": "diskord", "messenger": "messenjer", "linkedin": "linkedin",
    "reddit": "reddit", "playstation": "pleysteyshn", "xbox": "eksboks",
    "airpods": "ayrpods", "samsung": "samsung", "android": "android",
    # To'lov / kripto
    "visa": "viza", "mastercard": "masterkard", "paypal": "peypal",
    "bitcoin": "bitkoin", "usdt": "yu-es-di-ti",
    # Geografik nomlar (chet yozuvda kelganda)
    "washington": "vashington", "new york": "nyu-york", "london": "london",
    "paris": "parij", "moscow": "moskva", "beijing": "pekin",
    "tokyo": "tokio", "dubai": "dubay", "istanbul": "istanbul",
}


def _load_custom() -> None:
    """server/lexicon_custom.json bo'lsa — lug'atlarga qo'shadi/ustun yozadi."""
    p = Path(__file__).with_name("lexicon_custom.json")
    if not p.exists():
        return
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except Exception:
        return
    for k, v in (data.get("abbreviations") or {}).items():
        ABBREVIATIONS[k.lower()] = v
    for k, v in (data.get("pronunciation") or {}).items():
        PRONUNCIATION[k.lower()] = v
    for k, v in (data.get("units") or {}).items():
        UNITS[k.lower()] = v
    for tok in (data.get("spell") or []):
        SPELL_OUT.add(str(tok).lower())


_load_custom()


def _spell_token(token: str) -> str:
    """'USB' → 'u-es-be' (lotin harf nomlari bilan)."""
    return " ".join(LETTER_NAMES.get(ch, ch) for ch in token.lower() if ch.isalpha())


def expand_currency(text: str) -> str:
    """'$5' yoki '5$' → '5 dollar'. Raqam saqlanadi (keyin so'zga aylanadi)."""
    for sym, word in CURRENCY_SYMBOLS.items():
        esym = re.escape(sym)
        # Raqamni ushlaymiz, atrofdagi bo'shliqlarni saqlaymiz
        text = re.sub(rf"{esym}\s*(\d[\d.,]*)", lambda m: f"{m.group(1)} {word}", text)
        text = re.sub(rf"(\d[\d.,]*)\s*{esym}", lambda m: f"{m.group(1)} {word}", text)
    return text


def expand_units(text: str) -> str:
    """'5 km' / '10kg' → '5 kilometr' / '10 kilogramm' (raqamdan keyin kelganda)."""
    # Uzunroq kalitlar avval (km/soat, °c ...)
    for unit in sorted(UNITS, key=len, reverse=True):
        word = UNITS[unit]
        eu = re.escape(unit)
        # raqam + (ixtiyoriy bo'shliq) + birlik + so'z chegarasi
        text = re.sub(rf"(?<=\d)\s*{eu}(?![a-zA-Zʻ'])", f" {word}", text, flags=re.IGNORECASE)
    return text


_ACRONYM_SUFFIXED = re.compile(
    r"\b([A-Z]{2,})(" + _UZ_ACRONYM_SUFFIX + r")?\b"
)


def expand_abbreviations(text: str) -> str:
    """Tanilgan qisqartmalarni yoyadi va SPELL_OUT'dagilarni harflab o'qiydi.

    Ikki bosqich:
      1. Bosh harfli akronim + ixtiyoriy o'zbekcha qo'shimcha ("OTMda" → "o te em da",
         "AQSHga" → "Amerika Qo'shma Shtatlariga"). Qo'shimcha yoyilmaga qo'shib qo'yiladi.
      2. Nuqtali/aralash registrli qisqartmalar (prof., h.k., MChJ) — butun token bo'yicha.

    Xavfsizlik: faqat BOSH HARFLI yozilganda qo'llanadi — kichik harfli oddiy
    so'zlar ("it", "id", "da") buzilmasligi uchun.
    """

    # 1-bosqich: AKRONIM + qo'shimcha
    def repl_acr(m: re.Match) -> str:
        core = m.group(1)
        suffix = m.group(2) or ""
        low = core.lower()
        if low in ABBREVIATIONS:
            # Yoyilma + qo'shimcha (oxirgi so'zga yopishadi: "...Shtatlari" + "ga")
            return ABBREVIATIONS[low] + suffix
        if low in SPELL_OUT:
            spelled = _spell_token(low)
            return spelled + (" " + suffix if suffix else "")
        return m.group(0)

    text = _ACRONYM_SUFFIXED.sub(repl_acr, text)

    # 2-bosqich: nuqtali / aralash registrli qisqartmalar (qo'shimchasiz)
    def repl_dot(m: re.Match) -> str:
        token = m.group(0)
        has_dot = "." in token
        low = token.lower().rstrip(".")
        if has_dot and low in ABBREVIATIONS:
            return ABBREVIATIONS[low]
        uppers = sum(1 for c in token if c.isupper())
        if token.isupper() or uppers >= 2:
            if low in ABBREVIATIONS:
                return ABBREVIATIONS[low]
            if low in SPELL_OUT:
                return _spell_token(low)
        return token

    return re.sub(r"\b[A-Za-z][A-Za-z.]{0,6}\b", repl_dot, text)


def apply_pronunciation(text: str) -> str:
    """Chet so'zlarni o'zbekcha eshitiladigan shaklга almashtirish (so'z chegarasida)."""
    def repl(m: re.Match) -> str:
        return PRONUNCIATION.get(m.group(0).lower(), m.group(0))
    if not PRONUNCIATION:
        return text
    pat = re.compile(r"\b(" + "|".join(re.escape(k) for k in PRONUNCIATION) + r")\b", re.IGNORECASE)
    return pat.sub(repl, text)


def apply_lexicon(text: str) -> str:
    """Lug'at qatlamining yagona kirish nuqtasi.

    Tartib: chet so'zlar → valyuta → birlik → qisqartmalar.
    (Raqamlar bu yerda DAXLSIZ qoladi — ularni linguistic_normalizer so'zga aylantiradi.)
    """
    text = apply_pronunciation(text)
    text = expand_currency(text)
    text = expand_units(text)
    text = expand_abbreviations(text)
    return text


if __name__ == "__main__":
    tests = [
        "OTM talabalari uchun.",
        "Narxi $5 yoki 50000 so'm.",
        "Tezlik 90 km/soat, masofa 12 km.",
        "USB va PDF fayllar.",
        "Google va YouTube ochildi.",
        "Fayl 10gb, RAM 8gb.",
        "AQSH va BMT hamkorligi.",
        "Harorat 25°C edi.",
    ]
    for t in tests:
        print("IN :", t)
        print("OUT:", apply_lexicon(t))
        print()
