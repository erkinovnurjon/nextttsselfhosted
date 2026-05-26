"""
Fine-tuned XTTS v2 ni sinash — base modeli bilan solishtirish.

Foydalanish:
    python training/scripts/test_finetuned.py
    python training/scripts/test_finetuned.py --checkpoint <path>
"""

import argparse
import os
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["COQUI_TOS_AGREED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

CHECKPOINTS_DIR = PROJECT_ROOT / "tts-server" / "training" / "checkpoints" / "xtts_v2_uzbek"
REFERENCE_WAV = PROJECT_ROOT / "tts-server" / "voices" / "main" / "reference.wav"
OUTPUT_DIR = PROJECT_ROOT / "tts-server" / "output" / "finetuned"
XTTS_CACHE = Path.home() / "AppData" / "Local" / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"

TEST_SENTENCES = [
    "Salom, mening ismim Ahmad va men dasturchi.",
    "O'zbekiston Markaziy Osiyoda joylashgan go'zal mamlakat.",
    "Bog'imda olma, nok va o'rik daraxtlari o'sadi.",
    "Hozir soat 19:30, kechki ovqat vaqti yaqinlashdi.",
    "Mening yoshim 25 da, 1995-yilda tug'ilganman.",
    "Toshkent — O'zbekiston poytaxti va eng katta shahri.",
]


def find_latest_checkpoint():
    """Eng oxirgi checkpoint'ni topish."""
    candidates = list(CHECKPOINTS_DIR.rglob("best_model.pth")) + \
                 list(CHECKPOINTS_DIR.rglob("checkpoint_*.pth"))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def normalize(text: str) -> str:
    from server.linguistic_normalizer import normalize_uzbek_text
    from server.text_normalizer import normalize_uzbek_to_turkish_phonetic
    return normalize_uzbek_to_turkish_phonetic(normalize_uzbek_text(text))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", default=None, help="Maxsus checkpoint yo'li")
    parser.add_argument("--language", default="tr")
    args = parser.parse_args()

    print("=" * 70)
    print("Fine-tuned XTTS v2 sinov")
    print("=" * 70)

    ckpt_path = Path(args.checkpoint) if args.checkpoint else find_latest_checkpoint()
    if not ckpt_path or not ckpt_path.exists():
        sys.exit(f"❌ Checkpoint topilmadi. Avval trening qiling.")

    print(f"   Checkpoint: {ckpt_path}")
    print(f"   Reference:  {REFERENCE_WAV}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    import torch
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    device = "cuda" if torch.cuda.is_available() else "cpu"

    print("\n⏳ Model yuklanmoqda...")
    config = XttsConfig()
    config.load_json(str(XTTS_CACHE / "config.json"))
    model = Xtts.init_from_config(config)
    model.load_checkpoint(
        config,
        checkpoint_path=str(ckpt_path),
        vocab_path=str(XTTS_CACHE / "vocab.json"),
        use_deepspeed=False,
    )
    model.to(device)

    print(f"✅ Model {device.upper()} ga yuklandi\n")

    print("🎤 Sintez sinovlari:")
    for i, text in enumerate(TEST_SENTENCES, 1):
        norm = normalize(text)
        out_path = OUTPUT_DIR / f"ft_{i:02d}.wav"
        t0 = time.time()
        out = model.synthesize(
            norm,
            config,
            speaker_wav=str(REFERENCE_WAV),
            gpt_cond_len=3,
            language=args.language,
        )
        elapsed = time.time() - t0

        import soundfile as sf
        sf.write(str(out_path), out["wav"], 24000, subtype="PCM_16")
        duration = len(out["wav"]) / 24000

        print(f"\n   [{i}] {text}")
        print(f"       Norm: {norm}")
        print(f"       File: {out_path.name} ({duration:.2f}s)")
        print(f"       Time: {elapsed:.2f}s ({elapsed/duration:.2f}x RTF)")

    print(f"\n✅ Tugadi. Fayllar: {OUTPUT_DIR}")
    print("   Eshitib base model bilan solishtiring (tts-server/output/demo_*.wav)")


if __name__ == "__main__":
    main()
