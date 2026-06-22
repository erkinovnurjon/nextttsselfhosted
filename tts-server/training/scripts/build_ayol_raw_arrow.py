# ayol_raw_f5/metadata_abs.csv -> F5 arrow (data/ayol_raw_char/). XOM matn (kh'siz) dataset.
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import os, shutil
from importlib.resources import files
from pathlib import Path
from cached_path import cached_path
from f5_tts.train.datasets.prepare_csv_wavs import prepare_and_save_set

CSV = r"C:/Projects/nexttts/tts-server/training/data/ayol_raw_f5/metadata_abs.csv"
OUT = Path(str(files("f5_tts").joinpath("../../data"))).resolve() / "ayol_raw_char"
OUT.mkdir(parents=True, exist_ok=True)
print("OUT:", OUT, flush=True)
prepare_and_save_set(CSV, str(OUT), is_finetune=False, num_workers=4)
shutil.copy2(str(cached_path("hf://SWivid/F5-TTS/F5TTS_v1_Base/vocab.txt")), OUT / "vocab.txt")
print("vocab base (2545). Fayllar:", os.listdir(OUT))
