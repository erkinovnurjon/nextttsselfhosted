# Jumla-bo'lish + nfe=48 dan keyin F5 o'qishini ko'p jumlali matnda tasdiqlaydi.
# Ishlab turgan backend (8000) orqali sintez qiladi (full chain), ASR bilan WER o'lchaydi.
#   cd tts-server
#   WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv/Scripts/python.exe training/scripts/verify_f5_chunking.py
import io, os, re, sys
from pathlib import Path
os.environ.setdefault("WHISPER_DEVICE", "cpu")
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
import numpy as np, soundfile as sf, requests
from server import whisper_engine

PARAS = [
    "Assalomu alaykum. Bugun ob-havo ochiq va quyoshli. Toshkent shahrida harorat yigirma besh daraja issiq. Maktab o'quvchilari darsga shoshilmoqda.",
    "Ilm olish har bir inson uchun muqaddas burchdir. Bilimli yoshlar mamlakat kelajagini quradi. Shuning uchun har kuni o'qish va izlanish zarur.",
]

def words(t):
    t = t.lower().replace("'", "").replace("ʻ", "").replace("`", "")
    return [w for w in re.sub(r"[^a-zа-яёўғқҳ ]+", " ", t).split() if w]

def wer(ref, hyp):
    r, h = words(ref), words(hyp)
    if not r: return 0.0
    d = list(range(len(h)+1))
    for i in range(1, len(r)+1):
        prev, d[0] = d[0], i
        for j in range(1, len(h)+1):
            cur = d[j]; d[j] = min(d[j]+1, d[j-1]+1, prev+(r[i-1]!=h[j-1])); prev = cur
    return d[len(h)]/len(r)

def asr_bytes(b):
    w, sr = sf.read(io.BytesIO(b)); w = np.asarray(w, dtype="float32")
    if w.ndim > 1: w = w.mean(axis=1)
    buf = io.BytesIO(); sf.write(buf, w, sr, format="WAV", subtype="PCM_16")
    return whisper_engine.transcribe(buf.getvalue())

print("ASR + sintez (biroz vaqt oladi)...", flush=True)
f5w, mmsw = [], []
for i, p in enumerate(PARAS, 1):
    rf = requests.post("http://127.0.0.1:8000/synthesize/f5", json={"text": p, "speed": 1.0}, timeout=180)
    rm = requests.post("http://127.0.0.1:8000/synthesize/mms", json={"text": p, "voice": "ayol", "normalize": True}, timeout=120)
    hf, hm = asr_bytes(rf.content), asr_bytes(rm.content)
    ef, em = wer(p, hf), wer(p, hm)
    f5w.append(ef); mmsw.append(em)
    print(f"\n--- Paragraf {i} ---")
    print(f"  matn      : {p}")
    print(f"  F5  WER={ef:.0%}: {hf}")
    print(f"  MMS WER={em:.0%}: {hm}")

print("\n" + "="*60)
print(f"F5 (jumla-bo'lish, nfe=48) o'rtacha WER: {sum(f5w)/len(f5w):.0%}")
print(f"MMS (ayol) o'rtacha WER              : {sum(mmsw)/len(mmsw):.0%}")
print("="*60)
