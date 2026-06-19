# F5 o'qish aniqligini inference PARAMETRLARI bilan yaxshilashga urinish.
# Har config uchun test gaplarni sintez qiladi, ASR bilan transkripsiya qilib WER hisoblaydi.
# Maqsad: ovoz tabiiyligini saqlab, eng PAST WER (eng to'g'ri o'qish) beradigan config topish.
#
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/sweep_f5_params.py
import pyarrow.dataset  # noqa  (torchaudio'dan OLDIN — segfault oldini olish)
import datasets  # noqa

import io
import os
import re
import sys
from pathlib import Path
from importlib.resources import files

os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np
import soundfile as sf
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from server import whisper_engine  # ASR (Kotib/uzbek_stt_v1), CPU

VOICES = ROOT / "voices"
CKPTS = Path(str(files("f5_tts").joinpath("../../ckpts/feruza"))).resolve()
VOCAB = Path(str(files("f5_tts").joinpath("../../data/feruza_char/vocab.txt"))).resolve()
REF_WAV = str(VOICES / "f5_ref_feruza.wav")

_NORM = [("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
         ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
         ("—", "-"), ("–", "-"), ("…", "..."), ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]

def norm(t):
    for a, b in _NORM:
        t = t.replace(a, b)
    return t.strip()

REF_TXT = norm((VOICES / "f5_ref_feruza.txt").read_text(encoding="utf-8"))

TESTS = [
    "Assalomu alaykum, bu o'zbek tilidagi sun'iy ovoz sinovi.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Toshkent O'zbekistonning poytaxti va eng yirik shahri.",
    "Ilm olish har bir inson uchun muqaddas burchdir, deb hisoblayman.",
    "Maktab o'quvchilari bilim olish uchun har kuni darsga qatnashadi.",
    "Mustaqillik bayrami munosabati bilan shahar ko'chalari bezatildi.",
]

def words(t):
    t = t.lower().replace("'", "").replace("ʻ", "").replace("`", "")
    t = re.sub(r"[^a-zа-яёўғқҳ ]+", " ", t)
    return [w for w in t.split() if w]

def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    if not r:
        return 0.0
    d = list(range(len(h) + 1))
    for i in range(1, len(r) + 1):
        prev, d[0] = d[0], i
        for j in range(1, len(h) + 1):
            cur = d[j]
            d[j] = min(d[j] + 1, d[j - 1] + 1, prev + (r[i - 1] != h[j - 1]))
            prev = cur
    return d[len(h)] / len(r)

def asr(wav, sr):
    wav = np.asarray(wav, dtype="float32")
    buf = io.BytesIO()
    sf.write(buf, wav, sr, format="WAV", subtype="PCM_16")
    return whisper_engine.transcribe(buf.getvalue())

print("ASR isinmoqda (Kotib)...", flush=True)
_ = asr(np.zeros(16000, dtype="float32"), 16000)  # warmup/load

# MMS baseline (ishlab turgan backend 8000 orqali)
print("\n=== MMS (ayol) baseline — ishlab turgan backenddan ===", flush=True)
mms_wers = []
try:
    import requests
    for t in TESTS:
        r = requests.post("http://127.0.0.1:8000/synthesize/mms",
                          json={"text": t, "voice": "ayol", "normalize": True}, timeout=60)
        w, sr = sf.read(io.BytesIO(r.content))
        e = wer(t, asr(w, sr))
        mms_wers.append(e)
    print(f"  MMS (ayol) o'rtacha WER: {sum(mms_wers)/len(mms_wers):.0%}")
except Exception as e:
    print(f"  MMS baseline o'tkazib yuborildi: {e}")

# F5 yuklash
print(f"\nF5 yuklanmoqda: {CKPTS / 'model_last.pt'}", flush=True)
m = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(CKPTS / "model_last.pt"), vocab_file=str(VOCAB))

CONFIGS = [
    {"nfe_step": 32, "cfg_strength": 2.0, "speed": 1.0},   # hozirgi (baseline)
    {"nfe_step": 48, "cfg_strength": 2.0, "speed": 1.0},
    {"nfe_step": 64, "cfg_strength": 2.0, "speed": 1.0},
    {"nfe_step": 32, "cfg_strength": 3.0, "speed": 1.0},
    {"nfe_step": 48, "cfg_strength": 3.0, "speed": 1.0},
    {"nfe_step": 48, "cfg_strength": 4.0, "speed": 0.9},
]

print("\n" + "=" * 64)
print("F5 PARAMETR SWEEP (past WER = to'g'riroq o'qish)")
print("=" * 64)
results = []
for cfg in CONFIGS:
    wers = []
    for t in TESTS:
        wav, sr, _ = m.infer(REF_WAV, REF_TXT, norm(t),
                             nfe_step=cfg["nfe_step"], cfg_strength=cfg["cfg_strength"],
                             speed=cfg["speed"], seed=1234, show_info=lambda *a, **k: None)
        wers.append(wer(t, asr(wav, sr)))
    avg = sum(wers) / len(wers)
    results.append((avg, cfg))
    print(f"  nfe={cfg['nfe_step']:>2}  cfg={cfg['cfg_strength']:.1f}  speed={cfg['speed']:.2f}"
          f"  ->  WER {avg:.0%}", flush=True)

results.sort(key=lambda x: x[0])
best_avg, best = results[0]
print("\n" + "=" * 64)
print(f"ENG YAXSHI F5 config: nfe={best['nfe_step']} cfg={best['cfg_strength']} "
      f"speed={best['speed']}  ->  WER {best_avg:.0%}")
if mms_wers:
    print(f"Taqqoslash — MMS (ayol) WER: {sum(mms_wers)/len(mms_wers):.0%}")
print("=" * 64)
