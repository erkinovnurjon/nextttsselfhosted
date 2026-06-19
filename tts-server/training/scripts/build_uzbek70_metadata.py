# Mavjud 43s (uzbek_f5) + ISSAI raw'dan +~27s = ~70s test dataseti.
# Raw ISSAI: train/*.wav (16kHz) + yondosh .txt transcript. F5 train paytida resample qiladi.
#   cd tts-server
#   .venv/Scripts/python.exe training/scripts/build_uzbek70_metadata.py
import random
from pathlib import Path
from collections import Counter

DATA = Path(__file__).resolve().parents[1] / "data"
RAW = DATA / "issai_raw" / "ISSAI_USC" / "train"
OUT = DATA / "uzbek70_f5"
OUT.mkdir(parents=True, exist_ok=True)

NORM = [("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
        ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
        ("—", "-"), ("–", "-"), ("…", "..."), ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]
def norm(t):
    for a, b in NORM:
        t = t.replace(a, b)
    return " ".join(t.split()).strip()

ADD_CLIPS = 27000  # +~27 soat (o'rtacha 3.6s)

# 1) Mavjud 43s (Feruza + ISSAI processed)
rows = []
base = (DATA / "uzbek_f5" / "metadata_abs.csv").read_text(encoding="utf-8").splitlines()
for l in base[1:]:
    if "|" in l:
        rows.append(l)
n_base = len(rows)
print(f"Mavjud (43s): {n_base} klip", flush=True)

# 2) Raw ISSAI'dan qo'shimcha (random)
wavs = sorted(RAW.glob("*.wav"))
random.seed(42)
random.shuffle(wavs)
added = 0
miss = Counter()
for w in wavs:
    if added >= ADD_CLIPS:
        break
    txt = w.with_suffix(".txt")
    if not txt.exists():
        continue
    t = norm(txt.read_text(encoding="utf-8"))
    if not t:
        continue
    rows.append(f"{w.resolve().as_posix()}|{t}")
    added += 1
    if added % 5000 == 0:
        print(f"  +{added} raw klip...", flush=True)

print(f"Qo'shildi (raw ISSAI): {added} klip")
out = ["audio_file|text"] + rows
(OUT / "metadata_abs.csv").write_text("\n".join(out), encoding="utf-8")
print(f"\nJAMI: {len(rows)} klip -> {OUT/'metadata_abs.csv'}  (~70 soat)")
