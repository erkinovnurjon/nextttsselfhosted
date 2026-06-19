# F5 ZERO-SHOT cloning: foydalanuvchi tanlagan audition #1 (id 1187023182) ovozini
# reference qilib, o'sha ovozda gapiradi (qayta o'rgatish SHART EMAS). Tabiiy, robot emas.
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/clone_voice1.py
import pyarrow.dataset  # noqa  (torchaudio'dan oldin)
import datasets  # noqa
import os, sys
from pathlib import Path
from importlib.resources import files
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np, soundfile as sf
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[2]            # tts-server/
PUB = ROOT.parent / "public" / "audition"             # ../public/audition
OUT = ROOT / "output" / "voice1_clone"
OUT.mkdir(parents=True, exist_ok=True)
CKPTS = Path(str(files("f5_tts").joinpath("../../ckpts/feruza"))).resolve()
VOCAB = Path(str(files("f5_tts").joinpath("../../data/feruza_char/vocab.txt"))).resolve()

_NORM = [("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("`","'"),("“",'"'),("”",'"'),
         ("«",'"'),("»",'"'),("—","-"),("–","-"),("…","..."),("ӯ","u"),("Ӯ","U"),("ӽ","x")]
def norm(t):
    for a,b in _NORM: t=t.replace(a,b)
    return t.strip()

REF_WAV = str(PUB / "1187023182.wav")                 # sen tanlagan #1 ovoz
REF_TXT = norm("umarshayx mirzo boshi yostiqqa botib qattiq uxlamoqda edi.")  # ASR transkript

TESTS = [
    "Assalomu alaykum, bu men tanlagan ovoz.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Toshkent O'zbekistonning poytaxti va eng yirik shahri.",
    "Ilm olish har bir inson uchun muhim, deb hisoblayman.",
]

print(f"Reference (sen tanlagan #1): {REF_WAV}")
print(f"Ref matn: {REF_TXT}\n")
m = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(CKPTS / "model_last.pt"), vocab_file=str(VOCAB))
for i, t in enumerate(TESTS, 1):
    wav, sr, _ = m.infer(REF_WAV, REF_TXT, norm(t), nfe_step=48, cfg_strength=2.0,
                         speed=1.0, seed=1234, show_info=lambda *a, **k: None)
    p = OUT / f"_voice1_{i}.wav"
    sf.write(str(p), np.asarray(wav), sr, subtype="PCM_16")
    print(f"  [{i}] {p.name}  ({len(wav)/sr:.1f}s)  <- {t}")
print(f"\nTAYYOR. Tingla: {OUT}")
print("Bu SEN TANLAGAN #1 ovozi (F5 cloning). Robotsimon MMS bilan solishtir.")
