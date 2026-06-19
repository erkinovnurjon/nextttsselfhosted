# F5 vs MMS o'qish aniqligini OBYEKTIV o'lchaydi: chiqishni ASR bilan transkripsiya
# qilib, kiritilgan matn bilan solishtiradi (WER/CER). F5 ovozi tabiiy, lekin so'zlarni
# to'g'ri o'qiyaptimi — shuni raqamlar bilan ko'rsatadi.
#
# Ishga tushirish (asosiy .venv, ASR CPU'da):
#   cd tts-server
#   WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv/Scripts/python.exe training/scripts/diag_f5_intelligibility.py
import os
import re
import sys
from pathlib import Path

os.environ.setdefault("WHISPER_DEVICE", "cpu")
ROOT = Path(__file__).resolve().parents[2]  # tts-server/
sys.path.insert(0, str(ROOT))

import numpy as np
import soundfile as sf

from server import whisper_engine

OUT = ROOT / "output"
VOICES = ROOT / "voices"

TESTS = [
    "Assalomu alaykum, bu o'zbek tilidagi sun'iy ovoz sinovi.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Toshkent O'zbekistonning poytaxti va eng yirik shahri.",
    "Ilm olish har bir inson uchun muqaddas burchdir, deb hisoblayman.",
]


def norm_words(t: str) -> list[str]:
    t = t.lower().replace("'", "").replace("ʻ", "").replace("`", "")
    t = re.sub(r"[^a-zа-яёўғқҳ ]+", " ", t)
    return [w for w in t.split() if w]


def wer(ref: str, hyp: str) -> float:
    r, h = norm_words(ref), norm_words(hyp)
    if not r:
        return 0.0
    # Levenshtein (so'z darajasida)
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / len(r)


def asr_wav(path: Path) -> str:
    w, sr = sf.read(str(path))
    w = np.asarray(w, dtype="float32")
    if w.ndim > 1:
        w = w.mean(axis=1)
    import io
    buf = io.BytesIO()
    sf.write(buf, w, sr, format="WAV", subtype="PCM_16")
    return whisper_engine.transcribe(buf.getvalue())


print("=" * 70)
print("0) REFERENCE moslik tekshiruvi (F5 uchun KRITIK)")
print("=" * 70)
ref_txt = (VOICES / "f5_ref_feruza.txt").read_text(encoding="utf-8").strip()
ref_heard = asr_wav(VOICES / "f5_ref_feruza.wav")
print(f"  ref_txt (yozilgan): {ref_txt}")
print(f"  ASR eshitdi       : {ref_heard}")
print(f"  WER (moslik)      : {wer(ref_txt, ref_heard):.0%}  (past = yaxshi moslik)")

print()
print("=" * 70)
print("1) F5 chiqishlari o'qish aniqligi (output/_f5_model_last_*.wav)")
print("=" * 70)
f5_wers = []
for i, t in enumerate(TESTS, 1):
    p = OUT / f"_f5_model_last_{i}.wav"
    if not p.exists():
        print(f"  [{i}] (yo'q: {p.name})")
        continue
    heard = asr_wav(p)
    e = wer(t, heard)
    f5_wers.append(e)
    print(f"  [{i}] WER={e:.0%}")
    print(f"       kutilgan: {t}")
    print(f"       eshitdi : {heard}")

if f5_wers:
    print(f"\n  >>> F5 o'rtacha WER: {sum(f5_wers)/len(f5_wers):.0%}")
print("\nTAYYOR.")
