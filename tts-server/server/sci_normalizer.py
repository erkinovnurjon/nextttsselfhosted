"""
Matematik / fizik / ilmiy ifodalarni o'zbekcha so'zga aylantirish.

TTS model BELGINI o'qiy olmaydi (², √, ∫, π, m/s², H₂O...) — uni avval so'zga
aylantirish kerak. Bu modul shuni qiladi va `linguistic_normalizer.normalize_uzbek_text`
ichiga (apply_lexicon'dan keyin, sonlar so'zga aylanishidan OLDIN) ulanadi.

Misol:
   x² → "iks kvadrat" · √9 → "to'qqizdan ildiz" · 10⁻³ → "o'n daraja minus uch"
   ∫ → "integral" · π → "pi" · Δ → "delta" · m/s² → "metr soniya kvadratiga"
   1.5×10⁸ → "bir yarim ko'paytuv o'n daraja sakkiz"
"""

import re

try:
    from server.linguistic_normalizer import number_to_uzbek
except ImportError:  # to'g'ridan-to'g'ri ishga tushirilganda
    from linguistic_normalizer import number_to_uzbek

# ───────────────────────── Belgilar lug'atlari ─────────────────────────
_SUP = {"⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6",
        "⁷": "7", "⁸": "8", "⁹": "9", "⁺": "+", "⁻": "-", "ⁿ": "n", "ⁱ": "i"}
_SUB = {"₀": "0", "₁": "1", "₂": "2", "₃": "3", "₄": "4", "₅": "5", "₆": "6",
        "₇": "7", "₈": "8", "₉": "9", "₊": "+", "₋": "-"}

GREEK = {
    "α": "alfa", "β": "beta", "γ": "gamma", "δ": "delta", "ε": "epsilon",
    "ζ": "dzeta", "η": "eta", "θ": "teta", "ι": "iota", "κ": "kappa",
    "λ": "lambda", "μ": "myu", "ν": "nyu", "ξ": "ksi", "ο": "omikron",
    "π": "pi", "ρ": "ro", "σ": "sigma", "ς": "sigma", "τ": "tau", "υ": "ipsilon",
    "φ": "fi", "χ": "xi", "ψ": "psi", "ω": "omega",
    "Γ": "gamma", "Δ": "delta", "Θ": "teta", "Λ": "lambda", "Ξ": "ksi",
    "Π": "pi", "Σ": "sigma", "Φ": "fi", "Ψ": "psi", "Ω": "omega",
}

# O'zgaruvchi sifatida kelgan yakka lotin harfi (superskript/indeks oldidan) → nomi.
LETTER_NAME = {
    "a": "a", "b": "be", "c": "se", "d": "de", "e": "e", "f": "ef", "g": "ge",
    "h": "ha", "i": "i", "j": "ji", "k": "ka", "l": "el", "m": "em", "n": "en",
    "o": "o", "p": "pe", "q": "qu", "r": "er", "s": "es", "t": "te", "u": "u",
    "v": "ve", "w": "dubl-ve", "x": "iks", "y": "igrek", "z": "zet",
}

# Ilmiy belgilar (oddiy matnda deyarli uchramaydi → xavfsiz almashtiriladi).
SCI_SYMBOLS = {
    "∫": "integral", "∬": "ikki karra integral", "∭": "uch karra integral",
    "∮": "kontur integral", "∑": "yig'indi", "∏": "ko'paytma",
    "∂": "qismiy hosila", "∇": "nabla", "∞": "cheksizlik",
    "√": "kvadrat ildiz", "∛": "kub ildiz", "∜": "to'rtinchi daraja ildiz",
    "∈": "tegishli", "∉": "tegishli emas", "∋": "saqlaydi",
    "⊂": "qism to'plam", "⊆": "qism to'plam", "⊃": "o'z ichiga oladi",
    "∪": "birlashma", "∩": "kesishma", "∅": "bo'sh to'plam",
    "∀": "har qanday", "∃": "mavjud", "∄": "mavjud emas",
    "≡": "ayniyat", "≅": "kongruent", "∝": "proporsional",
    "⊥": "perpendikulyar", "∥": "parallel", "∠": "burchak",
    "±": "plyus minus", "∓": "minus plyus",
    "×": "ko'paytuv", "÷": "bo'lingan", "·": "ko'paytuv", "⋅": "ko'paytuv",
    "≈": "taxminan teng", "≠": "teng emas", "≤": "kichik yoki teng",
    "≥": "katta yoki teng", "≪": "ancha kichik", "≫": "ancha katta",
    "→": "ga", "↔": "ekvivalent", "⇒": "demak", "⇔": "zarur va yetarli",
    "°": "gradus", "′": "shtrix", "″": "ikki shtrix", "…": "va hokazo",
}

