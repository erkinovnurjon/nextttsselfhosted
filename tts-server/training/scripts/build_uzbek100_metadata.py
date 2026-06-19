# Mavjud 43s (uzbek_f5) + ISSAI raw TO'LIQ train (~100.7k klip, ~101s) = uzbek100 dataseti.
# build_uzbek70_metadata.py bilan bir xil retsept, faqat ADD cap YO'Q (hammasi olinadi).
#   cd tts-server
#   .venv-f5/Scripts/python.exe training/scripts/build_uzbek100_metadata.py
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
RAW = DATA / "issai_raw" / "ISSAI_USC" / "train"
OUT = DATA / "uzbek100_f5"
OUT.mkdir(parents=True, exist_ok=True)

NORM = [("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
        ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
        ("—", "-"), ("–", "-"), ("…", "..."), ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]
def norm(t):
    for a, b in NORM:
        t = t.replace(a, b)
    return " ".join(t.split()).strip()

# 1) Mavjud 43s (Feruza + ISSAI processed)
rows = []
base = (DATA / "uzbek_f5" / "metadata_abs.csv").read_text(encoding="utf-8").splitlines()
for l in base[1:]:
    if "|" in l:
        rows.append(l)
print(f"Mavjud (43s): {len(rows)} klip", flush=True)

# 2) Raw ISSAI train TO'LIQ
added = skipped = 0
for w in sorted(RAW.glob("*.wav")):
    txt = w.with_suffix(".txt")
    if not txt.exists():
        skipped += 1
        continue
    t = norm(txt.read_text(encoding="utf-8"))
    if not t:
        skipped += 1
        continue
    rows.append(f"{w.resolve().as_posix()}|{t}")
    added += 1
    if added % 20000 == 0:
        print(f"  +{added} raw klip...", flush=True)

print(f"Qo'shildi (raw ISSAI): {added}, o'tkazildi (txt yo'q/bo'sh): {skipped}")
out = ["audio_file|text"] + rows
(OUT / "metadata_abs.csv").write_text("\n".join(out), encoding="utf-8")
print(f"\nJAMI: {len(rows)} klip -> {OUT/'metadata_abs.csv'}")
