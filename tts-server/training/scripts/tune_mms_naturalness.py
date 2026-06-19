# MMS "ayol" ovozini KAMROQ ROBOTSIMON qilish uchun variantlar generatsiya qiladi.
# Naturallik subyektiv — quloq bilan baholanadi, shuning uchun bir nechta variant
# yasab output/mms_tune/ ga saqlaydi. Eng tabiiysini tanlab mms_engine.py'ga qo'yamiz.
#
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv/Scripts/python.exe training/scripts/tune_mms_naturalness.py
import os, sys
from pathlib import Path
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))

import numpy as np
import soundfile as sf
from server import mms_engine

OUT = ROOT / "output" / "mms_tune"
OUT.mkdir(parents=True, exist_ok=True)

# x, q, o', g' va tabiiy gap — robotsimonlik va talaffuz birga eshitilsin.
TEXT = ("Toshkent shahrida xalq ko'p, bog'larida qushlar sayraydi. "
        "Bugun ob-havo ochiq va iliq, kayfiyat a'lo.")

st = mms_engine._load()
model = st["model"]

# (nom, gender=(formant,pitch) yoki None, noise_scale, noise_scale_duration, speaking_rate)
# Asosiy g'oya: noise↑ = jonliroq (monoton kamayadi); gender yumshoq = kam artefakt.
VARIANTS = [
    ("01_base_xom",          None,         0.40, 0.20, None),   # xom MMS base (taqqoslash)
    ("02_ayol_HOZIRGI",      (1.15, 265),  0.40, 0.20, None),   # hozirgi production
    ("03_ayol_jonli",        (1.15, 265),  0.60, 0.40, None),   # noise↑ — jonliroq
    ("04_ayol_defaultnoise", (1.15, 265),  0.667,0.40, None),   # MMS default jonlilik
    ("05_ayol_yumshoq",      (1.08, 245),  0.60, 0.40, None),   # gender yumshoq + jonli
    ("06_ayol_tabiiy",       (1.10, 255),  0.667,0.50, 0.95),   # eng tabiiyga urinish
    ("07_ayol_pitchkam",     (1.12, 240),  0.60, 0.45, None),   # pastroq pitch (kam "chiyillash")
]

print(f"Matn: {TEXT}\n")
for name, gender, ns, nsd, rate in VARIANTS:
    model.noise_scale = ns
    mms_engine.VOICE_GENDER["ayol"] = gender  # base uchun voice="base" ishlatamiz
    voice = "base" if gender is None else "ayol"
    wav, sr, _ = mms_engine.synthesize(TEXT, voice=voice, speaking_rate=rate,
                                       noise_scale_duration=nsd)
    p = OUT / f"_mms_{name}.wav"
    sf.write(str(p), np.asarray(wav), sr, subtype="PCM_16")
    g = "—" if gender is None else f"formant={gender[0]} pitch={gender[1]}"
    print(f"  {p.name:28s}  noise={ns:<5} nsd={nsd:<4} rate={rate}  {g}  ({len(wav)/sr:.1f}s)")

print(f"\nTAYYOR. Tingla: {OUT}")
print("Eng tabiiy/kam-robotsimon RAQAMni ayt — o'shani default qilamiz.")