# Fizik birliklar — RAQAMDAN keyin kelganda (oddiy so'zlarni buzmaslik uchun).
PHYS_UNITS = {
    "m/s²": "metr soniya kvadratiga", "m/s2": "metr soniya kvadratiga",
    "m/s": "metr soniyada", "km/h": "kilometr soatiga", "km/soat": "kilometr soatiga",
    "km/s": "kilometr soniyada", "m²": "kvadrat metr", "m³": "kub metr",
    "cm²": "kvadrat santimetr", "cm³": "kub santimetr", "km²": "kvadrat kilometr",
    "mm²": "kvadrat millimetr",
    "nm": "nanometr", "μm": "mikrometr", "um": "mikrometr", "mm": "millimetr",
    "cm": "santimetr", "dm": "detsimetr", "km": "kilometr",
    "ns": "nanosoniya", "μs": "mikrosoniya", "ms": "millisoniya",
    "Hz": "gers", "kHz": "kilogers", "MHz": "megagers", "GHz": "gigagers",
    "Pa": "paskal", "kPa": "kilopaskal", "MPa": "megapaskal",
    "kg": "kilogramm", "mg": "milligramm", "Hz": "gers",
    "kN": "kilonyuton", "N": "nyuton", "kJ": "kilojoul", "MJ": "megajoul",
    "J": "joul", "kW": "kilovatt", "MW": "megavatt", "W": "vatt",
    "kV": "kilovolt", "mV": "millivolt", "V": "volt", "mA": "milliamper",
    "A": "amper", "Ω": "om", "kΩ": "kiloom", "MΩ": "megaom",
    "mol": "mol", "kWh": "kilovatt soat", "Wh": "vatt soat",
    "eV": "elektronvolt", "cd": "kandela", "lm": "lyumen", "lx": "lyuks",
    "°C": "gradus selsiy", "°F": "gradus farengeyt", "°K": "kelvin",
}

# Keng tarqalgan kimyoviy formulalar — tabiiy o'qish.
CHEM = {
    "H₂O": "suv", "CO₂": "karbonat angidrid", "O₂": "kislorod",
    "H₂": "vodorod", "N₂": "azot", "NaCl": "osh tuzi", "CO": "uglerod oksidi",
    "H₂SO₄": "sulfat kislota", "HCl": "xlorid kislota", "NH₃": "ammiak",
    "CH₄": "metan", "C₆H₁₂O₆": "glyukoza",
}

_SUP_RUN = "[" + "".join(_SUP.keys()) + "]+"
_SUB_RUN = "[" + "".join(_SUB.keys()) + "]+"


def _power_phrase(run: str) -> str:
    """Superskript yugurishini daraja iborasiga aylantirish."""
    s = "".join(_SUP.get(c, c) for c in run)  # ²→2, ⁻³→-3, ⁸→8
    if s == "2":
        return " kvadrat"
    if s == "3":
        return " kub"
    sign = ""
    if s[:1] == "-":
        sign, s = "minus ", s[1:]
    elif s[:1] == "+":
        sign, s = "plyus ", s[1:]
    s = s.replace("n", "en")  # ⁿ → "en" (faqat o'zgaruvchi daraja)
    return " daraja " + sign + s


def _sub_phrase(run: str) -> str:
    s = "".join(_SUB.get(c, c) for c in run)
    s = s.replace("-", "minus ").replace("+", "plyus ")
    return " " + s.strip()


