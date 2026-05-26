"""
Full pipeline orchestrator — dataset tayyor bo'lgandan trening tugagungacha.

Bosqichlar:
1. Tar.gz bor-yo'qligini tekshirish (yo'q bo'lsa: xato)
2. Extract (agar hali bo'lmagan bo'lsa)
3. Preprocess (resampling, filtering, metadata, foydalanuvchi yozuvlari)
4. Fine-tuning (overnight)

Foydalanish:
    python training/scripts/run_pipeline.py                      # default: 1 epoch, max 10 soat
    python training/scripts/run_pipeline.py --epochs 2 --max-hours 15
    python training/scripts/run_pipeline.py --skip-preprocess    # faqat trening
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["COQUI_TOS_AGREED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRAIN_SCRIPTS = PROJECT_ROOT / "tts-server" / "training" / "scripts"
DATA_DIR = PROJECT_ROOT / "tts-server" / "training" / "data"
TAR_PATH = DATA_DIR / "ISSAI_USC.tar.gz"
METADATA_PATH = DATA_DIR / "metadata.csv"
VENV_PYTHON = PROJECT_ROOT / "tts-server" / ".venv" / "Scripts" / "python.exe"


def run_step(name: str, cmd: list, allow_fail: bool = False) -> bool:
    """Bir bosqichni ishga tushirish, real-time output bilan."""
    print(f"\n{'=' * 70}")
    print(f"BOSQICH: {name}")
    print(f"Komanda: {' '.join(str(c) for c in cmd)}")
    print(f"{'=' * 70}\n")

    t0 = time.time()
    env = {**os.environ, "PYTHONIOENCODING": "utf-8", "COQUI_TOS_AGREED": "1"}
    result = subprocess.run(cmd, env=env)
    elapsed = time.time() - t0

    if result.returncode == 0:
        print(f"\n✅ {name} tugadi ({elapsed/60:.1f} daqiqa)")
        return True
    else:
        print(f"\n❌ {name} xato (exit {result.returncode})")
        if not allow_fail:
            sys.exit(result.returncode)
        return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=1, help="Trening epoch soni")
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--max-hours", type=float, default=10.0, help="Maks dataset davomi (soat)")
    parser.add_argument("--skip-extract", action="store_true")
    parser.add_argument("--skip-preprocess", action="store_true")
    parser.add_argument("--skip-train", action="store_true")
    args = parser.parse_args()

    print("=" * 70)
    print("NextTTS Fine-tuning Pipeline")
    print("=" * 70)
    print(f"Pipeline boshlandi: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"Konfiguratsiya: epochs={args.epochs}, batch={args.batch}, max_hours={args.max_hours}")

    # 1. Tar fayl borligini tekshirish
    if not TAR_PATH.exists():
        sys.exit(f"❌ Tar fayl yo'q: {TAR_PATH}\n   Avval: python training/scripts/download_issai.py")
    size_gb = TAR_PATH.stat().st_size / 1e9
    if size_gb < 9.0:
        sys.exit(f"❌ Tar fayl to'liq yuklanmagan ({size_gb:.2f} GB, kerak: ~9.5 GB)")
    print(f"\n✅ Tar fayl tayyor: {size_gb:.2f} GB")

    # 2. Preprocess
    if not args.skip_preprocess:
        prep_cmd = [str(VENV_PYTHON), str(TRAIN_SCRIPTS / "extract_and_prep.py")]
        if args.skip_extract:
            prep_cmd.append("--skip-extract")
        if args.max_hours:
            prep_cmd.extend(["--max-hours", str(args.max_hours)])
        run_step("Extract + Preprocess", prep_cmd)
    else:
        print("\n⏭  Preprocess o'tkazib yuborildi")

    if not METADATA_PATH.exists():
        sys.exit(f"❌ Metadata yaratilmadi: {METADATA_PATH}")

    # 3. Trening
    if not args.skip_train:
        train_cmd = [
            str(VENV_PYTHON),
            str(TRAIN_SCRIPTS / "finetune_xtts.py"),
            "--epochs", str(args.epochs),
            "--batch", str(args.batch),
        ]
        run_step(f"Fine-tuning ({args.epochs} epoch)", train_cmd)
    else:
        print("\n⏭  Trening o'tkazib yuborildi")

    print("\n" + "=" * 70)
    print(f"✅ Pipeline tugadi: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 70)
    print("\n👉 Sinov: python training/scripts/test_finetuned.py")


if __name__ == "__main__":
    main()
