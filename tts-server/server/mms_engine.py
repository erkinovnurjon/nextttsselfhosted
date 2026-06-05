"""
mms_engine.py
=============

Meta MMS (facebook/mms-tts-uzb-script_cyrillic) — o'zbek TTS engine.

Barcha ovozlar TOZA base modelidan (fine-tune SIFATNI buzgani ASR bilan isbotlangan).
Erkak/ayol = base'ni ohang (pitch) bilan surish — tiniqlik saqlanadi (±3 yarim ton, ASR-tasdiqlangan).

Matn tinish belgilarida bo'laklanadi + orasiga jimlik (pauza) qo'yiladi.
Lotin matn avtomatik kirillga o'giriladi.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

MODEL_ID = "facebook/mms-tts-uzb-script_cyrillic"

# Ovoz -> Praat "Change gender" (formant_shift, new_pitch_median). None = base (o'zgarishsiz).
# Praat formant+ohangni birga o'zgartiradi → TABIIY (pitch-shift robot qilardi).
# ASR tasdiqladi: tiniqlik saqlanadi.
VOICE_GENDER: dict[str, tuple | None] = {
    "base": None,
    # "ayol" — foydalanuvchi tanlagan audition #1 (id 1187023182) ohangiga
    # moslandi: o'sha ovozning median pitch'i ~281 Hz (yorqin/baland ayol).
    # Praat formant+pitch bilan yaqinlashtirildi (base MMS sifati saqlanadi,
    # fine-tune YO'Q). Aniq sozlash: MMS_AYOL_PITCH / MMS_AYOL_FORMANT env.
    "ayol": (float(os.environ.get("MMS_AYOL_FORMANT", "1.15")),
             float(os.environ.get("MMS_AYOL_PITCH", "265"))),
    "erkak": (float(os.environ.get("MMS_ERKAK_FORMANT", "0.92")),
              float(os.environ.get("MMS_ERKAK_PITCH", "110"))),
}
VOICE_LABELS = {"base": "Asosiy", "erkak": "Erkak", "ayol": "Ayol"}
# Asosiy ovoz — foydalanuvchi so'rovi bilan ayol qilindi.
DEFAULT_VOICE = os.environ.get("MMS_DEFAULT_VOICE", "ayol")


def _voice_available(voice: str) -> bool:
    return voice in VOICE_GENDER


def available_voices() -> list[dict]:
    return [{"id": v, "label": VOICE_LABELS.get(v, v), "available": True}
            for v in VOICE_GENDER]


def _change_gender(wav, sr, formant_shift, new_pitch):
    """Praat orqali tabiiy gender konversiya (formant + ohang)."""
    import numpy as np
    try:
        import parselmouth
        from parselmouth.praat import call
        s = parselmouth.Sound(np.asarray(wav, dtype="float64"), sampling_frequency=sr)
        g = call(s, "Change gender", 75, 600, formant_shift, new_pitch, 1.0, 1.0)
        return np.asarray(g.values[0], dtype="float32")
    except Exception:
        return np.asarray(wav, dtype="float32")


# Lotin -> Kirill
_LAT2CYR = [
    ("oʻ", "ў"), ("gʻ", "ғ"), ("o'", "ў"), ("g'", "ғ"),
    ("sh", "ш"), ("ch", "ч"), ("ng", "нг"),
    ("ya", "я"), ("yo", "ё"), ("yu", "ю"), ("ye", "е"),
    ("a", "а"), ("b", "б"), ("d", "д"), ("e", "е"), ("f", "ф"),
    ("g", "г"), ("h", "ҳ"), ("i", "и"), ("j", "ж"), ("k", "к"),
    ("l", "л"), ("m", "м"), ("n", "н"), ("o", "о"), ("p", "п"),
    ("q", "қ"), ("r", "р"), ("s", "с"), ("t", "т"), ("u", "у"),
    ("v", "в"), ("x", "х"), ("y", "й"), ("z", "з"),
    ("'", "ъ"),
]


def latin_to_cyrillic(text: str) -> str:
    for ap in ("ʻ", "ʼ", "`", "‘", "’", "ʾ", "´"):
        text = text.replace(ap, "'")
    out = text.lower()
    # Kontekstли 'e': so'z boshida va unliдан keyin -> 'э' (toza /e/). Aks holda kirill
    # 'е' "ye" deb o'qiladi (erkin -> "yerkin"). Undoshдан keyin esa 'е' to'g'ри (/e/).
    # 'ye' (lotin) tegmaydi — 'e' undan oldin 'y' bilan keladi.
    out = re.sub(r"(?<![a-z'])e", "э", out)   # so'z boshi
    out = re.sub(r"(?<=[aeiou])e", "э", out)  # unliдан keyin
    for lat, cyr in _LAT2CYR:
        out = out.replace(lat, cyr)
    return out


def _envf(name: str, default: float) -> float:
    try:
        return float(os.environ.get(name, ""))
    except ValueError:
        return default


def _device() -> str:
    forced = os.environ.get("MMS_DEVICE", "").strip().lower()
    if forced in ("cpu", "cuda"):
        return forced
    import torch
    return "cuda" if torch.cuda.is_available() else "cpu"


# Faqat YANGI QATORda (\n) alohida sintez qilamiz (foydalanuvchi ataylab bo'lgan joy).
# QOLGAN HAMMA tinish belgisi (nuqta, vergul, ?, ! ...) bo'linmaydi — ular bir nechta
# BO'SH JOYga almashtiriladi: MMS tokenizeri belgini o'chiradi, lekin bo'sh joyni
# saqlab ko'paytiradi → BITTA sintez ichida pauza bo'ladi, ovoz esa O'ZGARMAYDI
# (alohida sintez nuqта/vergулда "boshqa odam"dek chiqarardi).
_PAUSE_AFTER = {"\n": 0.45}
_SPLIT_RE = re.compile(r"([\n])")

# Tinish belgisi -> bo'sh joy soni (pauza uzunligi). Bittasi ~0.04-0.06s jimlik.
# Gap oxiri (. ! ? …) uzunroq, vergul/ichki belgilar qisqaroq pauza oladi.
_INNER_PAUSE_SPACES = {".": 9, "!": 9, "?": 9, "…": 9, ";": 5, ":": 4,
                       ",": 3, "—": 4, "–": 3}


def _inner_pauses_to_spaces(text: str) -> str:
    """Vergul va boshqa ichki belgilarni bo'sh joylarga almashtirib pauza yaratadi."""
    for ch, n in _INNER_PAUSE_SPACES.items():
        text = text.replace(ch, " " * n)
    return text


