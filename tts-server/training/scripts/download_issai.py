"""
ISSAI Uzbek Speech Corpus (USC) yuklab olish.

105 soat, 958 speaker, manually checked, MIT/CC license.
Hajm: ~9.47 GB tar.gz
Manba: https://huggingface.co/datasets/issai/Uzbek_Speech_Corpus

Foydalanish:
    python training/scripts/download_issai.py
"""

import os
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
DATA_DIR = PROJECT_ROOT / "tts-server" / "training" / "data"
TARGET_TAR = DATA_DIR / "ISSAI_USC.tar.gz"


def main():
    print("=" * 70)
    print("ISSAI Uzbek Speech Corpus — yuklab olish")
    print("=" * 70)
    print(f"   Manba:  issai/Uzbek_Speech_Corpus (HuggingFace)")
    print(f"   Hajm:   ~9.47 GB")
    print(f"   Maqsad: {TARGET_TAR}")
    print()

    DATA_DIR.mkdir(parents=True, exist_ok=True)

    if TARGET_TAR.exists():
        size_gb = TARGET_TAR.stat().st_size / 1e9
        if size_gb > 9.0:
            print(f"✅ Allaqachon yuklangan: {size_gb:.2f} GB — o'tkazib yuborildi")
            return
        else:
            print(f"⚠️  Qisman yuklangan ({size_gb:.2f} GB) — qaytadan boshlanadi")
            TARGET_TAR.unlink()

    print("⏳ Yuklab olish boshlandi (huggingface_hub orqali)…")
    print("   (Bu uzoq vaqt olishi mumkin — 30 daqiqadan 2 soatgacha)")
    t0 = time.time()

    from huggingface_hub import hf_hub_download

    try:
        path = hf_hub_download(
            repo_id="issai/Uzbek_Speech_Corpus",
            filename="ISSAI_USC.tar.gz",
            repo_type="dataset",
            local_dir=str(DATA_DIR),
            local_dir_use_symlinks=False,
            resume_download=True,
        )
    except TypeError:
        # newer huggingface_hub API
        path = hf_hub_download(
            repo_id="issai/Uzbek_Speech_Corpus",
            filename="ISSAI_USC.tar.gz",
            repo_type="dataset",
            local_dir=str(DATA_DIR),
        )

    elapsed = time.time() - t0
    size_gb = Path(path).stat().st_size / 1e9

    print(f"\n✅ Yuklash tugadi")
    print(f"   Vaqt:   {elapsed/60:.1f} daqiqa")
    print(f"   Hajm:   {size_gb:.2f} GB")
    print(f"   Yo'l:   {path}")
    print(f"\n👉 Keyingi qadam: python training/scripts/extract_and_prep.py")


if __name__ == "__main__":
    main()
