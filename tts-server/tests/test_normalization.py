"""Normalizatsiya regressiya testlari.

Nega kerak: normalizatsiya nuqsonlari OVOZDA eshitiladi, kodda ko'rinmaydi
("14-iyulda" -> "o'n to'rt DEFIS iyulda", "sunʼiy" -> "es u en jective i ye").
Round-trip WER bilan o'lchash bu yerda ishlamaydi — shovqin poli ±31%, mayda
farqni ushlamaydi. Shuning uchun tekshiruv MATN darajasida qat'iy qilinadi.

Testlarning yarmi — "TEGILMASIN" turidagi: normalizator o'z chegarasidan
chiqmaganini qo'riqlaydi ("10 ga bo'ling" gektar emas, "3,14" minglik emas).
Aynan shu tomonga xato ketish o'qimay qo'yishdan yomonroq.

Ishga tushirish (tashqi bog'liqlik yo'q, pytest ham shart emas):
    cd tts-server
    PYTHONUTF8=1 venv-piper/Scripts/python.exe tests/test_normalization.py
"""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))  # tts-server/

from server.linguistic_normalizer import normalize_uzbek_text as norm


# ───────────────────────── espeak chegarasi: apostrof ─────────────────────────

def test_apostrof_espeak_chegarasida():
    """Har xil apostrof ASCII ' ga keltiriladi (espeak faqat shuni tanidi).

    piper_server orqali tekshiriladi — normalizatsiya aynan o'sha yerda,
    espeak'ga uzatishdan oldin turishi shart (chetlab o'tiladigan yo'l qolmasin).
    """
    try:
        import piper_server
    except ImportError as e:                      # piper/fastapi yo'q muhit
        msg = f"piper_server import qilinmadi ({e}) — venv-piper bilan ishga tushiring"
        try:
            import pytest
            pytest.skip(msg)
        except ImportError:
            print(f"  ⚠ SKIP: {msg}")
            return "skip"

    fix = piper_server._normalize_apostrophes
    # U+02BC — to'g'ri o'zbek tutuq belgisi, aynan u so'zni harflatib yuborardi
    assert fix("sunʼiy") == "sun'iy"
    assert fix("oʻzbek") == "o'zbek"              # U+02BB
    assert fix("gʻalaba") == "g'alaba"
    assert fix("ta’lim") == "ta'lim"              # U+2019
    assert fix("ma`no") == "ma'no"                # backtick
    # ASCII ' allaqachon to'g'ri — tegilmasin
    assert fix("sun'iy") == "sun'iy"
    # apostrofsiz matn o'zgarmaydi
    assert fix("Bugun havo issiq.") == "Bugun havo issiq."


# ───────────────────────────── sana va tartib son ─────────────────────────────

def test_sana():
    assert norm("2026-07-22 kuni") == "yigirma ikkinchi iyul ikki ming yigirma oltinchi yil kuni"
    # kelishik qo'shimchasi bilan: ilgari namuna mos kelmay "o'n to'rt-iyulda" chiqardi
    assert norm("14-iyulda") == "o'n to'rtinchi iyulda"
    assert norm("1-yanvardan") == "birinchi yanvardan"
    # y'siz imlo varianti ham tanilsin, lekin foydalanuvchi yozgan shakl saqlansin
    assert norm("5-sentabrda") == "beshinchi sentabrda"


def test_tartib_son_royxatga_boglanmagan():
    """Ilgari qat'iy ot ro'yxati bor edi: ro'yxatda yo'q so'z uchun defis o'qilardi."""
    assert norm("1-o'rinni egalladi") == "birinchi o'rinni egalladi"
    assert norm("3-bosqich") == "uchinchi bosqich"
    assert norm("7-sinf o'quvchisi") == "yettinchi sinf o'quvchisi"
    assert "-" not in norm("2-savolga javob")


# ──────────────────────────────── raqam shakllari ─────────────────────────────

def test_telefon_raqamlab_oqiladi():
    out = norm("+998 90 123 45 67")
    assert out.startswith("plyus "), out
    assert "yuz" not in out, f"katta son bo'lib ketdi: {out}"
    assert out == "plyus to'qqiz to'qqiz sakkiz, to'qqiz nol, bir ikki uch, to'rt besh, olti yetti"
    # defisli shahar raqami — ayirishga tushib ketmasin
    assert "ayirish" not in norm("71-200-00-00")


def test_manfiy_son():
    assert norm("Harorat -15 daraja") == "Harorat minus o'n besh daraja"


def test_matematika_tegilmasin():
    """Ayirish minus/diapazon bo'lib qolmasin — belgining ma'nosi kontekstda."""
    assert norm("10-3=7") == "o'n ayirish uch teng yetti"


def test_diapazon():
    assert norm("1941-1945-yillar") == ("ming to'qqiz yuz qirq birinchi, "
                                        "ming to'qqiz yuz qirq beshinchi yillar")
    # vergul = pauza; probelgina qo'ysak bitta uzun son bo'lib eshitiladi
    assert norm("10-15 kishi") == "o'n, o'n besh kishi"
    assert "ayirish" not in norm("2020-2024-yillarda")


