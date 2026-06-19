"""
build_feruza_piper_csv.py
=========================
FeruzaSpeech train.tsv -> Piper trening CSV (`wav|matn`, pipe-delimited).
Piper espeak-ng (uz) bilan fonemalashtiradi → nativ o'zbek fonemalar (x/q/gʻ to'g'ri).

- wav_filename = train.tsv 'audio' ustuni (audio_dir ga nisbatan: feruza/)
- matn = text_latin (espeak-ng uz Lotin kutadi); apostrof variantlari normallashtiriladi
- davomiylik 1..16s (juda uzun audiokitob kliplari OOM beradi)

Foydalanish (.venv):
    python training/scripts/build_feruza_piper_csv.py --max-sec 16
Chiqish: training/data/feruza/metadata_piper.csv (audio_dir = training/data/feruza)
"""
import argparse, csv, os, sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]            # tts-server
FERUZA = ROOT / "training" / "data" / "feruza"

# espeak uchun apostrof/tirnoqlarni ASCII'ga (oʻ/gʻ saqlanadi: o' / g')
NORM = [("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
        ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'), ("—", "-"), ("–", "-"), ("…", "...")]

def norm(t):
    for a, b in NORM:
        t = t.replace(a, b)
    return " ".join(t.split())

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--min-sec", type=float, default=1.0)
    ap.add_argument("--max-sec", type=float, default=16.0)
    ap.add_argument("--min-chars", type=int, default=5)
    args = ap.parse_args()

    rows, tot, skipped = [], 0.0, 0
    with open(FERUZA / "train.tsv", encoding="utf-8") as f:
        r = csv.DictReader(f, delimiter="\t")
        for row in r:
            try:
                dur = float(row["duration"])
            except Exception:
                skipped += 1; continue
            if dur < args.min_sec or dur > args.max_sec:
                skipped += 1; continue
            txt = norm(row["text_latin"])
            if len(txt) < args.min_chars or "|" in txt:
                skipped += 1; continue
            rows.append((row["audio"], txt))   # audio = "train/001/001-01.wav"
            tot += dur

    out = FERUZA / "metadata_piper.csv"
    with open(out, "w", encoding="utf-8", newline="") as f:
        for wav, txt in rows:
            f.write(f"{wav}|{txt}\n")

    print(f"✅ {len(rows)} klip, {tot/3600:.1f} soat (o'tkazib yuborilgan: {skipped})", flush=True)
    print(f"   CSV: {out}", flush=True)
    print(f"   audio_dir: {FERUZA}", flush=True)
    print(f"   namuna: {rows[0][0]}|{rows[0][1][:60]}", flush=True)

if __name__ == "__main__":
    main()
