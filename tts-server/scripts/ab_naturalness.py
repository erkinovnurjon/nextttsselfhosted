"""
ab_naturalness.py
=================

Tabiiylik uchun inference parametrlarini QULOQ bilan tanlash.

Bitta jumlani turli `speaking_rate` va `noise_scale_duration` bilan sintez qilib,
WAV fayllarni `tts-server/output/ab/` ga saqlaydi. Eng tabiiy eshitilganini tanlang
va uni `mms_engine.py` default'iga (yoki .env) qo'ying.

Ishga tushirish (backend 8000'da turgan bo'lsa):
    tts-server\.venv\Scripts\python.exe tts-server\scripts\ab_naturalness.py
    # yoki o'z jumlangiz bilan:
    ...\python.exe ab_naturalness.py "Bugun ob-havo juda ajoyib, quyoshli kun."

Natija: output/ab/ ichida sr<rate>_nsd<dur>.wav fayllar.
"""

from __future__ import annotations

import sys
import urllib.request
import json
from pathlib import Path

BACKEND = "http://127.0.0.1:8000/synthesize/mms"

DEFAULT_TEXT = (
    "Assalomu alaykum! Bugun OTM da soat 9:00 da uchrashamiz. "
    "Ob-havo ajoyib, harorat 25 selsiy."
)

# Sinaladigan parametr to'rlari (naturalность uchun eng ta'sirlilari)
SPEAKING_RATES = [0.85, 0.9, 1.0]          # past = sekinroq/bosiqroq
NOISE_SCALE_DURATIONS = [0.0, 0.2, 0.4]    # ritm tabiiyligi (0 = mexanik, 0.4 = jonli)
VOICE = "base"


def synth(text: str, rate: float, nsd: float) -> bytes:
    body = json.dumps({
        "text": text,
        "normalize": True,
        "voice": VOICE,
        "speaking_rate": rate,
        "noise_scale_duration": nsd,
    }).encode("utf-8")
    req = urllib.request.Request(BACKEND, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        return resp.read()


def main() -> None:
    text = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_TEXT
    out_dir = Path(__file__).resolve().parents[1] / "output" / "ab"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Matn: {text}\nSaqlanadi: {out_dir}\n")
    for rate in SPEAKING_RATES:
        for nsd in NOISE_SCALE_DURATIONS:
            name = f"sr{rate:.2f}_nsd{nsd:.1f}.wav".replace(".", "p", 2)
            try:
                wav = synth(text, rate, nsd)
                (out_dir / name).write_bytes(wav)
                print(f"  ✓ {name}  ({len(wav)//1024} KB)")
            except Exception as e:
                print(f"  ✗ {name}: {e}")

    print(
        "\nEng tabiiysini tanlang. Keyin uni doimiy qilish uchun .env ga qo'ying, masalan:\n"
        "  MMS_SPEAKING_RATE=0.9\n"
        "  MMS_NOISE_SCALE_DURATION=0.2\n"
        "  MMS_NOISE_SCALE=0.4   (bu faqat server qayta ishga tushganda qo'llanadi)\n"
    )


if __name__ == "__main__":
    main()
