"""metadata.csv ichidagi matnni fonetik normalizatsiya qilish."""

import csv
import os
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

from server.linguistic_normalizer import normalize_uzbek_text
from server.text_normalizer import normalize_uzbek_to_turkish_phonetic

METADATA_PATH = PROJECT_ROOT / "tts-server" / "training" / "data" / "metadata.csv"


def normalize(text: str) -> str:
    # LIGHT rejim: q, x, oʻ, gʻ AS-IS saqlanadi
    return normalize_uzbek_to_turkish_phonetic(normalize_uzbek_text(text), light=True)


def main():
    if not METADATA_PATH.exists():
        sys.exit(f"❌ {METADATA_PATH} yo'q")

    print(f"⏳ Normalizatsiya: {METADATA_PATH}")
    rows = []
    with open(METADATA_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="|")
        fields = reader.fieldnames
        for row in reader:
            row["text"] = normalize(row["text"])
            rows.append(row)

    with open(METADATA_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter="|")
        writer.writeheader()
        writer.writerows(rows)

    print(f"✅ {len(rows)} satr normalizatsiya qilindi")
    print(f"\nBirinchi 3 ta misol:")
    for r in rows[:3]:
        print(f"  {r['text']}")


if __name__ == "__main__":
    main()
