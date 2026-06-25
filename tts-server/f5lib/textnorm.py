"""F5 matn normalizatsiyasi va jumlaga bo'lish.

MUHIM: bu yerdagi normalizatsiya TRAINING bilan AYNAN bir xil bo'lishi shart
(train: scripts/finalize_f5_metadata.py NORM bilan mos). Hech bir qoidani
o'zgartirmang — sintez natijasi buziladi.
"""

import json as _json
import os
import re
from pathlib import Path

# tts-server/ (f5lib ichidan bir pog'ona yuqori) — f5_pron.json shu yerda.
ROOT = Path(__file__).resolve().parents[1]

# ── Matn normalizatsiyasi (TRAINING bilan AYNAN bir xil bo'lishi shart!) ──
_NORM = [("﻿", ""), ("​", ""), (" ", " "),  # BOM / zero-width / nbsp — F5 buzadi
         ("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
         ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
         ("—", "-"), ("–", "-"), ("…", "..."),
         ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]


def normalize(t: str) -> str:
    for a, b in _NORM:
        t = t.replace(a, b)
    return t.strip()


# Trening datasining ~78% (raw ISSAI 100.7k klip) BUTUNLAY kichik harfda — bosh harfli
# so'z ("Xalqaro") model uchun siyrak belgi: katta "X" ni "iks" deb o'qib yuborishi mumkin.
# Faqat bosh harfi katta (Title-case) so'zlarni kichraytiramiz; to'liq KATTA qisqartma
# (AQSH, BMT) tegilmaydi. F5_LOWER=0 bilan o'chadi.
_TITLE_WORD = re.compile(r"\b[A-ZА-ЯЁЎҒҚҲ][\w'ʻ-]*")


def smart_lowercase(t: str) -> str:
    if os.environ.get("F5_LOWER", "1") == "0":
        return t

    def fix(m: re.Match) -> str:
        w = m.group(0)
        if any(c.isupper() for c in w[1:]):  # AQSH, BMT — qisqartma, tegmaymiz
            return w
        return w.lower()

    return _TITLE_WORD.sub(fix, t)


# F5 talaffuz lug'ati: so'z BOSHIDAGI "x" ni "kh" ga almashtiramiz — model /x/ tovushini
# shunda to'g'ri chiqaradi (foydalanuvchi quloq bilan tasdiqladi: khalq -> to'g'ri 'xalq').
# So'z O'RTASIDAGI x (yaxshi, axborot) yaxshi o'qiladi — tegilmaydi. Lookbehind apostrof/
# harfni istisno qiladi (o'xshash dagi x mid-word -> tegilmaydi). F5_FIX_X=0 bilan o'chadi.
_X_INIT = re.compile(r"(?<![a-zA-Z'`’ʻ])([xX])")


def fix_x_pronunciation(t: str) -> str:
    # Default O'CHIQ: uzbek70+ avlod modellar /x/ ni o'zi to'g'ri o'qiydi, kh-hiyla
    # ularda ZARAR (x-zich matn ASR-eval: khOFF 16% vs khON 40%). F5_FIX_X=1 bilan yonadi
    # (faqat eski feruza/uzbek_deploy'dan oldingi ckpt uchun kerak bo'lishi mumkin).
    if os.environ.get("F5_FIX_X", "0") == "0":
        return t
    return _X_INIT.sub(lambda m: "Kh" if m.group(1) == "X" else "kh", t)


def fix_x_all(t: str) -> str:
    # ayol modeli uchun: BARCHA x -> kh (training metadata'si shunday normalizatsiyalangan,
    # model kh = /x/ ni o'rgangan). test_ayol_final.py norm() bilan AYNAN bir xil.
    return t.replace("X", "Kh").replace("x", "kh")


def apply_x2kh(t: str, mode: str) -> str:
    return fix_x_all(t) if mode == "all" else fix_x_pronunciation(t)


# Talaffuz lug'ati: F5/uzbek100 ba'zi so'z-O'RTA "x"ни "ks" deb o'qiydi (tarixi -> "tariksi").
# Bu so'zlarni "h" yozuviga aylantiramiz (foydalanuvchi quloq bilan tasdiqladi: "tarih" to'g'ri).
# Stem bo'yicha — tarix/tarixi/tarixiy/tarixchi hammasi tuzaladi. Kengaytirish uchun
# tts-server/f5_pron.json {"so'z": "talaffuz", ...} fayl qo'shing (qayta ishga tushiring).
_PRON_FIX = {"tarix": "tarih"}
_pp = ROOT / "f5_pron.json"
if _pp.exists():
    try:
        _PRON_FIX.update({k.lower(): v for k, v in _json.loads(_pp.read_text(encoding="utf-8")).items()})
    except Exception:
        pass
_PRON_RE = (
    re.compile(r"(?<![\w'ʻ`’])(" + "|".join(re.escape(k) for k in sorted(_PRON_FIX, key=len, reverse=True)) + r")", re.IGNORECASE)
    if _PRON_FIX else None
)


def apply_pron_fix(t: str) -> str:
    if _PRON_RE is None:
        return t
    return _PRON_RE.sub(lambda m: _PRON_FIX[m.group(1).lower()], t)


# Gap oxiri belgilaridan keyin bo'lamiz (probel/satr oxiri bilan). F5 uzun matnni
# bir o'qishda chalkashtiradi — har jumlani ALOHIDA sintez qilsak o'qish ancha
# aniqroq bo'ladi (ASR-sweep: nfe=48 bilan birga eng yaxshi natija).
_SENT_SPLIT = re.compile(r"(?<=[.!?…])\s+")


def split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        for s in _SENT_SPLIT.split(line):
            s = s.strip()
            if s:
                parts.append(s)
    # Juda qisqa bo'laklarni (masalan "1.") oldingi jumlaga qo'shamiz.
    merged: list[str] = []
    for s in parts:
        if merged and len(s.replace(".", "").strip()) < 3:
            merged[-1] = merged[-1] + " " + s
        else:
            merged.append(s)
    return merged or [text]
