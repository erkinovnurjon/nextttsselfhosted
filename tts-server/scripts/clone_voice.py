"""
Voice cloning sinov skripti.

Sizning reference.wav fayli + matn → sizning ovoz bilan sintezlangan WAV.

Birinchi ishga tushirishda XTTS v2 modeli (~2 GB) avtomatik yuklab olinadi.
Keyingi ishga tushirishlarda tezroq ishlaydi.

Foydalanish:
    python scripts/clone_voice.py "Salom dunyo"
    python scripts/clone_voice.py "Bugun havo yaxshi" --language tr
    python scripts/clone_voice.py --interactive
    python scripts/clone_voice.py --benchmark

Eslatma:
    XTTS v2 o'zbek tilini rasmiy qo'llab-quvvatlamaydi.
    Eng yaqin til — turk (tr), bu fonetik jihatdan eng yaqin.
    Keyinroq fine-tuning bilan o'zbek tilini to'g'ri qo'llanishiga erishamiz.
"""

import argparse
import os
import sys
import time
from pathlib import Path

# Windows konsol UTF-8 ni qo'llab-quvvatlasin
os.environ["PYTHONIOENCODING"] = "utf-8"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
REFERENCE_WAV = PROJECT_ROOT / "tts-server" / "voices" / "main" / "reference.wav"
OUTPUT_DIR = PROJECT_ROOT / "tts-server" / "output"

# Coqui XTTS v2 quvvatlaydigan tillar
SUPPORTED_LANGS = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pl": "Polish",
    "tr": "Turkish (o'zbek uchun eng yaqin)",
    "ru": "Russian",
    "nl": "Dutch",
    "cs": "Czech",
    "ar": "Arabic",
    "zh-cn": "Chinese (mandarin)",
    "ja": "Japanese",
    "hu": "Hungarian",
    "ko": "Korean",
    "hi": "Hindi",
}

DEMO_TEXTS = [
    "Salom, mening ismim Ahmad va men dasturchi.",
    "Bugun havo juda yaxshi, quyosh charaqlab turibdi.",
    "O'zbekiston Markaziy Osiyoda joylashgan go'zal mamlakat.",
    "Kitob o'qish eng yaxshi mashg'ulotlardan biridir.",
    "Salom dunyo, bu mening birinchi sun'iy intellekt orqali yaratilgan ovozim.",
]


def load_model():
    print("⏳ XTTS v2 modeli yuklanmoqda... (ilk martada ~2GB yuklab olinadi)")
    t0 = time.time()
    import torch
    from TTS.api import TTS

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"   Qurilma: {device.upper()}")
    if device == "cuda":
        print(f"   GPU: {torch.cuda.get_device_name(0)}")
        print(f"   VRAM: {torch.cuda.get_device_properties(0).total_memory / 1e9:.1f} GB")

    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
    print(f"✅ Model yuklandi ({time.time() - t0:.1f}s)\n")
    return tts


def synthesize(tts, text: str, language: str, output_path: Path):
    if not REFERENCE_WAV.exists():
        sys.exit(f"❌ Reference yo'q: {REFERENCE_WAV}\n   Avval: python scripts/prepare_reference.py")

    t0 = time.time()
    output_path.parent.mkdir(parents=True, exist_ok=True)
    tts.tts_to_file(
        text=text,
        file_path=str(output_path),
        speaker_wav=str(REFERENCE_WAV),
        language=language,
        split_sentences=True,
    )
    elapsed = time.time() - t0

    # Audio davomiyligi
    import soundfile as sf
    info = sf.info(str(output_path))

    print(f"   📝 Matn:        {text[:60]}{'…' if len(text) > 60 else ''}")
    print(f"   🌐 Til:         {language} ({SUPPORTED_LANGS.get(language, '?')})")
    print(f"   🎵 Output:      {output_path.relative_to(PROJECT_ROOT)}")
    print(f"   ⏱️  Sintez vaqti: {elapsed:.2f}s")
    print(f"   ⏱️  Audio uzunligi: {info.duration:.2f}s")
    print(f"   ⚡ RTF:          {elapsed / info.duration:.2f}x real-time")
    print()


def main():
    parser = argparse.ArgumentParser(formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("text", nargs="?", help="Sintez qilish uchun matn")
    parser.add_argument("--language", "-l", default="tr",
                        help="Til kodi (default: tr — o'zbek uchun eng yaqin)")
    parser.add_argument("--output", "-o", default=None, help="Output WAV (default: avtomatik)")
    parser.add_argument("--interactive", "-i", action="store_true", help="Interaktiv rejim")
    parser.add_argument("--benchmark", "-b", action="store_true",
                        help="Demo matnlarni barchasini sintez qilib chiqar")
    parser.add_argument("--list-langs", action="store_true", help="Tillar ro'yxati")
    args = parser.parse_args()

    if args.list_langs:
        print("Mavjud tillar:")
        for code, name in SUPPORTED_LANGS.items():
            print(f"  {code:<6} — {name}")
        return

    if args.language not in SUPPORTED_LANGS:
        sys.exit(f"❌ Til qo'llanmaydi: {args.language}\n"
                 f"   Mavjud: {', '.join(SUPPORTED_LANGS.keys())}")

    tts = load_model()

    if args.benchmark:
        print("🚀 Benchmark — demo matnlar:\n")
        for i, text in enumerate(DEMO_TEXTS, 1):
            output_path = OUTPUT_DIR / f"demo_{i:02d}_{args.language}.wav"
            synthesize(tts, text, args.language, output_path)
        print(f"✅ Barcha demo fayllar: {OUTPUT_DIR.relative_to(PROJECT_ROOT)}")
        return

    if args.interactive:
        print("Interaktiv rejim. Chiqish uchun: bo'sh qator yoki Ctrl+C\n")
        i = 1
        try:
            while True:
                text = input(f"[{i}] Matn: ").strip()
                if not text:
                    break
                output_path = Path(args.output) if args.output else OUTPUT_DIR / f"interactive_{i:03d}.wav"
                synthesize(tts, text, args.language, output_path)
                i += 1
        except (KeyboardInterrupt, EOFError):
            print("\nChiqildi.")
        return

    if not args.text:
        parser.error("Matn berilmagan. Foydalanish: clone_voice.py 'matn' yoki --interactive yoki --benchmark")

    output_path = Path(args.output) if args.output else OUTPUT_DIR / f"clone_{int(time.time())}.wav"
    synthesize(tts, args.text, args.language, output_path)


if __name__ == "__main__":
    main()
