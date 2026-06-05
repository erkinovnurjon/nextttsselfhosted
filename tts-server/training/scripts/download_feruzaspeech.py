"""
download_feruzaspeech.py
========================

FeruzaSpeech (k2speech/FeruzaSpeech) — 60 soat, bitta toshkentlik ayol ovozi,
16kHz, lotin + kirill transkriptlari. Piper/VITS training uchun ideal dataset.

⚠️  GATED DATASET — ishlatishdan oldin:
  1. https://huggingface.co/datasets/k2speech/FeruzaSpeech ga kiring (login)
  2. "Agree and access" tugmasini bosing (shartlarga rozilik)
  3. Token oling: https://huggingface.co/settings/tokens  (read huquqi yetarli)
  4. Token bilan login qiling:
        .venv/Scripts/python.exe -m huggingface_hub.commands.huggingface_cli login
     yoki HF_TOKEN environment variable o'rnating.

Foydalanish:
    python training/scripts/download_feruzaspeech.py
    python training/scripts/download_feruzaspeech.py --inspect   # tuzilishni ko'rsatish
"""

import argparse
import os
import sys
from pathlib import Path

os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
sys.stdout.reconfigure(encoding="utf-8")

REPO_ID = "k2speech/FeruzaSpeech"
PROJECT_ROOT = Path(__file__).resolve().parents[3]
DEST = PROJECT_ROOT / "tts-server" / "training" / "data" / "feruzaspeech"


def pr(*a, **k):
    k.setdefault("flush", True)
    print(*a, **k)


def check_token() -> bool:
    from huggingface_hub import HfFolder
    if HfFolder.get_token() or os.environ.get("HF_TOKEN"):
        return True
    pr("❌ HuggingFace token topilmadi.")
    pr("   1) https://huggingface.co/datasets/k2speech/FeruzaSpeech — 'Agree and access'")
    pr("   2) https://huggingface.co/settings/tokens — read token oling")
    pr("   3) .venv/Scripts/python.exe -m huggingface_hub.commands.huggingface_cli login")
    return False


def inspect():
    from huggingface_hub import list_repo_files
    files = list_repo_files(REPO_ID, repo_type="dataset")
    pr(f"📂 {REPO_ID} — {len(files)} ta fayl")
    for f in sorted(files)[:60]:
        pr("   ", f)
    if len(files) > 60:
        pr(f"   … va yana {len(files)-60} ta")


def download():
    from huggingface_hub import snapshot_download
    DEST.mkdir(parents=True, exist_ok=True)
    pr(f"⬇️  Yuklanmoqda: {REPO_ID} -> {DEST}")
    path = snapshot_download(
        repo_id=REPO_ID,
        repo_type="dataset",
        local_dir=str(DEST),
    )
    pr(f"✅ Tugadi: {path}")
    # Qisqacha tarkib
    wavs = list(DEST.rglob("*.wav"))
    tsvs = list(DEST.rglob("*.tsv"))
    pr(f"   wav fayllar: {len(wavs)}")
    pr(f"   tsv fayllar: {[t.name for t in tsvs]}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inspect", action="store_true",
                    help="Faqat fayllar ro'yxatini ko'rsatish (yuklamasdan)")
    args = ap.parse_args()

    if not check_token():
        sys.exit(1)
    if args.inspect:
        inspect()
    else:
        download()


if __name__ == "__main__":
    main()
