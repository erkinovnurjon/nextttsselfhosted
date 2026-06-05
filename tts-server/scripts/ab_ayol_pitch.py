"""
ab_ayol_pitch.py
================

"Ayol" ovozining ohangini audition #1 (id 1187023182, median ~281 Hz) ga
QULOQ bilan moslash. MMS modelini BIR MARTA yuklab, bitta jumlani turli
pitch qiymatlarida sintez qiladi va `output/ab_ayol/` ga yozadi.

DIQQAT: MMS modelini yuklaydi. Ishlab turgan backend GPU'da bo'lsa segfault
xavfi bor — shuning uchun CPU'da ishga tushiring (yoki avval backendni to'xtating):

    set MMS_DEVICE=cpu
    tts-server\.venv\Scripts\python.exe tts-server\scripts\ab_ayol_pitch.py

Eng yoqqan pitchni tanlab, mms_engine.py dagi MMS_AYOL_PITCH (yoki .env) ga qo'ying.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # tts-server/

import numpy as np
import soundfile as sf
from server import mms_engine as M

TEXT = "Assalomu alaykum! Bugun ob-havo juda ajoyib, quyoshli kun bo'ldi."
FORMANT = float(os.environ.get("AB_FORMANT", "1.15"))
PITCHES = [250, 265, 281]  # audition #1 median ~281


def main() -> None:
    out_dir = Path(__file__).resolve().parents[1] / "output" / "ab_ayol"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"Matn: {TEXT}\nFormant: {FORMANT}\nPitchlar: {PITCHES}\n")
    # Base (gendersiz) to'lqinni bir marta olamiz
    wav, sr, _ = M.synthesize(TEXT, voice="base")

    for p in PITCHES:
        shifted = M._change_gender(np.asarray(wav, dtype="float64"), sr, FORMANT, float(p))
        shifted = M.postprocess(shifted, sr)
        name = f"ayol_pitch{p}.wav"
        sf.write(out_dir / name, shifted, sr, subtype="PCM_16")
        # O'lchangan median pitch
        try:
            import parselmouth
            f0 = parselmouth.Sound(np.asarray(shifted, dtype="float64"), sampling_frequency=sr).to_pitch().selected_array["frequency"]
            med = float(np.median(f0[f0 > 0])) if (f0 > 0).any() else 0.0
            print(f"  ✓ {name}  (median ~{med:.0f} Hz)")
        except Exception:
            print(f"  ✓ {name}")

    print(f"\nFayllar: {out_dir}\nReferens: public/audition/1187023182.wav (median ~281 Hz)")
    print("Eng yaqinini tanlab MMS_AYOL_PITCH ga qo'ying.")


if __name__ == "__main__":
    main()
