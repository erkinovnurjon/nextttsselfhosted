"""
whisper_engine.py
=================

Ovozli kiritish (ASR) — Whisper orqali o'zbek nutqini matnga aylantiradi.
Foydalanuvchi mikrofonда gapiradi → matn → keyin TTS o'qiydi.

Default CPU (GPU MMS uchun bo'sh qoladi). WHISPER_DEVICE / WHISPER_MODEL env bilan sozlanadi.
"""

from __future__ import annotations

import os

_state: dict = {}

# Kirill -> Lotin (o'zbek). Whisper ba'zan kirillда qaytaradi; ilova lotinда ishlaydi.
# Uzunroq birikmalar avval (ng, ё, ю, я).
_CYR2LAT = [
    ("нг", "ng"), ("ё", "yo"), ("ю", "yu"), ("я", "ya"), ("ц", "ts"),
    ("ў", "oʻ"), ("ғ", "gʻ"), ("қ", "q"), ("ҳ", "h"), ("ч", "ch"), ("ш", "sh"),
    # begona/qardosh-turkiy harflar (Whisper ba'zan chiqaradi) -> eng yaqin o'zbek
    ("ө", "oʻ"), ("ә", "a"), ("ү", "u"), ("ұ", "u"), ("і", "i"), ("һ", "h"),
    ("ң", "ng"), ("ҷ", "j"), ("ҙ", "z"), ("ҕ", "gʻ"),
    ("а", "a"), ("б", "b"), ("в", "v"), ("г", "g"), ("д", "d"), ("е", "e"),
    ("ж", "j"), ("з", "z"), ("и", "i"), ("й", "y"), ("к", "k"), ("л", "l"),
    ("м", "m"), ("н", "n"), ("о", "o"), ("п", "p"), ("р", "r"), ("с", "s"),
    ("т", "t"), ("у", "u"), ("ф", "f"), ("х", "x"), ("ъ", "ʼ"), ("ь", ""),
    ("ы", "i"), ("э", "e"),
]


def cyrillic_to_latin(text: str) -> str:
    out = text
    for cyr, lat in _CYR2LAT:
        out = out.replace(cyr, lat).replace(cyr.upper(), lat.capitalize())
    return out


def _auto_device() -> int:
    """WHISPER_DEVICE env yoki avto: GPU bor bo'lsa cuda (0), aks holda CPU (-1)."""
    forced = os.environ.get("WHISPER_DEVICE", "").strip().lower()
    if forced == "cuda":
        return 0
    if forced == "cpu":
        return -1
    try:
        import torch
        return 0 if torch.cuda.is_available() else -1
    except Exception:
        return -1


def _load():
    if _state:
        return _state
    from transformers import pipeline
    # Kotib/uzbek_stt_v1: ~1600s o'zbek audioда o'rgatilgan (WER 16.7%), LOTINда
    # chiqaradi. large-v3 o'zbekni qozoqcha/turkiy aralashtirib buzardi; bu maxsus
    # o'zbek modeli ANCHA aniq. WHISPER_MODEL env bilan almashtiriladi.
    model = os.environ.get("WHISPER_MODEL", "Kotib/uzbek_stt_v1")
    device = _auto_device()
    asr = pipeline("automatic-speech-recognition", model=model,
                   chunk_length_s=30, device=device)
    _state.update(asr=asr, model=model, device=device)
    return _state


def transcribe(wav_bytes: bytes) -> str:
    """WAV baytlardan o'zbek matnini qaytaradi."""
    import io
    import numpy as np
    import soundfile as sf

    w, sr = sf.read(io.BytesIO(wav_bytes))
    w = np.asarray(w, dtype="float32")
    if w.ndim > 1:
        w = w.mean(axis=1)
    st = _load()
    out = st["asr"](
        {"array": w, "sampling_rate": int(sr)},
        generate_kwargs={"language": "uz", "task": "transcribe"},
    )
    text = (out.get("text") or "").strip()
    return cyrillic_to_latin(text)  # ilova lotinда ishlaydi
