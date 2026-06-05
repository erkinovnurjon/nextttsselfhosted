"""
build_mms_hf_dataset.py
=======================

prepare_mms_dataset.py natijasidagi (metadata.csv + wavs/) papkani
HuggingFace `datasets` DatasetDict ko'rinishiga o'tkazib, save_to_disk qiladi.

audiofolder builder injiq bo'lgani uchun Dataset to'g'ridan-to'g'ri quriladi.
run_vits_finetuning.py local papkani load_from_disk orqali o'qiydi (patch qilingan).

Foydalanish:
    python training/scripts/build_mms_hf_dataset.py --dir training/data/mms_ft/uzb_spk1459541555
"""

import argparse
import csv
import os
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dir", required=True, help="metadata.csv + wavs/ papkasi")
    args = ap.parse_args()

    from datasets import Dataset, DatasetDict, Audio

    root = Path(args.dir).resolve()
    meta = root / "metadata.csv"
    rows = list(csv.reader(open(meta, encoding="utf-8")))
    header, data = rows[0], rows[1:]
    fn_i, txt_i = header.index("file_name"), header.index("text")

    audio_paths, texts = [], []
    for r in data:
        p = (root / r[fn_i]).resolve()
        if p.exists():
            audio_paths.append(str(p))
            texts.append(r[txt_i])

    print(f"📊 {len(audio_paths)} ta yozuv")
    ds = Dataset.from_dict({"audio": audio_paths, "text": texts})
    ds = ds.cast_column("audio", Audio(sampling_rate=16000))
    dd = DatasetDict({"train": ds})

    out = root.parent / (root.name + "_hf")
    dd.save_to_disk(str(out))
    print(f"✅ Saqlandi: {out}")
    print(f"   namuna text: {texts[0][:60]}")


if __name__ == "__main__":
    main()
