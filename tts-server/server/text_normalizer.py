"""
O'zbek matnni XTTS v2 ga moslashtirish.

Ikki rejim:
1. heavy (eski): q→k, x→h, oʻ→ö, gʻ→ğ — turk fonetikasiga maksimal yaqinlashtirish
2. light (yangi): faqat apostrof variantlarini bir xil qiladi, q/x/oʻ/gʻ ni saqlaydi
   — shunda fine-tuning paytida model haqiqiy o'zbek tovushini o'rganadi

Light rejim TAVSIYA ETILADI (fine-tuned model uchun).
"""

import re
import unicodedata

# Apostrofning barcha mumkin variantlari
APOSTROPHES = ["ʼ", "'", "'", "'", "`", "´"]
UZBEK_APO = "ʻ"  # U+02BB — o'zbek standartiga ko'ra to'g'ri apostrof


def normalize_uzbek_to_turkish_phonetic(text: str, light: bool = True) -> str:
    """O'zbek matnni TTS uchun moslashtirish.

    light=True (tavsiya):
        - Apostroflarni standart ʻ (U+02BB) ga keltirish
        - ng, ch, sh ni saqlash (ko'p tilli model bilarkin)
        - q, x, oʻ, gʻ AS-IS — fine-tuned model haqiqiy tovushni o'rganishi uchun

    light=False (eski heavy rejim — base model uchun):
        - q→k, x→h, oʻ→ö, gʻ→ğ
        - ch→ç, sh→ş
    """
    # 1. Unicode NFC normallash
    text = unicodedata.normalize("NFC", text)

    # 2. Apostrof variantlarini birlashtirish
    if light:
        # Light: barcha apostroflarni o'zbek standart ʻ ga keltirish
        for apo in APOSTROPHES:
            text = text.replace(apo, UZBEK_APO)
    else:
        # Heavy: avval ASCII apostrofga, keyin almashtirish
        for apo in APOSTROPHES + [UZBEK_APO]:
            text = text.replace(apo, "'")
        # oʻ, gʻ → ö, ğ
        text = re.sub(r"[oO]'", lambda m: "ö" if m.group(0)[0] == "o" else "Ö", text)
        text = re.sub(r"[gG]'", lambda m: "ğ" if m.group(0)[0] == "g" else "Ğ", text)
        # q → k, x → h
        text = text.replace("q", "k").replace("Q", "K")
        text = text.replace("x", "h").replace("X", "H")
        # ch → ç, sh → ş
        text = re.sub(r"[cC]h", lambda m: "ç" if m.group(0)[0] == "c" else "Ç", text)
        text = re.sub(r"[sS]h", lambda m: "ş" if m.group(0)[0] == "s" else "Ş", text)
        # ng → n
        text = text.replace("ng", "n").replace("Ng", "N").replace("NG", "N")
        # Qolgan apostroflarni o'chirish
        text = text.replace("'", "")

    # 3. Bir nechta bo'shliq → bitta
    text = re.sub(r"\s+", " ", text).strip()
    return text


def diff_explanation(original: str, normalized: str) -> str:
    if original == normalized:
        return "(o'zgarish yo'q)"
    return f"{original!r} → {normalized!r}"


if __name__ == "__main__":
    tests = [
        "Salom, mening ismim Ahmad.",
        "O'zbekiston Markaziy Osiyoda joylashgan go'zal mamlakat.",
        "Bog'imda olma, nok va o'rik daraxtlari o'sadi.",
        "Bunday yaxshi xabarni eshitib, hamma quvonib ketdi.",
        "Toshkent — O'zbekistonning poytaxti.",
    ]
    print("LIGHT rejim (tavsiya, fine-tuned model uchun):")
    for t in tests:
        n = normalize_uzbek_to_turkish_phonetic(t, light=True)
        print(f"  {t}")
        print(f"  → {n}\n")

    print("\nHEAVY rejim (base model uchun, eski):")
    for t in tests[:2]:
        n = normalize_uzbek_to_turkish_phonetic(t, light=False)
        print(f"  {t}")
        print(f"  → {n}\n")
