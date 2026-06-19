# Feruza (toza, 13.38s) + ISSAI (ko'p-spiker, ~29.5s) -> birlashgan metadata_abs.csv.
# F5 train paytida o'zi 24kHz'ga resample qiladi, shuning uchun resample SHART EMAS —
# faqat absolute path + normalizatsiya qilingan matn (training bilan AYNAN bir xil).
#   cd tts-server
#   .venv/Scripts/python.exe training/scripts/build_uzbek_metadata.py
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
OUT = DATA / "uzbek_f5"
OUT.mkdir(parents=True, exist_ok=True)

# F5 normalizatsiyasi — finalize_f5_metadata.py / f5_server.py bilan AYNAN bir xil.
NORM = [("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
        ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
        ("—", "-"), ("–", "-"), ("…", "..."), ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]
def norm(t):
    for a, b in NORM:
        t = t.replace(a, b)
    return t.strip()

rows = []  # "abs_path|text"

# 1) Feruza (allaqachon absolute + normalized + header)
fer = (DATA / "feruza_f5" / "metadata_abs.csv").read_text(encoding="utf-8").splitlines()
for l in fer[1:]:                       # header tashlab
    if "|" in l:
        rows.append(l)
n_fer = len(rows)
print(f"Feruza: {n_fer} klip")

# 2) ISSAI (processed_wavs, 22050Hz — F5 o'zi resample qiladi)
iss = (DATA / "metadata.csv").read_text(encoding="utf-8").splitlines()
n_iss = 0
for l in iss[1:]:                       # header: audio_file|text|speaker|emotion
    p = l.split("|")
    if len(p) < 2:
        continue
    rel, text = p[0], norm(p[1])
    if not text:
        continue
    ap = (DATA / rel).resolve().as_posix()
    rows.append(f"{ap}|{text}")
    n_iss += 1
print(f"ISSAI:  {n_iss} klip")

out = ["audio_file|text"] + rows
(OUT / "metadata_abs.csv").write_text("\n".join(out), encoding="utf-8")
print(f"\nJAMI: {len(rows)} klip -> {OUT / 'metadata_abs.csv'}")
print(f"  (Feruza {n_fer} + ISSAI {n_iss})")
print("Namuna ISSAI:", rows[-1][:110])
