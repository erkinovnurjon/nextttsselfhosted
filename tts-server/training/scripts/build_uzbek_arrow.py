# uzbek_f5/metadata_abs.csv -> F5 training formati (raw.arrow + duration.json) data/uzbek_char/.
# Vocab base F5 (2545) bilan almashtiriladi -> embedding mosligi (ISSAI matni 100% sig'adi).
# MUHIM: pyarrow/datasets torchaudio'dan OLDIN (Windows segfault).
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401

import os
import shutil
from importlib.resources import files
from pathlib import Path

from cached_path import cached_path
from f5_tts.train.datasets.prepare_csv_wavs import prepare_and_save_set

CSV = r"C:/Projects/nexttts/tts-server/training/data/uzbek_f5/metadata_abs.csv"
DATA_BASE = Path(str(files("f5_tts").joinpath("../../data"))).resolve()
OUT = DATA_BASE / "uzbek_char"
OUT.mkdir(parents=True, exist_ok=True)
print("OUT:", OUT, flush=True)

# is_finetune=False -> dataset vocab yoziladi, keyin base bilan almashtiramiz.
prepare_and_save_set(CSV, str(OUT), is_finetune=False, num_workers=4)

base_vocab = str(cached_path("hf://SWivid/F5-TTS/F5TTS_v1_Base/vocab.txt"))
shutil.copy2(base_vocab, OUT / "vocab.txt")
n = sum(1 for _ in open(OUT / "vocab.txt", encoding="utf-8"))
print(f"vocab.txt almashtirildi: {n} token (base)")
print("Fayllar:", os.listdir(OUT))
