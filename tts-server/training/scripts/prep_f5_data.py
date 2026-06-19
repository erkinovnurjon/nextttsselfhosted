# F5-TTS uchun FeruzaSpeech datasetini lokal tayyorlash.
# train.tsv -> metadata.csv (audio_path|latin_text) + wavs/ (24kHz mono PCM16), 4-15s.
# F5'ning keyingi qadami: prepare_csv_wavs.py bu papkani training formatiga aylantiradi.
#
# Foydalanish:
#   python prep_f5_data.py
#   F5_MAX_CLIPS=4000 F5_MIN_SEC=4 F5_MAX_SEC=15 python prep_f5_data.py
import os, csv, sys
from pathlib import Path
import soundfile as sf
import librosa
import numpy as np

ROOT = Path(__file__).resolve().parents[1] / "data" / "feruza"   # train.tsv shu yerda
OUT = Path(__file__).resolve().parents[1] / "data" / "feruza_f5" # natija
WAVS = OUT / "wavs"
WAVS.mkdir(parents=True, exist_ok=True)

MIN_SEC = float(os.environ.get("F5_MIN_SEC", "4"))
MAX_SEC = float(os.environ.get("F5_MAX_SEC", "15"))
MAX_CLIPS = int(os.environ.get("F5_MAX_CLIPS", "4000"))  # 0 = cheksiz

tsv = ROOT / "train.tsv"
rows = list(csv.reader(open(tsv, encoding="utf-8"), delimiter="\t"))
h = rows[0]
ai, li, di = h.index("audio"), h.index("text_latin"), h.index("duration")

meta = []
total_sec = 0.0
skipped = 0
for r in rows[1:]:
    if len(r) <= max(ai, li, di):
        skipped += 1; continue
    try:
        dur = float(r[di])
    except ValueError:
        skipped += 1; continue
    if dur < MIN_SEC or dur > MAX_SEC:
        continue
    src = ROOT / r[ai]
    if not src.exists():
        skipped += 1; continue
    text = r[li].strip()
    if not text:
        continue
    name = r[ai].replace("/", "_").replace("\\", "_")
    if not name.lower().endswith(".wav"):
        name += ".wav"
    dst = WAVS / name
    if not dst.exists():
        w, srate = sf.read(str(src))
        if w.ndim > 1:
            w = w.mean(axis=1)
        if srate != 24000:
            w = librosa.resample(w.astype("float32"), orig_sr=srate, target_sr=24000)
        sf.write(str(dst), w, 24000, subtype="PCM_16")
    meta.append(f"wavs/{name}|{text}")
    total_sec += dur
    if len(meta) % 200 == 0:
        print(f"  {len(meta)} klip... ({total_sec/3600:.2f}h)", flush=True)
    if MAX_CLIPS and len(meta) >= MAX_CLIPS:
        break

with open(OUT / "metadata.csv", "w", encoding="utf-8") as f:
    f.write("\n".join(meta))

print(f"\nTAYYOR: {len(meta)} klip, {total_sec/3600:.2f} soat audio, skip={skipped}")
print(f"Papka: {OUT}")
print(f"Namuna: {meta[0] if meta else '—'}")