def normalize_scientific(text: str) -> str:
    # 1) Kimyoviy formulalar (butun token) — eng aniq, avval.
    for f, w in CHEM.items():
        text = text.replace(f, f" {w} ")

    # 2) Fizik birliklar — RAQAM + (bo'shliq?) + birlik. Uzunini avval.
    for u in sorted(PHYS_UNITS, key=len, reverse=True):
        pat = re.compile(r"(\d)\s*" + re.escape(u) + r"(?![A-Za-zʻ'²³])")
        text = pat.sub(lambda m, w=PHYS_UNITS[u]: f"{m.group(1)} {w}", text)

    # 3) Yakka o'zgaruvchi harf + superskript:  x² → "iks kvadrat", yⁿ → "igrek daraja en"
    def _var_sup(m):
        letter = m.group(1)
        name = LETTER_NAME.get(letter.lower(), letter)
        return name + _power_phrase(m.group(2))
    text = re.sub(r"(?<![A-Za-zʻ'])([A-Za-z])(" + _SUP_RUN + r")", _var_sup, text)

    # 4) Qolgan superskriptlar (son yoki qavsdan keyin): 10⁸ → "10 daraja 8"
    text = re.sub("(" + _SUP_RUN + ")", lambda m: _power_phrase(m.group(1)), text)

    # 5) Kvadrat ildiz:  √9 → "to'qqizdan ildiz", √ (yakka) → "kvadrat ildiz"
    text = re.sub(r"√\s*(\d+)(?![.,]?\d)",
                  lambda m: f"{number_to_uzbek(int(m.group(1)))}dan ildiz", text)
    text = re.sub(r"∛\s*(\d+)(?![.,]?\d)",
                  lambda m: f"{number_to_uzbek(int(m.group(1)))}dan kub ildiz", text)

    # 6) Yakka o'zgaruvchi harf + indeks:  x₁ → "iks bir"
    def _var_sub(m):
        name = LETTER_NAME.get(m.group(1).lower(), m.group(1))
        return name + _sub_phrase(m.group(2))
    text = re.sub(r"(?<![A-Za-zʻ'])([A-Za-z])(" + _SUB_RUN + r")", _var_sub, text)
    # Qolgan indekslar (formula qoldig'i): raqamga aylantiramiz
    text = re.sub("(" + _SUB_RUN + ")", lambda m: _sub_phrase(m.group(1)), text)

    # 7) Yunon harflari
    for g, w in GREEK.items():
        if g in text:
            text = text.replace(g, f" {w} ")

    # 8) Ilmiy belgilar (xavfsiz unicode)
    for sym, w in SCI_SYMBOLS.items():
        if sym in text:
            text = text.replace(sym, f" {w} ")

    # 9) Bo'shliq bilan ajratilgan ASCII amallar (formula: "x + y = z") — xavfsiz,
    # chunki bo'shliqli +/=/<> oddiy matnda deyarli uchramaydi (defis tegilmaydi).
    text = re.sub(r"(?<=\s)\+(?=\s)", "qo'shuv", text)
    text = re.sub(r"(?<=\s)=(?=\s)", "teng", text)
    text = re.sub(r"(?<=\s)−(?=\s)", "ayirish", text)
    text = re.sub(r"(?<=\s)<(?=\s)", "kichik", text)
    text = re.sub(r"(?<=\s)>(?=\s)", "katta", text)

    # 10) Birliklarni QAYTA: superskript son endi haqiqiy raqam ("10⁻³¹ kg" → kg ham).
    for u in sorted(PHYS_UNITS, key=len, reverse=True):
        pat = re.compile(r"(\d)\s*" + re.escape(u) + r"(?![A-Za-zʻ'²³])")
        text = pat.sub(lambda m, w=PHYS_UNITS[u]: f"{m.group(1)} {w}", text)

    text = re.sub(r"\s+", " ", text).strip()
    return text


if __name__ == "__main__":
    tests = [
        "Tezlanish a = 9.8 m/s².",
        "x² + y² = r² aylana tenglamasi.",
        "√9 = 3 va √16 = 4.",
        "Yorug'lik tezligi 3×10⁸ m/s ga teng.",
        "Elektron massasi 9.1×10⁻³¹ kg.",
        "∫ f(x) dx va ∑ aᵢ yig'indisi.",
        "π ≈ 3.14, Δx → 0, Ω = 5.",
        "Suv H₂O, karbonat angidrid CO₂.",
        "Harorat 25°C, bosim 101 kPa, chastota 50 Hz.",
        "E = mc² Eynshteyn formulasi.",
        "λ = 500 nm, F = 10 N, kuchlanish 220 V.",
    ]
    for t in tests:
        print("IN :", t)
        print("OUT:", normalize_scientific(t))
        print()
