# ayol2 uchun FONEMA-YO'NALTIRILGAN dataset: ayol (1571110404) kliplari oversample
# + to'liq ISSAI'dan fonemaga boy REPLAY (katastrofik unutishga qarshi).
# Sabab: ayol 777 klipda g'-boshli so'z faqat 15 klipda (2%), x- 107 (14%) —
# birinchi ayol run (replay'siz) x-onset'ni unutgan edi (ASR 49% vs baza 24%).
# -> training/data/ayol2_f5/metadata_abs.csv
#   .venv-f5/Scripts/python.exe training/scripts/build_ayol2_weighted.py
import random
import re
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data"
AYOL = DATA / "ayol_f5" / "metadata_abs.csv"
FULL = DATA / "uzbek100_f5" / "metadata_abs.csv"
OUT = DATA / "ayol2_f5"
OUT.mkdir(parents=True, exist_ok=True)
rng = random.Random(42)

def toks(t):
    return re.findall(r"[a-z']+", t.lower())

def counts(t):
    ws = toks(t)
    return {
        "x": sum(1 for w in ws if w.startswith("x")),
        "g": sum(1 for w in ws if w.startswith("g'")),
        "k": sum(1 for w in ws if w.startswith("k")),
        "i": sum(1 for w in ws if w.endswith("i")),
    }

# 1) AYOL kliplari — muammoli fonemali kliplar oversample (eng katta koeffitsient olinadi)
ayol_rows = [ln for ln in AYOL.read_text(encoding="utf-8").splitlines()[1:] if "|" in ln]
out_rows = []
stats = {"g4": 0, "x3": 0, "i2": 0, "k2": 0, "oddiy": 0}
for ln in ayol_rows:
    c = counts(ln.split("|", 1)[1])
    if c["g"] >= 1:
        mult = 4; stats["g4"] += 1
    elif c["x"] >= 1:
        mult = 3; stats["x3"] += 1
    elif c["i"] >= 3:
        mult = 2; stats["i2"] += 1
    elif c["k"] >= 2:
        mult = 2; stats["k2"] += 1
    else:
        mult = 1; stats["oddiy"] += 1
    out_rows.extend([ln] * mult)
n_ayol = len(out_rows)
print(f"ayol: {len(ayol_rows)} klip -> {n_ayol} yozuv (g'x4:{stats['g4']}, xx3:{stats['x3']}, "
      f"i x2:{stats['i2']}, k x2:{stats['k2']}, oddiy:{stats['oddiy']})")

# 2) REPLAY — to'liq ISSAI'dan fonemaga boy kliplar (ayol klipi bo'lmaganlari)
ayol_paths = {ln.split("|", 1)[0] for ln in ayol_rows}
g_pool, x_pool, i_pool, k_pool = [], [], [], []
for ln in FULL.read_text(encoding="utf-8").splitlines()[1:]:
    if "|" not in ln:
        continue
    p, t = ln.split("|", 1)
    if p in ayol_paths:
        continue
    c = counts(t)
    if c["g"] >= 1:
        g_pool.append(ln)
    elif c["x"] >= 2:
        x_pool.append(ln)
    elif c["i"] >= 4:
        i_pool.append(ln)
    elif c["k"] >= 3:
        k_pool.append(ln)

def take(pool, n):
    rng.shuffle(pool)
    return pool[:n]

replay = take(g_pool, 800) + take(x_pool, 400) + take(i_pool, 200) + take(k_pool, 100)
print(f"replay pool: g'={len(g_pool)}, x={len(x_pool)}, i={len(i_pool)}, k={len(k_pool)} "
      f"-> olindi {len(replay)}")
out_rows.extend(replay)

(OUT / "metadata_abs.csv").write_text("\n".join(["audio_file|text"] + out_rows), encoding="utf-8")
print(f"JAMI: {len(out_rows)} yozuv ({n_ayol} ayol + {len(replay)} replay) -> {OUT/'metadata_abs.csv'}")