def test_vaqt_va_sport_hisobi():
    assert norm("14:35 da uchrashuv") == "kunduzi soat ikkiyu o'ttiz besh daqiqada uchrashuv"
    # vaqt bo'lmagan qoldiq — ikki nuqta xom holicha qolmasin
    assert norm("hisob 3:2") == "hisob uch, ikki"
    assert ":" not in norm("O'yin 5:1 tugadi")


def test_qavsdagi_takror():
    """Rasmiy hujjat uslubi: "3 (uch)" ikki marta o'qilmasin."""
    assert norm("3 (uch) ish kuni") == "uch ish kuni"
    # boshqa izohli qavs — tegilmasin
    assert "izoh" in norm("5 (izoh) dona")


def test_minglik_guruhlar():
    assert norm("aholi 1,433,230 kishi") == ("aholi bir million to'rt yuz o'ttiz uch ming "
                                             "ikki yuz o'ttiz kishi")
    # IKKI guruhdan kam bo'lsa — bu o'nlik kasr, minglik emas
    assert norm("pi 3,14 ga teng") == "pi uch butun o'n to'rt ga teng"
    assert norm("250 000 so'm") == "ikki yuz ellik ming so'm"


# ──────────────────────────────────── birliklar ───────────────────────────────

def test_birliklar():
    assert norm("300 g shakar") == "uch yuz gramm shakar"
    assert norm("5 l suv") == "besh litr suv"
    assert norm("maydoni 12 km2") == "maydoni o'n ikki kvadrat kilometr"
    assert norm("uy 90 m² keladi") == "uy to'qson kvadrat metr keladi"
    assert norm("2,5 mln so'm") == "ikki yarim million so'm"


def test_ikki_manoli_birlik_tegilmasin():
    """Bir harfli birlik faqat probel + kichik harf bo'lsa yoyiladi."""
    assert "gramm" not in norm("5G tarmogi")            # tarmoq avlodi
    assert "gektar" not in norm("10 ga bo'ling")        # jo'nalish qo'shimchasi
    assert "litr" not in norm("BMW X5L modeli")


# ──────────────────────────── chet so'z va boshqa yozuvlar ────────────────────

def test_chet_sozlar():
    assert norm("software va web") == "softver va veb"
    assert norm("NextTTS platformasi") == "nekst te te es platformasi"
    # lug'atda yo'q so'z ham harflanmasin: w/c qolmasligi kerak
    out = norm("Wikipedia va cloud service")
    assert "w" not in out.lower() and "c" not in out.lower(), out


def test_ozbekcha_sozga_tegilmasin():
    """`ch` digrafi transliteratsiya to'riga tushib qolmasin."""
    assert norm("chiroq uchun uchta chizma") == "chiroq uchun uchta chizma"


def test_yunon_harflari():
    assert norm("π radiusi") == "pi radiusi"
    assert norm("α va β burchak") == "alfa va beta burchak"
    # yunon SO'ZI — espeak uni o'zi to'g'ri o'qiydi, harflab yoysak g'o'ldirash chiqadi
    assert norm("φυσικός so'zi") == "φυσικός so'zi"


def test_kirill_lotinga():
    assert norm("Тошкент шаҳри") == "Toshkent shahri"


def test_kirish_tozalash():
    """Nusxa-ko'chirilgan matn: espeak bu belgilarning INGLIZCHA NOMINI o'qiydi."""
    assert norm("Zo'r ish 😊 rahmat!") == "Zo'r ish rahmat!"          # 😊 -> "smiling"
    assert norm("**Muhim** matn va `kod`") == "Muhim matn va kod"     # ** -> "asterisk"
    assert norm("<p>Salom</p> dunyo") == "Salom dunyo"                # <p> -> "pe slash pe"
    assert "://" not in norm("Sayt https://nexttts.uz ochildi")       # -> "colon slash slash"
    assert norm("Juda zo'r!!! Nima???") == "Juda zo'r! Nima?"


def test_qator_uzilishi_pauza():
    """Qator uzilishi = pauza; aks holda uzun matn bir nafasda o'qiladi."""
    assert norm("Birinchi qator\nikkinchi qator") == "Birinchi qator, ikkinchi qator"
    assert norm("Xatboshi bir.\n\nXatboshi ikki.") == "Xatboshi bir. Xatboshi ikki."
    assert norm("- birinchi\n- ikkinchi") == "birinchi, ikkinchi"


def test_qollab_quvvatlanmaydigan_yozuv():
    """espeak-uz arab/CJK belgining tavsifini o'qiydi ("arabicyeh", "chineseletter")."""
    assert norm("Samarqand (forscha: ياري) shahri") == "Samarqand shahri"
    assert norm("Yaponcha 西郷 nomi") == "Yaponcha nomi"


