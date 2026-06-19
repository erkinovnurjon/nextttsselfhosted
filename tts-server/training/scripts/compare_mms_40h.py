"""
compare_mms_40h.py
==================
BASE MMS (facebook/mms-tts-uzb-script_cyrillic) va 40h fine-tuned modelni
solishtiradi — x/gʻ-zich gaplar, whisper ASR WER + audio sahifa.
XOTIRA OGOHLANTIRISHI: bu setup'da fine-tune avval base'ni BUZGAN — bu skript
yangi 40h+past-LR urinish base'dan yaxshimi/yomonmi QULOQ bilan hal qilish uchun.

Audio: output/compare_mms40/ + public/mms_40h/  (sahifa :3000/mms_40h.html)
  cd tts-server
  WHISPER_DEVICE=cpu PYTHONUTF8=1 .venv/Scripts/python.exe training/scripts/compare_mms_40h.py
"""
import io, json, os, re, shutil, sys
from pathlib import Path
os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np, soundfile as sf
import torch
from transformers import VitsModel, AutoTokenizer

ROOT = Path(__file__).resolve().parents[2]            # tts-server
sys.path.insert(0, str(ROOT))
from server.mms_engine import latin_to_cyrillic
from server.linguistic_normalizer import normalize_uzbek_text
from server import whisper_engine

BASE_ID = "facebook/mms-tts-uzb-script_cyrillic"
FT_DIR = ROOT / "training" / "checkpoints" / "mms_uzb_40h"
OUT = ROOT / "output" / "compare_mms40"; OUT.mkdir(parents=True, exist_ok=True)
PUB = ROOT.parent / "public" / "mms_40h"; PUB.mkdir(parents=True, exist_ok=True)
DEV = "cuda" if torch.cuda.is_available() else "cpu"

TESTS = [
    "Oʻzbek xalqining tarixi gʻoyat boy, shaharlari keng, togʻlari koʻrkam.",
    "Xalqaro xabarlarga koʻra, xavfsizlik masalasi juda muhim.",
    "Xavfsizlik qoidalariga rioya qilish zarur.",
    "Gʻalaba bayrami katta tantana bilan nishonlanadi.",
    "Maktab oʻquvchilari bilim olish uchun har kuni darsga qatnashadi.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
]

def words(t):
    t = t.lower().replace("'", "").replace("ʻ", "").replace("`", "")
    return [w for w in re.sub(r"[^a-zа-яёўғқҳ ]+", " ", t).split() if w]
def wer(r, h):
    r, h = words(r), words(h)
    if not r: return 0.0
    d = list(range(len(h)+1))
    for i in range(1, len(r)+1):
        prev, d[0] = d[0], i
        for j in range(1, len(h)+1):
            cur = d[j]; d[j] = min(d[j]+1, d[j-1]+1, prev+(r[i-1] != h[j-1])); prev = cur
    return d[len(h)]/len(r)
def asr(wav, sr):
    b = io.BytesIO(); sf.write(b, np.asarray(wav, dtype="float32"), sr, format="WAV", subtype="PCM_16")
    return whisper_engine.transcribe(b.getvalue())

def synth(model, tok, latin):
    cyr = latin_to_cyrillic(normalize_uzbek_text(latin)).strip()
    inp = tok(cyr, return_tensors="pt").to(DEV)
    with torch.no_grad():
        wav = model(**inp).waveform[0].cpu().numpy()
    return wav, model.config.sampling_rate

MODELS = [("base", BASE_ID)]
if (FT_DIR / "model.safetensors").exists():
    MODELS.append(("ft_40h", str(FT_DIR)))
else:
    print(f"⚠️ fine-tuned model topilmadi: {FT_DIR} — faqat base")

tok = AutoTokenizer.from_pretrained(BASE_ID)
results = {}
for name, src in MODELS:
    print(f"\n=== {name} ({src}) ===", flush=True)
    m = VitsModel.from_pretrained(src).to(DEV).eval()
    per, wers = [], []
    for i, t in enumerate(TESTS, 1):
        wav, sr = synth(m, tok, t)
        fn = f"{name}_{i}.wav"
        sf.write(str(OUT / fn), np.asarray(wav), sr, subtype="PCM_16")
        shutil.copy2(OUT / fn, PUB / fn)
        h = asr(wav, sr); e = wer(t, h)
        per.append({"text": t, "hyp": h, "wer": e}); wers.append(e)
        print(f"  [{i}] WER={e:.0%}  eshitdi: {h}", flush=True)
    results[name] = {"avg": sum(wers)/len(wers), "per": per}
    print(f"  >>> {name} O'RTACHA WER: {results[name]['avg']:.0%}", flush=True)
    del m; torch.cuda.empty_cache()

(OUT / "results.json").write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
print("\n" + "="*52 + "\nXULOSA (past = aniqroq o'qish):")
for n, r in sorted(results.items(), key=lambda x: x[1]["avg"]):
    print(f"  {n:10s} {r['avg']:.0%}")
print("="*52)
print("⚠️ ASR x/q/k ni ajratmaydi — RAQAM emas, QULOQ hakam (tabiiylik + x/gʻ).")

heads = "".join(f"<th>{i}. {t}</th>" for i, t in enumerate(TESTS, 1))
rows = []
for name, _ in MODELS:
    r = results[name]
    cells = "".join(
        f'<td><audio controls preload="none" src="mms_40h/{name}_{i}.wav"></audio>'
        f'<div class="h">{p["hyp"]}</div></td>' for i, p in enumerate(r["per"], 1))
    rows.append(f'<tr><th>{name}</th>{cells}</tr>')
html = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8">
<title>MMS 40h fine-tune vs base</title>
<style>body{{font-family:system-ui;margin:20px;background:#111;color:#eee}}
table{{border-collapse:collapse}}td,th{{border:1px solid #444;padding:6px;vertical-align:top;text-align:left}}
th{{background:#1d1d2b}}audio{{width:240px}}.h{{color:#999;font-size:11px;max-width:250px}}</style></head><body>
<h2>MMS 40h ko'p-spiker fine-tune (LR 5e-6) vs BASE</h2>
<p style="color:#aaa">ASR x/q/gʻ ni ajratmaydi → QULOQ hakam: tabiiylik + x/gʻ to'g'ri o'qishi.</p>
<table><tr><th>Model</th>{heads}</tr>{''.join(rows)}</table></body></html>"""
(ROOT.parent / "public" / "mms_40h.html").write_text(html, encoding="utf-8")
print(f"Audio: {OUT}\nSahifa: :3000/mms_40h.html")
