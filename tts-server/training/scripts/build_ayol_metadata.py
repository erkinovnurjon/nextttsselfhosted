# 1571110404 (tanlangan AYOL) ning BARCHA kliplari: processed_wavs (metadata.csv transkript)
# + raw ISSAI train/test (.txt transkript). Dedupe stem bo'yicha. -> ayol_f5/metadata_abs.csv
#   .venv/Scripts/python.exe training/scripts/build_ayol_metadata.py
from pathlib import Path
import soundfile as sf

DATA = Path(__file__).resolve().parents[1] / "data"
SPK = "1571110404"
OUT = DATA / "ayol_f5"
OUT.mkdir(parents=True, exist_ok=True)

NORM = [("﻿", ""), ("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
        ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
        ("—", "-"), ("–", "-"), ("…", "..."), ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]
def norm(t):
    for a, b in NORM:
        t = t.replace(a, b)
    t = " ".join(t.split()).strip()
    # x -> kh (HAMMA o'rinda): o'zbekcha /x/ = kh; model bitta toza "kh" mantig'ini
    # o'rganadi -> x DETERMINIK to'g'ri chiqadi. Inference'da AYNAN shu qoida qo'llanadi.
    t = t.replace("X", "Kh").replace("x", "kh")
    return t

rows = {}   # stem -> (abs_path, text)
skipped = {"dur": 0, "txt": 0}

def add(wav: Path, text: str):
    stem = wav.stem
    if stem in rows:
        return
    t = norm(text)
    if not t:
        skipped["txt"] += 1; return
    try:
        info = sf.info(str(wav))
        dur = info.frames / info.samplerate
    except Exception:
        skipped["dur"] += 1; return
    if not (0.8 <= dur <= 16.0):
        skipped["dur"] += 1; return
    rows[stem] = (wav.resolve().as_posix(), t)

# 1) processed_wavs + metadata.csv
meta = {}
for line in (DATA / "metadata.csv").read_text(encoding="utf-8").splitlines()[1:]:
    p = line.split("|")
    if len(p) >= 2:
        meta[Path(p[0]).name] = p[1]
n0 = 0
for w in sorted((DATA / "processed_wavs").glob(f"{SPK}_*.wav")):
    if w.name in meta:
        add(w, meta[w.name]); n0 += 1
print(f"processed_wavs: {n0} ko'rildi, hozircha {len(rows)} qabul")

# 2) raw ISSAI train + test (.txt yondosh)
for split in ("train", "test", "dev"):
    d = DATA / "issai_raw" / "ISSAI_USC" / split
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
print(f"O'tkazib yuborildi: duration={skipped['dur']}, bo'sh matn={skipped['txt']}")
