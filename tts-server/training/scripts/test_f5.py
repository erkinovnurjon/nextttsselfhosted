# F5 fine-tune natijasini tez sinash: eng so'nggi checkpoint bilan test jumlalarni
# sintez qilib output/ ga saqlaydi. Training TO'XTAGANДAN keyin ishga tushiring (GPU bo'sh bo'lsin).
#
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/test_f5.py
#
# Maxsus checkpoint:  F5_CKPT=...\model_4000.pt  ... test_f5.py
import pyarrow.dataset  # noqa: F401  (torchaudio'дан oldin!)
import datasets  # noqa: F401

import os
import re
from pathlib import Path
from importlib.resources import files

import numpy as np
import soundfile as sf
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[2]  # tts-server/
VOICES = ROOT / "voices"
OUT = ROOT / "output"
OUT.mkdir(exist_ok=True)
CKPTS_DIR = Path(str(files("f5_tts").joinpath("../../ckpts/feruza"))).resolve()
VOCAB = Path(str(files("f5_tts").joinpath("../../data/feruza_char/vocab.txt"))).resolve()

_NORM = [("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("`","'"),("“",'"'),("”",'"'),
         ("«",'"'),("»",'"'),("—","-"),("–","-"),("…","..."),("ӯ","u"),("Ӯ","U"),("ӽ","x")]
def normalize(t):
    for a,b in _NORM: t=t.replace(a,b)
    return t.strip()

def latest_ckpt():
    env = os.environ.get("F5_CKPT")
    if env and Path(env).exists():
        return env
    cands = list(CKPTS_DIR.glob("model_*.pt")) + list(CKPTS_DIR.glob("model_*.safetensors"))
    cands = [c for c in cands if "pretrained" not in c.name]
    if not cands:
        raise SystemExit(f"Checkpoint yo'q: {CKPTS_DIR}")
    last = [c for c in cands if "last" in c.name]
    if last:
        return str(max(last, key=lambda p: p.stat().st_mtime))
    return str(max(cands, key=lambda p: int(re.search(r"model_(\d+)", p.name).group(1))))

TESTS = [
    "Assalomu alaykum, bu o'zbek tilidagi sun'iy ovoz sinovi.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Toshkent — O'zbekistonning poytaxti va eng yirik shahri.",
    "Ilm olish har bir inson uchun muqaddas burchdir, deb hisoblayman.",
]

ckpt = latest_ckpt()
ref_wav = str(VOICES / "f5_ref_feruza.wav")
ref_txt = normalize((VOICES / "f5_ref_feruza.txt").read_text(encoding="utf-8"))
print(f"Checkpoint: {ckpt}")
print(f"Ref: {ref_txt}")

m = F5TTS(model="F5TTS_v1_Base", ckpt_file=ckpt, vocab_file=str(VOCAB))
tag = Path(ckpt).stem
for i, t in enumerate(TESTS, 1):
    wav, sr, _ = m.infer(ref_wav, ref_txt, normalize(t), nfe_step=32, speed=1.0)
    p = OUT / f"_f5_{tag}_{i}.wav"
    sf.write(str(p), np.asarray(wav), sr, subtype="PCM_16")
    print(f"  [{i}] {p.name}  ({len(wav)/sr:.1f}s)  <- {t}")
print("TAYYOR. output/ papkasidagi _f5_*.wav fayllarni tinglang.")
