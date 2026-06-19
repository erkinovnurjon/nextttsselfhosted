# F5 inference uchun reference klip tanlash (Feruza ayol timbri).
# 6-9s, to'liq jumla (nuqta bilan tugaydi), o'rtacha uzunlik. voices/ ga saqlanadi.
import shutil
from pathlib import Path
import soundfile as sf

BASE = Path(r"C:/Projects/nexttts/tts-server/training/data/feruza_f5")
OUTDIR = Path(r"C:/Projects/nexttts/tts-server/voices")
OUTDIR.mkdir(parents=True, exist_ok=True)

lines = (BASE / "metadata.csv").read_text(encoding="utf-8").splitlines()
# normalizatsiya (train bilan bir xil — f5_engine ham shu mantiqни ishlatadi)
NORM = [("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("`","'"),("“",'"'),("”",'"'),
        ("«",'"'),("»",'"'),("—","-"),("–","-"),("…","..."),("ӯ","u"),("Ӯ","U"),("ӽ","x")]
def norm(t):
    for a,b in NORM: t=t.replace(a,b)
    return t

best = None
for l in lines:
    rel, text = l.split("|", 1)
    wav = BASE / rel
    if not wav.exists():
        continue
    info = sf.info(str(wav))
    dur = info.frames / info.samplerate
    t = norm(text).strip()
    # tanlov mezoni: 6-9s, 60-160 belgi, jumla nuqta/!/? bilan tugaydi, tirnoqsiz
    if 6.0 <= dur <= 9.0 and 60 <= len(t) <= 160 and t[-1] in ".!?" and '"' not in t:
        best = (rel, t, dur)
        break

if not best:
    print("Mos klip topilmadi — mezonni yumshatish kerak.")
else:
    rel, t, dur = best
    shutil.copy2(BASE / rel, OUTDIR / "f5_ref_feruza.wav")
    (OUTDIR / "f5_ref_feruza.txt").write_text(t, encoding="utf-8")
    print(f"Reference: {rel}  ({dur:.1f}s)")
    print(f"Matn: {t}")
    print(f"Saqlandi: {OUTDIR/'f5_ref_feruza.wav'}")
