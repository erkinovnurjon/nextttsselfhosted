"""
Mavjud processed_wavs ni saqlab qoldirib, metadata.csv ni qayta yaratish.

Yangi: LIGHT normalizatsiya — q, x, oʻ, gʻ AS-IS Uzbek harflar bilan saqlanadi.
Maqsad: fine-tuning paytida model haqiqiy o'zbek tovushini o'rganishi uchun.
"""

import csv
import json
import os
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

from server.linguistic_normalizer import normalize_uzbek_text
from server.text_normalizer import normalize_uzbek_to_turkish_phonetic

DATA_DIR = PROJECT_ROOT / "tts-server" / "training" / "data"
PROCESSED_DIR = DATA_DIR / "processed_wavs"
METADATA_PATH = DATA_DIR / "metadata.csv"
EXTRACT_DIR = DATA_DIR / "issai_raw"
USER_SENTENCES_JSON = PROJECT_ROOT / "dataset" / "sentences.json"


def normalize_text(text: str) -> str:
    """LIGHT: linguistic + light phonetic (q, x, oʻ, gʻ ni saqlash)."""
    text = normalize_uzbek_text(text)
    text = normalize_uzbek_to_turkish_phonetic(text, light=True)
    return text


def main():
    if not PROCESSED_DIR.exists() or not any(PROCESSED_DIR.glob("*.wav")):
        sys.exit("❌ processed_wavs bo'sh — avval extract_and_prep.py ni ishga tushiring")

    # ISSAI matnlarini topish
    print("⏳ ISSAI matnlari tahlil qilinmoqda...")
    raw_txt_files = list(EXTRACT_DIR.rglob("*.txt"))
    text_by_uid = {}
    for txt in raw_txt_files:
        try:
            content = txt.read_text(encoding="utf-8").strip()
            if not content:
                continue
            if "\t" in content:
                parts = content.split("\t", 1)
                if parts[0].strip().isdigit():
                    content = parts[1].strip()
            text_by_uid[txt.stem] = content
        except Exception:
            pass
    print(f"   {len(text_by_uid)} matn topildi")

    # processed_wavs ichidagi fayllarni metadata bilan bog'lash
    print(f"\n⏳ Metadata yaratilmoqda (LIGHT normalizatsiya)...")
    rows = []
    skipped = 0
    for wav in PROCESSED_DIR.glob("*.wav"):
        uid = wav.stem
        if uid.startswith("user_"):
            continue  # foydalanuvchi yozuvlari pastda
        text = text_by_uid.get(uid)
        if not text:
            skipped += 1
            continue
        normalized = normalize_text(text)
        rows.append({
            "audio_file": f"processed_wavs/{uid}.wav",
            "text": normalized,
            "speaker_name": "issai",
            "emotion_name": "neutral",
        })

    # Foydalanuvchi yozuvlari
    if USER_SENTENCES_JSON.exists():
        user_data = json.loads(USER_SENTENCES_JSON.read_text(encoding="utf-8"))
        user_count = 0
        for s in user_data:
            if not s.get("audioPath"):
                continue
            target = PROCESSED_DIR / f"user_{s['id']}.wav"
            if not target.exists():
                continue
            normalized = normalize_text(s["text"])
            rows.append({
                "audio_file": f"processed_wavs/user_{s['id']}.wav",
                "text": normalized,
                "speaker_name": "main",
                "emotion_name": "neutral",
            })
            user_count += 1
        print(f"   Foydalanuvchi: {user_count} ta")

    # Metadata yozish
    with open(METADATA_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["audio_file", "text", "speaker_name", "emotion_name"],
            delimiter="|",
        )
        writer.writeheader()
        writer.writerows(rows)

    print(f"\n✅ Tugadi")
    print(f"   Saqlangan: {len(rows)} satr")
    print(f"   Matn yo'q: {skipped} (sample'lar tashlandi)")
    print(f"   Metadata:  {METADATA_PATH}")
    print(f"\nBirinchi 3 misol (LIGHT normalizatsiya):")
    for r in rows[:3]:
        print(f"  {r['text']}")


if __name__ == "__main__":
    main()
