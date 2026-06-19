# metadata.csv (relativ, original matn) -> metadata_abs.csv (absolute path, header, NORMALIZED matn).
# Normalizatsiya: o'zbekcha tipografik belgilarni base F5 vocab'dagi ASCII'ga keltiradi.
# AYNAN shu normalizatsiya inference'da ham qo'llanishi shart (f5_engine.py'da takrorlanadi).
from pathlib import Path

# (manba -> nishon). f5_engine.py NORM bilan bir xil bo'lishi kerak!
NORM = [
    ("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
    ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
    ("—", "-"), ("–", "-"), ("…", "..."),
    ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x"),  # data shovqini (adashgan kirill)
]

def normalize(t: str) -> str:
    for a, b in NORM:
        t = t.replace(a, b)
    return t

base = Path(r"C:/Projects/nexttts/tts-server/training/data/feruza_f5")
src = (base / "metadata.csv").read_text(encoding="utf-8").splitlines()
out = ["audio_file|text"]
for l in src:
    rel, text = l.split("|", 1)
    ap = (base / rel).resolve().as_posix()
    out.append(f"{ap}|{normalize(text)}")
(base / "metadata_abs.csv").write_text("\n".join(out), encoding="utf-8")
print(f"Yozildi: {len(out)-1} satr (+header)")
print("Namuna:", out[1][:120])
