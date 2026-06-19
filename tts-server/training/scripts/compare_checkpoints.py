# Eski (Feruza) vs yangi (uzbek/ISSAI) checkpoint'larni #1 ovoz reference bilan solishtiradi.
# Har birini test gaplarni o'qitib, ASR bilan WER o'lchaydi + audio saqlaydi (tinglash uchun).
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/compare_checkpoints.py
import pyarrow.dataset  # noqa
import datasets  # noqa
import io, os, re, sys
from pathlib import Path
from importlib.resources import files
os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np, soundfile as sf
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
from server import whisper_engine

VOICES = ROOT / "voices"
OUT = ROOT / "output" / "compare_ckpt"
OUT.mkdir(parents=True, exist_ok=True)
CK = Path(str(files("f5_tts").joinpath("../../ckpts"))).resolve()
VOCAB = str(Path(str(files("f5_tts").joinpath("../../data/feruza_char/vocab.txt"))).resolve())
REF_WAV = str(VOICES / "f5_ref_main.wav")           # #1 ovoz
_NORM = [("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("`","'"),("“",'"'),("”",'"'),
         ("«",'"'),("»",'"'),("—","-"),("–","-"),("…","..."),("ӯ","u"),("Ӯ","U"),("ӽ","x")]
def norm(t):
    for a,b in _NORM: t=t.replace(a,b)
    return t.strip()
REF_TXT = norm((VOICES / "f5_ref_main.txt").read_text(encoding="utf-8"))

TESTS = [
    "Assalomu alaykum, bu o'zbek tilidagi sun'iy ovoz sinovi.",
    "Toshkent shahrida xalq ko'p, bog'larida qushlar sayraydi.",
    "Ilm olish har bir inson uchun muqaddas burchdir, deb hisoblayman.",
    "Xalqaro xabarlarga ko'ra, xavfsizlik masalasi juda muhim.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Maktab o'quvchilari bilim olish uchun har kuni darsga qatnashadi.",
]

# (nom, checkpoint yo'li)
MODELS = [
    ("eski_deploy",     CK / "uzbek_deploy.pt"),            # hozir ilovada ishlayotgan barqaror model
    ("yangi_uz70_8k",   CK / "uzbek70" / "model_8000.pt"),  # tungi run, o'rta nuqta
    ("yangi_uz70_last", CK / "uzbek70" / "model_last.pt"),  # tungi run, eng so'nggi (~step 15.6k, 02:42)
]

def words(t):
    t=t.lower().replace("'","").replace("ʻ","").replace("`","")
    return [w for w in re.sub(r"[^a-zа-яёўғқҳ ]+"," ",t).split() if w]
def wer(r,h):
    r,h=words(r),words(h)
    if not r: return 0.0
    d=list(range(len(h)+1))
    for i in range(1,len(r)+1):
        prev,d[0]=d[0],i
        for j in range(1,len(h)+1):
            cur=d[j]; d[j]=min(d[j]+1,d[j-1]+1,prev+(r[i-1]!=h[j-1])); prev=cur
    return d[len(h)]/len(r)
def asr(wav,sr):
    b=io.BytesIO(); sf.write(b,np.asarray(wav,dtype="float32"),sr,format="WAV",subtype="PCM_16")
    return whisper_engine.transcribe(b.getvalue())

print("ASR isinmoqda...", flush=True)
results = {}
for name, ckpt in MODELS:
    if not ckpt.exists():
        print(f"  (yo'q: {ckpt.name}) — o'tkazib yuborildi"); continue
    print(f"\n=== {name} ({ckpt.name}) yuklanmoqda ===", flush=True)
    m = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(ckpt), vocab_file=VOCAB)
    wers = []
    for i, t in enumerate(TESTS, 1):
        wav, sr, _ = m.infer(REF_WAV, REF_TXT, norm(t), nfe_step=48, cfg_strength=2.0,
                             speed=1.0, seed=1234, show_info=lambda *a, **k: None)
        sf.write(str(OUT / f"{name}_{i}.wav"), np.asarray(wav), sr, subtype="PCM_16")
        h = asr(wav, sr); e = wer(t, h); wers.append(e)
        print(f"  [{i}] WER={e:.0%}  eshitdi: {h}", flush=True)
    avg = sum(wers)/len(wers); results[name] = avg
    print(f"  >>> {name} O'RTACHA WER: {avg:.0%}")
    del m
    import gc, torch; gc.collect(); torch.cuda.empty_cache()

print("\n" + "="*56)
print("XULOSA (past = yaxshiroq o'qish):")
for name, avg in sorted(results.items(), key=lambda x: x[1]):
    print(f"  {name:16s} {avg:.0%}")
print("="*56)
print(f"Audio namunalar: {OUT}")
