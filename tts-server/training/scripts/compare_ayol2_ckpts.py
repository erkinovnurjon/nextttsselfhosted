# ayol2 checkpoint'larini solishtiradi (ckpts/ayol2/model_*.pt + model_last)
# + ayol_12k (eski dedicated) va uzbek100/model_last (yangi baza) baseline.
# 8 gap (2 tasi gap-boshi x-so'z — foydalanuvchi shikoyati), whisper ASR WER.
# Matn production yo'liga mos KICHRAYTIRILADI (f5_server smart_lowercase bilan bir xil).
# Audio: output/compare_ayol2/ + public/ayol2_ckpt/ (sahifa public/ayol2_ckpt.html).
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/compare_ayol2_ckpts.py
import pyarrow.dataset  # noqa
import datasets  # noqa
import io, json, os, re, shutil, sys
from pathlib import Path
from importlib.resources import files
os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")

import numpy as np, soundfile as sf
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[2]          # tts-server
sys.path.insert(0, str(ROOT))
from server import whisper_engine

VOICES = ROOT / "voices"
OUT = ROOT / "output" / "compare_ayol2"
OUT.mkdir(parents=True, exist_ok=True)
PUB = ROOT.parent / "public" / "ayol2_ckpt"
PUB.mkdir(parents=True, exist_ok=True)
CK = Path(str(files("f5_tts").joinpath("../../ckpts"))).resolve()
VOCAB = str(Path(str(files("f5_tts").joinpath("../../data/ayol_char/vocab.txt"))).resolve())
REF_WAV = str(VOICES / "f5_ref_main.wav")           # 1571110404 (Ayol)
_NORM = [("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("`","'"),("“",'"'),("”",'"'),
         ("«",'"'),("»",'"'),("—","-"),("–","-"),("…","..."),("ӯ","u"),("Ӯ","U"),("ӽ","x")]
_TITLE_WORD = re.compile(r"\b[A-ZА-ЯЁЎҒҚҲ][\w'ʻ-]*")
def norm(t):
    for a,b in _NORM: t=t.replace(a,b)
    t = _TITLE_WORD.sub(lambda m: m.group(0) if any(c.isupper() for c in m.group(0)[1:]) else m.group(0).lower(), t)
    return t.strip()
REF_TXT = norm((VOICES / "f5_ref_main.txt").read_text(encoding="utf-8"))

TESTS = [
    "Assalomu alaykum, bu o'zbek tilidagi sun'iy ovoz sinovi.",
    "Toshkent shahrida xalq ko'p, bog'larida qushlar sayraydi.",
    "Ilm olish har bir inson uchun muqaddas burchdir, deb hisoblayman.",
    "Xalqaro xabarlarga ko'ra, xavfsizlik masalasi juda muhim.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Maktab o'quvchilari bilim olish uchun har kuni darsga qatnashadi.",
    "Xavfsizlik qoidalariga rioya qilish zarur.",
    "Xabar bugun ertalab keldi.",
    # foydalanuvchi shikoyati: g'/k boshli va -i bilan tugaydigan so'zlar
    "G'alaba bayrami katta tantana bilan nishonlanadi.",
    "Kitob o'qish insonni kamolotga yetaklaydi.",
    "Uning kitobi stol ustida turibdi.",
    "O'quvchilarning daftarlari va kitoblari sumkalarida saqlanadi.",
]

def discover_models():
    models = []
    d = CK / "ayol2"
    steps = []
    for p in sorted(d.glob("model_*.pt")):
        m = re.fullmatch(r"model_(\d+)\.pt", p.name)
        if m: steps.append((int(m.group(1)), p))
    steps.sort()
    for s, p in steps:
        models.append((f"ayol2_{s//1000}k", p))
    if (d / "model_last.pt").exists():
        models.append(("ayol2_last", d / "model_last.pt"))
    if (CK / "ayol" / "model_12000.pt").exists():
        models.append(("ayol_12k", CK / "ayol" / "model_12000.pt"))
    if (CK / "uzbek100" / "model_last.pt").exists():
        models.append(("uz100_last", CK / "uzbek100" / "model_last.pt"))
    return models

def words(t):
    t=t.lower().replace("'","").replace("ʻ","").replace("`","")
    return [w for w in re.sub(r"[^a-zа-яёўғқҳ ]+"," ",t).split() if w]
def wer(r,h):
    r,h=words(r),words(h)
    if not r: return 0.0
    d=list(range(len(h)+1))
    for i in range(1,len(r)+1):
        prev,d[0]=d[0],i
        for j in range(1,len(h)+1):
            cur=d[j]; d[j]=min(d[j]+1,d[j-1]+1,prev+(r[i-1]!=h[j-1])); prev=cur
    return d[len(h)]/len(r)
def asr(wav,sr):
    b=io.BytesIO(); sf.write(b,np.asarray(wav,dtype="float32"),sr,format="WAV",subtype="PCM_16")
    return whisper_engine.transcribe(b.getvalue())

MODELS = discover_models()
print(f"{len(MODELS)} ta checkpoint: {', '.join(n for n,_ in MODELS)}", flush=True)

results = {}
for name, ckpt in MODELS:
    print(f"\n=== {name} ({ckpt.name}) yuklanmoqda ===", flush=True)
    m = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(ckpt), vocab_file=VOCAB)
    per, wers = [], []
    for i, t in enumerate(TESTS, 1):
        wav, sr, _ = m.infer(REF_WAV, REF_TXT, norm(t), nfe_step=48, cfg_strength=2.0,
                             speed=1.0, seed=1234, show_info=lambda *a, **k: None)
        fn = f"{name}_{i}.wav"
        sf.write(str(OUT / fn), np.asarray(wav), sr, subtype="PCM_16")
        shutil.copy2(OUT / fn, PUB / fn)
        h = asr(wav, sr); e = wer(t, h)
        per.append({"text": t, "hyp": h, "wer": e}); wers.append(e)
        print(f"  [{i}] WER={e:.0%}  eshitdi: {h}", flush=True)
    avg = sum(wers)/len(wers)
    results[name] = {"avg": avg, "per": per}
    print(f"  >>> {name} O'RTACHA WER: {avg:.0%}", flush=True)
    del m
    import gc, torch; gc.collect(); torch.cuda.empty_cache()

(OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

print("\n" + "="*56)
print("XULOSA (past = yaxshiroq o'qish):")
for name, r in sorted(results.items(), key=lambda x: x[1]["avg"]):
    print(f"  {name:16s} {r['avg']:.0%}")
print("="*56)

rows = []
for name, _ in MODELS:
    if name not in results: continue
    r = results[name]
    cells = "".join(
        f'<td><audio controls preload="none" src="ayol2_ckpt/{name}_{i}.wav"></audio>'
        f'<div class="w">{p["wer"]:.0%}</div><div class="h">{p["hyp"]}</div></td>'
        for i, p in enumerate(r["per"], 1))
    rows.append(f'<tr><th>{name}<div class="w">o\'rtacha {r["avg"]:.0%}</div></th>{cells}</tr>')
heads = "".join(f"<th>{i}. {t}</th>" for i, t in enumerate(TESTS, 1))
html = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8">
<title>ayol2 checkpoint solishtiruv</title>
<style>body{{font-family:system-ui;margin:20px;background:#111;color:#eee}}
table{{border-collapse:collapse}}td,th{{border:1px solid #444;padding:6px;vertical-align:top;text-align:left}}
th{{background:#1d1d2b}}audio{{width:230px}}.w{{color:#7fd47f;font-weight:600}}.h{{color:#999;font-size:11px;max-width:240px}}</style>
</head><body><h2>ayol2 (1571110404 dedicated, uzbek100 bazadan) — checkpoint solishtiruv (seed 1234, nfe 48, kichik harf)</h2>
<table><tr><th>Checkpoint</th>{heads}</tr>{''.join(rows)}</table></body></html>"""
(ROOT.parent / "public" / "ayol2_ckpt.html").write_text(html, encoding="utf-8")
print(f"Audio: {OUT}\nSahifa: public/ayol2_ckpt.html")