def _split_for_pauses(text: str):
    pieces = _SPLIT_RE.split(text)
    segs, buf = [], ""
    for p in pieces:
        if p in _PAUSE_AFTER:
            if buf.strip():
                segs.append((buf.strip(), _PAUSE_AFTER[p]))
            buf = ""
        else:
            buf += p
    if buf.strip():
        segs.append((buf.strip(), 0.0))
    return segs or [(text.strip(), 0.0)]


_state: dict = {}


def _load() -> dict:
    if _state:
        return _state
    from transformers import VitsModel, AutoTokenizer
    device = _device()
    model = VitsModel.from_pretrained(MODEL_ID).to(device).eval()
    tok = AutoTokenizer.from_pretrained(MODEL_ID)
    # noise_scale_duration=0.2: ozgina tabiiy ritm (ODAMIYLIK) — 0.0 mexanik, 0.6 tutilardi.
    # Bu oraliq jonli, lekin hezitatsiya bermaydi.
    # noise_scale=0.4: tinch/bir maromli, butun gap bo'ylab bir xil ovoz.
    model.noise_scale_duration = _envf("MMS_NOISE_SCALE_DURATION", 0.2)
    model.speaking_rate = _envf("MMS_SPEAKING_RATE", model.speaking_rate)
    model.noise_scale = _envf("MMS_NOISE_SCALE", 0.4)
    _state.update(model=model, tok=tok, sr=model.config.sampling_rate, device=device)
    return _state


def is_loaded() -> bool:
    return bool(_state)


