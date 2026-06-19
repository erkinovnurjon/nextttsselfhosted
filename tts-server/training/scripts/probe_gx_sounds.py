# "x" (so'z o'rtasi) va "g'" (gʻ) tovushlari uchun respelling topadi.
# Foydalanuvchi so'zlari: tarixi (x o'rtada), tog'lari (g'). Audio saqlaydi — QULOQ bilan baholanadi.
#   cd tts-server
#   WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/probe_gx_sounds.py
import io, os, sys
from pathlib import Path
os.environ.setdefault("WHISPER_DEVICE", "cpu")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import numpy as np, soundfile as sf, requests
from server import whisper_engine

OUT = ROOT / "output" / "gx_probe"
OUT.mkdir(parents=True, exist_ok=True)

# (yorliq, F5'ga yuboriladigan matn) — F5_FIX_X server tomonda so'z-boshi x ni o'zgartiradi,
# shuning uchun bu yerda x O'RTADA bo'lgan so'zlar bilan sinaymiz (server tegmaydi).
CASES = [
    # x so'z o'rtasida: tarixi
    ("x_tarixi_orig",   "Bizning tariximiz juda boy."),       # x o'rtada -> hozir xato
    ("x_tarixi_kh",     "Bizning tarikhimiz juda boy."),      # x->kh
    # g' (gʻ): tog'lari, g'alaba
    ("g_toglari_orig",  "Vatanimiz tog'lari ko'rkam."),       # g' -> hozir xato (toglari)
    ("g_toglari_gh",    "Vatanimiz toghlari ko'rkam."),       # g'->gh
    ("g_toglari_gpost", "Vatanimiz togʻlari ko'rkam."),       # asl modifier ʻ
    ("g_galaba_orig",   "Bu katta g'alaba bo'ldi."),          # g' so'z boshi
    ("g_galaba_gh",     "Bu katta ghalaba bo'ldi."),          # g'->gh
    # birga: ikkalasi
    ("both_orig",       "Tariximiz va tog'larimiz."),
    ("both_fixed",      "Tarikhimiz va toghlarimiz."),
]

def asr(b):
    w, sr = sf.read(io.BytesIO(b)); w = np.asarray(w, dtype="float32")
    if w.ndim > 1: w = w.mean(axis=1)
    bf = io.BytesIO(); sf.write(bf, w, sr, format="WAV", subtype="PCM_16")
    return whisper_engine.transcribe(bf.getvalue())

print("Sintez (ishlab turgan F5 server) + ASR (faqat ishora — quloq asosiy)...\n", flush=True)
for name, text in CASES:
    r = requests.post("http://127.0.0.1:8001/synthesize/f5",
                      json={"text": text, "speed": 1.0}, timeout=120)
    open(OUT / f"{name}.wav", "wb").write(r.content)
    print(f"  {name:18s} '{text}'\n      ASR: {asr(r.content)}")

print(f"\nAudio: {OUT}")
print("Tinglab ayt: x uchun 'kh', g' uchun qaysi (gh / gʻ) eng to'g'ri eshitiladi?")
