"""
Mozilla Common Voice O'zbek dataset'ini HuggingFace orqali yuklab olish.

Bu skript:
1. CommonVoice 17.0 ning O'zbek (uz) qismini yuklab oladi
2. Audio fayllarni 22050 Hz mono WAV ga aylantiradi
3. LJSpeech formatdagi metadata.csv yaratadi
4. Faqat "validated" (tasdiqlangan) yozuvlarni oladi

Yuklab olish vaqti:    ~10-30 daqiqa (internet tezligiga qarab)
Saqlash hajmi:          ~3-8 GB
Audio fayllar:          ~10-50 ming yozuv (CV versiyasiga qarab)

Foydalanish:
    python scripts/download_common_voice.py
    python scripts/download_common_voice.py --max 5000   # Cheklash
    python scripts/download_common_voice.py --min-dur 2 --max-dur 12
"""

import argparse
import csv
import os
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["HF_DATASETS_DISABLE_PROGRESS_BARS"] = "0"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRAINING_DATA = PROJECT_ROOT / "tts-server" / "training" / "data"
CV_WAVS = TRAINING_DATA / "cv_wavs"
CV_METADATA = TRAINING_DATA / "cv_metadata.csv"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--max", type=int, default=None, help="Yozuvlar soni cheklash")
    parser.add_argument("--min-dur", type=float, default=1.5, help="Minimal audio davomiyligi (sek)")
    parser.add_argument("--max-dur", type=float, default=15.0, help="Maksimal audio davomiyligi (sek)")
    parser.add_argument("--target-sr", type=int, default=22050, help="Maqsadli sample rate")
    parser.add_argument("--split", default="train", help="train | validation | test | other")
    args = parser.parse_args()

    print("=" * 70)
    print("Common Voice 17.0 O'zbek — yuklab olish")
    print("=" * 70)

    print("\n⏳ HuggingFace 'datasets' kutubxonasi yuklanmoqda...")
    from datasets import load_dataset, Audio
    import soundfile as sf

    CV_WAVS.mkdir(parents=True, exist_ok=True)

    print(f"\n⏳ Dataset yuklab olinmoqda: mozilla-foundation/common_voice_17_0 (uz, {args.split})")
    print(f"   (Birinchi marta uzoq vaqt olishi mumkin)")

    try:
        ds = load_dataset(
            "mozilla-foundation/common_voice_17_0",
            "uz",
            split=args.split,
            trust_remote_code=True,
        )
    except Exception as e:
        print(f"\n❌ Dataset yuklanmadi: {e}")
        print("\nMumkin sabablar:")
        print("  1. HuggingFace tokeni kerak (huggingface-cli login)")
        print("  2. Mozilla Common Voice dataset sahifasiga kirish kerak:")
        print("     https://huggingface.co/datasets/mozilla-foundation/common_voice_17_0")
        print("     (terms qabul qilish kerak)")
        sys.exit(1)

    print(f"✅ Dataset yuklandi: {len(ds)} yozuv")
    print(f"\n📋 Maydonlar: {ds.column_names}")

    # Audio kolonkani resample qilish uchun cast
    ds = ds.cast_column("audio", Audio(sampling_rate=args.target_sr))

    print(f"\n🔧 Filtering: davomiylik {args.min_dur}-{args.max_dur}s, max={args.max}")

    rows = []
    skipped_short = skipped_long = skipped_empty = 0
    saved = 0

    for i, sample in enumerate(ds):
        if args.max and saved >= args.max:
            break

        audio = sample["audio"]
        sentence = sample.get("sentence", "").strip()

        if not sentence:
            skipped_empty += 1
            continue

        arr = audio["array"]
        sr = audio["sampling_rate"]
        duration = len(arr) / sr

        if duration < args.min_dur:
            skipped_short += 1
            continue
        if duration > args.max_dur:
            skipped_long += 1
            continue

        # Saqlash
        client_id = sample.get("client_id", "unknown")[:8]
        filename = f"cv_{i:06d}_{client_id}.wav"
        wav_path = CV_WAVS / filename
        sf.write(str(wav_path), arr, sr, subtype="PCM_16")
        rows.append({
            "audio_file": f"cv_wavs/{filename}",
            "text": sentence,
            "speaker_id": sample.get("client_id", "unknown"),
            "duration": round(duration, 2),
            "gender": sample.get("gender", ""),
            "age": sample.get("age", ""),
        })
        saved += 1

        if saved % 500 == 0:
            print(f"   {saved} yozuv saqlandi…")

    # metadata.csv yozish
    with open(CV_METADATA, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys() if rows else ["audio_file", "text"], delimiter="|")
        writer.writeheader()
        writer.writerows(rows)

    total_dur = sum(r["duration"] for r in rows)
    speakers = set(r["speaker_id"] for r in rows)

    print(f"\n{'='*70}")
    print(f"✅ Tugadi")
    print(f"{'='*70}")
    print(f"   Saqlangan:       {saved} yozuv")
    print(f"   Tashlab yuboril: {skipped_short} qisqa, {skipped_long} uzun, {skipped_empty} bo'sh matn")
    print(f"   Jami davomiy:    {total_dur:.1f} soniya = {total_dur/3600:.2f} soat")
    print(f"   Speakerlar:      {len(speakers)}")
    print(f"   Audio:           {CV_WAVS.relative_to(PROJECT_ROOT)}")
    print(f"   Metadata:        {CV_METADATA.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