def info() -> dict:
    return {"loaded": is_loaded(), "default": DEFAULT_VOICE, "voices": available_voices()}


def _biquad_lowshelf(sr, f0, gain_db, q=0.9):
    import math
    A = 10 ** (gain_db / 40.0)
    w0 = 2 * math.pi * f0 / sr
    cw, sw = math.cos(w0), math.sin(w0)
    alpha = sw / (2 * q)
    tsAa = 2 * math.sqrt(A) * alpha
    b0 = A * ((A + 1) - (A - 1) * cw + tsAa); b1 = 2 * A * ((A - 1) - (A + 1) * cw)
    b2 = A * ((A + 1) - (A - 1) * cw - tsAa); a0 = (A + 1) + (A - 1) * cw + tsAa
    a1 = -2 * ((A - 1) + (A + 1) * cw); a2 = (A + 1) + (A - 1) * cw - tsAa
    return [b0 / a0, b1 / a0, b2 / a0], [1.0, a1 / a0, a2 / a0]


def postprocess(wav, sr: int, strength: float = 1.0):
    """Yumshoq: ozgina iliqlik (past-shelf) + balandlik normalizatsiya."""
    import numpy as np
    from scipy.signal import lfilter
    x = np.asarray(wav, dtype=np.float32)
    if x.size < 8:
        return x
    x = x - float(x.mean())
    if strength > 0:
        b, a = _biquad_lowshelf(sr, 200.0, 2.0 * float(strength))
        x = lfilter(b, a, x).astype(np.float32)
    peak = float(np.max(np.abs(x))) + 1e-8
    return (x / peak * 0.92).astype(np.float32)


def synthesize(text: str, voice: str | None = None, speaking_rate: float | None = None,
               noise_scale_duration: float | None = None):
    """Matndan WAV. voice: base|erkak|ayol (pitch bilan farqlanadi)."""
    import numpy as np
    import torch

    v = voice if voice in VOICE_GENDER else DEFAULT_VOICE
    st = _load()
    model = st["model"]
    if speaking_rate is not None:
        model.speaking_rate = float(speaking_rate)
    if noise_scale_duration is not None:
        model.noise_scale_duration = float(noise_scale_duration)

    sr = st["sr"]
    cyr_full = latin_to_cyrillic(text)
    # Barcha bo'laklar bir xil seed bilan — VITS noise_scale latent shovqini har
    # chaqiriqda bir xil bo'lib, ovoz tembri/xarakteri butun matn bo'ylab BARQAROR
    # qoladi (aks holda har bo'lak "boshqa odam"dek eshitiladi).
    seed = int(_envf("MMS_SEED", 1234))
    chunks = []
    for seg, pause in _split_for_pauses(text):
        cyr = latin_to_cyrillic(seg)
        if not cyr.strip():
            continue
        cyr = _inner_pauses_to_spaces(cyr)  # vergul -> bo'sh joy (pauza, bitta sintez ichида)
        inputs = st["tok"](cyr, return_tensors="pt").to(st["device"])
        with torch.no_grad():
            torch.manual_seed(seed)
            if st["device"] == "cuda":
                torch.cuda.manual_seed_all(seed)
            seg_wav = model(**inputs).waveform[0].cpu().numpy().astype(np.float32)
        try:
            import librosa
            seg_wav, _ = librosa.effects.trim(seg_wav, top_db=30)
        except Exception:
            pass
        chunks.append(seg_wav)
        if pause > 0:
            chunks.append(np.zeros(int(pause * sr), dtype=np.float32))
    wav = np.concatenate(chunks) if chunks else np.zeros(1, dtype=np.float32)

    # Gender konversiya (Praat) — toza base'dan tabiiy erkak/ayol, tiniqlik saqlanadi
    gp = VOICE_GENDER.get(v)
    if gp is not None:
        wav = _change_gender(wav, sr, gp[0], gp[1])

    strength = _envf("MMS_POSTPROCESS", 1.0)
    if strength > 0:
        wav = postprocess(wav, sr, strength)
    return wav, sr, cyr_full
