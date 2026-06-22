# 1571110404 (mayin AYOL) — XOM matn metadata (x→kh YO'Q!). uzbek100 xom x/gʻ'ni o'zi
# to'g'ri o'qiydi; kh hiylasi x'ni buzardi. Bu build_ayol_metadata.py ning kh'siz varianti.
# Manba: issai_raw train/test (.txt). -> ayol_raw_f5/metadata_abs.csv
#   .venv/Scripts/python.exe training/scripts/build_ayol_raw_metadata.py
from pathlib import Path
import soundfile as sf

DATA = Path(__file__).resolve().parents[1] / "data"
SPK = "1571110404"
OUT = DATA / "ayol_raw_f5"
OUT.mkdir(parents=True, exist_ok=True)

NORM = [("﻿", ""), ("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
        ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
        ("—", "-"), ("–", "-"), ("…", "..."), ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]
def norm(t):
    for a, b in NORM:
        t = t.replace(a, b)
    t = " ".join(t.split()).strip()
    return t   # ⚠️ x→kh YO'Q — XOM x/gʻ saqlanadi (uzbek100 ularni to'g'ri o'qiydi)

rows = {}
skipped = {"dur": 0, "txt": 0}

def add(wav: Path, text: str):
    stem = wav.stem
    if stem in rows:
        return
    t = norm(text)
    if not t:
        skipped["txt"] += 1; return
    try:
        info = sf.info(str(wav)); dur = info.frames / info.samplerate
    except Exception:
        skipped["dur"] += 1; return
    if not (0.8 <= dur <= 16.0):
        skipped["dur"] += 1; return
    rows[stem] = (wav.resolve().as_posix(), t)

for split in ("train", "test", "dev"):
    d = DATA / "issai_raw" / "ISSAI_USC" / split
    if not d.exists():
        continue
    n = 0
    for w in sorted(d.glob(f"{SPK}_*.wav")):
        txt = w.with_suffix(".txt")
        if txt.exists():
            add(w, txt.read_text(encoding="utf-8")); n += 1
    print(f"raw {split}: {n} ko'rildi, jami {len(rows)}")

total_dur = 0.0
for p, _ in rows.values():
    info = sf.info(p); total_dur += info.frames / info.samplerate

out = ["audio_file|text"] + [f"{p}|{t}" for p, t in rows.values()]
(OUT / "metadata_abs.csv").write_text("\n".join(out), encoding="utf-8")
print(f"\nJAMI: {len(rows)} klip, {total_dur/3600:.2f} soat -> {OUT/'metadata_abs.csv'}")
print(f"O'tkazib: dur={skipped['dur']}, bo'sh={skipped['txt']}")
# Tekshiruv: x bormi (kh emas)
sample = [t for _, t in list(rows.values())[:200] if " x" in (" " + t) or "x" in t][:3]
print("Namuna (xom x bo'lishi kerak):", sample)
