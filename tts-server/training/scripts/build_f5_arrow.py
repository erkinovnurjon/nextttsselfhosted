# metadata_abs.csv -> F5 training formati (raw.arrow + duration.json) data/feruza_char/ da.
# Keyin vocab.txt'ni base F5 vocab (2545) bilan almashtiramiz -> embedding base bilan mos.
#
# MUHIM: pyarrow/datasets'ni torchaudio'дан OLDIN import qilamiz — aks holda Windows'da
# DLL to'qnashuvi (access violation segfault). f5_tts torchaudio'ni ichki yuklaydi.
import pyarrow.dataset  # noqa: F401  (torchaudio'дан oldin yuklash shart)
import datasets  # noqa: F401

import os
from importlib.resources import files
from pathlib import Path
import shutil

from cached_path import cached_path
from f5_tts.train.datasets.prepare_csv_wavs import prepare_and_save_set

CSV = r"C:/Projects/nexttts/tts-server/training/data/feruza_f5/metadata_abs.csv"
DATA_BASE = Path(str(files("f5_tts").joinpath("../../data"))).resolve()
OUT = DATA_BASE / "feruza_char"
OUT.mkdir(parents=True, exist_ok=True)
print("OUT:", OUT)

# is_finetune=False -> dataset vocab yoziladi (yo'q fayl muammosi bo'lmaydi). Keyin almashtiramiz.
prepare_and_save_set(CSV, str(OUT), is_finetune=False, num_workers=2)

# vocab'ni base F5 (2545) bilan almashtirish -> embedding mosligi
base_vocab = str(cached_path("hf://SWivid/F5-TTS/F5TTS_v1_Base/vocab.txt"))
shutil.copy2(base_vocab, OUT / "vocab.txt")
n = sum(1 for _ in open(OUT / "vocab.txt", encoding="utf-8"))
print(f"vocab.txt almashtirildi: {n} token (base)")
print("Fayllar:", os.listdir(OUT))
