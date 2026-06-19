# "x" tovushini F5 qanday o'qishini tekshiradi: so'z boshi vs o'rtasi, va respelling
# (qayta yozish) yordam beradimi. Ishlab turgan F5 server (:8001) orqali, ASR + audio.
#   cd tts-server
#   WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/probe_x_sound.py
import io, os, re, sys
from pathlib import Path
os.environ.setdefault("WHISPER_DEVICE", "cpu")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import numpy as np, soundfile as sf, requests
from server import whisper_engine

OUT = ROOT / "output" / "x_probe"
OUT.mkdir(parents=True, exist_ok=True)

# (yorliq, ko'rsatiladigan_matn, kutilgan_so'z) — model nima desa ASR yozadi.
CASES = [
    # so'z boshi "x"
    ("init_xalq",        "xalq",        "xalq"),
    ("init_xabar",       "xabar",       "xabar"),
    ("init_xavf",        "xavfsizlik",  "xavfsizlik"),
    ("init_xona",        "xona",        "xona"),
    # so'z o'rtasi "x" (taqqoslash — buni yaxshi o'qisa, muammo faqat so'z boshida)
    ("mid_yaxshi",       "yaxshi",      "yaxshi"),
    ("mid_axborot",      "axborot",     "axborot"),
    # RESPELLING urinishlari (xalq uchun) — qaysi biri /x/ ni to'g'ri chiqaradi?
    ("re_h_halq",        "halq",        "xalq"),
    ("re_kh_khalq",      "khalq",       "xalq"),
    ("re_xx_xxalq",      "xxalq",       "xalq"),
    ("re_hx_hxalq",      "hxalq",       "xalq"),
    # kontekst ichida (so'z boshi emas)
    ("ctx_bu_xalq",      "bu xalq",     "bu xalq"),
]

def asr_bytes(b):
    w, sr = sf.read(io.BytesIO(b)); w = np.asarray(w, dtype="float32")
    if w.ndim > 1: w = w.mean(axis=1)
    buf = io.BytesIO(); sf.write(buf, w, sr, format="WAV", subtype="PCM_16")
    return whisper_engine.transcribe(buf.getvalue())

print("ASR + sintez (ishlab turgan F5 server orqali)...\n", flush=True)
for name, text, want in CASES:
    r = requests.post("http://127.0.0.1:8001/synthesize/f5",
                      json={"text": text, "speed": 1.0, "nfe_step": 48}, timeout=120)
    if r.status_code != 200:
        print(f"  {name}: XATO {r.status_code}"); continue
    open(OUT / f"{name}.wav", "wb").write(r.content)
    heard = asr_bytes(r.content)
    mark = "OK" if want.split()[-1] in heard else "??"
    print(f"  [{mark}] {name:16s} matn='{text}'  -> ASR: '{heard}'")

print(f"\nAudio: {OUT}")
print("Tinglab ayt: so'z boshi 'x' qaysi yozuvda eng to'g'ri (/x/) eshitiladi?")
