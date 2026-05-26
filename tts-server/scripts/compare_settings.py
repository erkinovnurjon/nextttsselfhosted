"""
Voice cloning sifatini solishtirish:
   v1 — eski sozlash (normalizatsiyasiz, default params)
   v2 — yangi sozlash (normalizatsiya + tuned params)

Foydalanish:
    python scripts/compare_settings.py
"""

import os
import time
import urllib.request
import urllib.parse
import json
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

BASE_URL = "http://127.0.0.1:8000"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "tts-server" / "output"

TESTS = [
    "Salom, mening ismim Ahmad va men dasturchiman.",
    "O'zbekiston Markaziy Osiyoda joylashgan go'zal mamlakat.",
    "Bog'imda olma, nok va o'rik daraxtlari o'sadi.",
    "Toshkent — O'zbekiston poytaxti, ko'p qavatli binolar bor.",
    "Bunday yaxshi xabarni eshitib, hamma quvonib ketdi.",
]


def synth(text: str, normalize: bool, temperature: float, repetition_penalty: float, out_path: Path):
    body = json.dumps({
        "text": text,
        "language": "tr",
        "normalize": normalize,
        "temperature": temperature,
        "repetition_penalty": repetition_penalty,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{BASE_URL}/synthesize",
        data=body,
        headers={"Content-Type": "application/json"},
    )
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=120) as r:
        audio = r.read()
        normalized = urllib.parse.unquote(r.headers.get("X-Normalized-Text", ""))
    out_path.write_bytes(audio)
    return time.time() - t0, len(audio), normalized


def main():
    print("=" * 80)
    print("Sifat solishtiruv testi — eski vs yangi sozlash")
    print("=" * 80)

    for i, text in enumerate(TESTS, 1):
        print(f"\n[{i}] {text}")

        # v1 — eski sozlash
        v1_path = OUTPUT_DIR / f"compare_{i:02d}_v1_old.wav"
        elapsed, size, _ = synth(text, normalize=False, temperature=0.75, repetition_penalty=2.0, out_path=v1_path)
        print(f"   v1 (eski):  {v1_path.name}  {size/1024:.0f} KB  {elapsed:.2f}s")

        # v2 — yangi sozlash
        v2_path = OUTPUT_DIR / f"compare_{i:02d}_v2_new.wav"
        elapsed, size, normalized = synth(text, normalize=True, temperature=0.65, repetition_penalty=5.0, out_path=v2_path)
        print(f"   v2 (yangi): {v2_path.name}  {size/1024:.0f} KB  {elapsed:.2f}s")
        print(f"   Norm:       {normalized}")

    print("\n" + "=" * 80)
    print(f"Fayllar: {OUTPUT_DIR.relative_to(PROJECT_ROOT)}")
    print("Eshitib solishtiring: compare_NN_v1_old.wav vs compare_NN_v2_new.wav")
    print("=" * 80)


if __name__ == "__main__":
    main()