# ──────────── testerlar topadigan qoldiq nuqsonlar (2026-07-23) ───────────────

def test_sana_kundalik_shakl():
    """DD.MM.YYYY / DD/MM/YYYY — ENG ko'p yoziladigan shakl. Ilgari nuqta o'nlik
    kasr va gap oxiri deb o'qilib sana parchalanardi."""
    assert norm("Dushanba, 22.07.2026") == "Dushanba, yigirma ikkinchi iyul ikki ming yigirma oltinchi yil"
    assert norm("Sana 5/12/2025 edi") == "Sana beshinchi dekabr ikki ming yigirma beshinchi yil edi"
    # 4 xonali yil bo'lmasa — bu haqiqiy o'nlik kasr, sanaga aylantirilmasin
    assert norm("3.14 soni") == "uch butun o'n to'rt soni"


def test_uzun_id_raqamlab():
    """12+ xonali ID (JSHSHIR, karta) — raqamlab, 3 tadan guruhlab (pauza bilan)."""
    out = norm("JSHSHIR 12345678901234")
    assert "million" not in out and "ming" not in out, out
    assert out.endswith("bir ikki uch, to'rt besh olti, yetti sakkiz to'qqiz, nol bir ikki, uch to'rt")
    # minglik guruh (ajratgichli) katta son bo'lib qolishi kerak — buzilmasin
    assert norm("1 000 000 000 so'm") == "bir milliard so'm"
    assert norm("250 000 so'm") == "ikki yuz ellik ming so'm"


def test_unlisiz_akronim_harflanadi():
    """CNN/BBC/TTS = unlisiz initsializm -> harflab. espeak xomini "ts-en-en",
    transliteratsiya "KNN" qilardi; ikkalasi ham xato."""
    assert norm("CNN va BBC telekanali") == "se en en va be be se telekanali"
    assert norm("TTS xizmati SMS yubordi") == "te te es xizmati es em es yubordi"
    # unli bor akronim = so'z sifatida o'qiladi, harflanmaydi
    assert norm("NATO va FIFA") == "NATO va FIFA"
    # aralash registrli token (MChJ) butun tokendan bo'lak sifatida ushlanmasin
    assert norm("MChJ ochildi") == "mas'uliyati cheklangan jamiyat ochildi"


def test_url_hashtag_email():
    """espeak "/" va "#" ni INGLIZ ovozida "slash"/"hash" deb o'qib til almashtiradi."""
    assert norm("nexttts.uz/kabinet sahifasi") == "nekst te te es.uz sahifasi"
    assert norm("#TTS va #sunay") == "te te es va sunay"
    assert norm("admin@nexttts.uz ga") == "admin nekst te te es.uz ga"


def test_daraja_belgisi():
    """Klaviaturadan "2^10" — ^ jimgina tushib ma'no yo'qolardi."""
    assert norm("2^10 = 1024") == "ikki daraja o'n teng ming yigirma to'rt"
    assert norm("x^2 + y^3") == "iks kvadrat qo'shuv igrek kub"


def test_fizik_birlik_ustma_ust():
    """"m/s2" — lexicon "m/s" ni yeb "2" ni osiltirib qo'yardi; endi sci "m/s2"ni oladi."""
    assert norm("9,8 m/s2 tezlanish") == "to'qqiz butun sakkiz metr soniya kvadratiga tezlanish"
    assert norm("25 m/s tezlik") == "yigirma besh metr sekundiga tezlik"


# ─────────────────────────────── umumiy smoke ────────────────────────────────

def test_aralash_matnda_raqam_qolmaydi():
    """Uchidan-uchiga: espeak'ga faqat o'qiladigan so'z borishi kerak."""
    out = norm("2026-07-22 kuni 15 ta talaba 3-bosqichga o'tdi, "
               "byudjet 1 250 000 so'm, harorat -5 daraja edi.")
    assert not any(ch.isdigit() for ch in out), out
    assert "-" not in out, out


# ───────────────────────────────── runner ────────────────────────────────────

def main() -> int:
    tests = [(n, f) for n, f in sorted(globals().items())
             if n.startswith("test_") and callable(f)]
    failed, skipped = [], []
    for name, fn in tests:
        try:
            if fn() == "skip":
                skipped.append(name)
                continue
            print(f"  ✅ {name}")
        except Exception as e:   # AssertionError ham, kutilmagan xato ham
            # Bitta test yiqilsa qolganlari baribir ishlasin — regressiyaning
            # to'liq ko'lami bir yugurishda ko'rinishi kerak.
            failed.append((name, e))
            print(f"  ❌ {name}: {type(e).__name__}: {e}")
    total = len(tests)
    print(f"\n{total - len(failed) - len(skipped)}/{total} o'tdi"
          + (f", {len(skipped)} tashlab ketildi" if skipped else "")
          + (f", {len(failed)} YIQILDI" if failed else ""))
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
