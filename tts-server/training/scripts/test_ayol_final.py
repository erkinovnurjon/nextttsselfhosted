# Training tugagach AVTO-TEST: ckpts/ayol checkpointlarni qiyin jumlalarda sinaydi
# (ref=1571110404), ASR-WER + audio. Natija: output/ayol_final + public/ayol_final + REPORT.
#   .venv-f5/Scripts/python.exe training/scripts/test_ayol_final.py
import pyarrow.dataset  # noqa
import datasets  # noqa
import os, sys, io, re, gc, shutil
from pathlib import Path
os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
from importlib.resources import files
import numpy as np, soundfile as sf, torch
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parents[2]   # tts-server/
sys.path.insert(0, str(ROOT))
from server import whisper_engine

VOICES = ROOT / "voices"
CK = Path(str(files("f5_tts").joinpath("../../ckpts"))).resolve()
VOCAB = str(Path(str(files("f5_tts").joinpath("../../data/ayol_char/vocab.txt"))).resolve())
OUT = ROOT / "output" / "ayol_final"; OUT.mkdir(parents=True, exist_ok=True)
PUB = ROOT.parent / "public" / "ayol_final"; PUB.mkdir(parents=True, exist_ok=True)

_NORM = [("﻿",""),("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("`","'"),("“",'"'),("”",'"'),
         ("«",'"'),("»",'"'),("—","-"),("–","-"),("…","..."),("ӯ","u"),("Ӯ","U"),("ӽ","x")]
def norm(t):
    for a,b in _NORM: t=t.replace(a,b)
    t=t.strip()
    # x -> kh: TRENING bilan AYNAN bir xil (model kh = /x/ ni o'rgangan)
    return t.replace("X","Kh").replace("x","kh")
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

# Reference = 1571110404 ning O'Z klipi (dedicated model shu tembrда) — f5_ref_main EMAS!
# metadata_abs.csv matni ALLAQACHON x→kh normalizatsiyali. ~12 so'zli klipni tanlaymiz.
_META = ROOT / "training" / "data" / "ayol_f5" / "metadata_abs.csv"
_rows = [ln.split("|", 1) for ln in _META.read_text(encoding="utf-8").splitlines()[1:] if "|" in ln]
_ref = min(_rows, key=lambda r: abs(len(r[1].split()) - 12))
RWAV = _ref[0]
RTXT = _ref[1]
SENTS = [
    "O'zbek xalqining tarixi g'oyat boy, tog'lari ko'rkam.",      # asosiy og'riq
    "Xalqaro xabarlarga ko'ra, xavfsizlik masalasi juda muhim.",
    "G'alaba qo'shig'i yangrab, tog'u toshlar jaranglashdi.",
    "Xushxabar tarqaldi, xalq xursand bo'ldi.",
    "Bizning xalqimiz va boy tariximiz bilan faxrlanamiz.",
    "Assalomu alaykum! Bugun sizga qiziqarli voqeani so'zlab beraman.",  # ohang
]

# Checkpoint nomzodlari: eski (taqqos) + yangi ayol checkpointlar
cands = [("ESKI_uzbek100", CK / "uzbek100" / "model_last.pt")]
ayol_dir = CK / "ayol"
if ayol_dir.exists():
    nums = sorted(ayol_dir.glob("model_*.pt"),
                  key=lambda p: int(re.search(r"model_(\d+)", p.name).group(1)) if re.search(r"model_(\d+)", p.name) else 10**9)
    nums = [p for p in nums if "pretrained" not in p.name and "last" not in p.name]
    # Uzun trainingда overfit xavfi bor — checkpointlarni KENG oraliqdan tanlaymiz
    # (erta/o'rta/kech), ertalab eng yaxshisini quloq+WER bilan tanlash uchun.
    if len(nums) <= 4:
        pick = nums
    else:
        idx = [0, len(nums)//3, (2*len(nums))//3, len(nums)-1]
        pick = [nums[i] for i in sorted(set(idx))]
    for p in pick:
        cands.append((f"AYOL_{p.stem.split('_')[1]}", p))
    last = ayol_dir / "model_last.pt"
    if last.exists():
        cands.append(("AYOL_last", last))

report = [f"REF: 1571110404 ({RTXT[:50]}...)", ""]
summary = {}
for name, ckpt in cands:
    if not ckpt.exists():
        report.append(f"{name}: YO'Q ({ckpt})"); continue
    print(f"\n===== {name} =====", flush=True)
    m = F5TTS(model="F5TTS_v1_Base", ckpt_file=str(ckpt), vocab_file=VOCAB)
    wers = []
    report.append(f"== {name} ==")
    for i, s in enumerate(SENTS, 1):
        w, sr, _ = m.infer(RWAV, RTXT, norm(s), nfe_step=48, speed=0.9, seed=1234,
                           show_info=lambda *a, **k: None)
        f = OUT / f"{name}_{i}.wav"
        sf.write(str(f), np.asarray(w), sr, subtype="PCM_16")
        shutil.copy2(str(f), str(PUB / f.name))
        b = io.BytesIO(); sf.write(b, np.asarray(w, dtype="float32"), sr, format="WAV", subtype="PCM_16")
        h = whisper_engine.transcribe(b.getvalue()); e = wer(s, h); wers.append(e)
        line = f"  [{i}] WER={e:.0%}  {h}"
        print(line, flush=True); report.append(line)
    avg = sum(wers)/len(wers); summary[name] = avg
    report.append(f"  >>> {name} O'RTACHA: {avg:.0%}\n")
    del m; gc.collect(); torch.cuda.empty_cache()

report.append("===== XULOSA (past=yaxshi, lekin QULOQ hakam) =====")
for k, v in sorted(summary.items(), key=lambda x: x[1]):
    report.append(f"  {k:16s} {v:.0%}")
(OUT / "REPORT.txt").write_text("\n".join(report), encoding="utf-8")
print("\n" + "\n".join(report[-8:]))
print(f"\nAudio: {OUT} va {PUB}")

# ── Tinglash sahifasi (public/ayol_final.html) — ertalab brauzerda tayyor ──
rows_html = []
for name, _ck in cands:
    if name not in summary:
        continue
    cells = "".join(
        f'<div class="cell"><div class="lab">[{i}]</div>'
        f'<audio controls preload="none" src="/ayol_final/{name}_{i}.wav"></audio></div>'
        for i in range(1, len(SENTS) + 1)
    )
    rows_html.append(
        f'<div class="card"><h2>{name} — ASR WER {summary[name]:.0%}</h2>'
        f'<div class="grid">{cells}</div></div>'
    )
sents_html = "".join(f"<li>{i+1}. {s}</li>" for i, s in enumerate(SENTS))
html = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AYOL dedicated model — natija</title><style>
:root{{color-scheme:dark}}*{{box-sizing:border-box}}
body{{margin:0;padding:24px 16px 64px;font-family:system-ui,sans-serif;background:#0b0f17;color:#e6e9ef;line-height:1.5}}
.wrap{{max-width:960px;margin:0 auto}}h1{{font-size:22px;margin:0 0 8px}}
ol,ul{{color:#9aa4b2;font-size:13px}}li{{margin-bottom:2px}}
.card{{background:#111722;border:1px solid #1f2937;border-radius:14px;padding:14px 16px;margin-bottom:14px}}
.card h2{{font-size:15px;margin:0 0 10px;color:#a5b4fc}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:10px}}
.cell{{background:#0e141e;border:1px solid #1f2937;border-radius:10px;padding:8px}}
.lab{{font-size:11px;color:#6b7280;margin-bottom:4px}}audio{{width:100%;height:32px}}
</style></head><body><div class="wrap">
<h1>🌅 AYOL (1571110404) dedicated model — tungi natija</h1>
<ul>{sents_html}</ul>
{"".join(rows_html)}
</div><script>document.addEventListener("play",e=>{{document.querySelectorAll("audio").forEach(a=>{{if(a!==e.target)a.pause()}})}},true)</script>
</body></html>"""
(PUB.parent / "ayol_final.html").write_text(html, encoding="utf-8")
print("Tinglash sahifasi: /ayol_final.html")
