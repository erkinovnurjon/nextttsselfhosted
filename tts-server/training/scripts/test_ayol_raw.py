# Trening tugagach AVTO-TEST: ckpts/ayol_raw checkpointlarni (XOM model) qiyin x/gʻ
# jumlalarida sinaydi. Deploy retsepti: xom x + onset + split + DETERMINIZM + seed sweep.
# Har checkpoint uchun eng yaxshi seed (ASR-WER), audio + /ayol_raw.html + REPORT.
#   .venv-f5/Scripts/python.exe training/scripts/test_ayol_raw.py
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import io, os, re, sys, gc
os.environ.setdefault("WHISPER_DEVICE", "cpu")
os.environ.setdefault("KMP_DUPLICATE_LIB_OK", "TRUE")
os.environ["CUBLAS_WORKSPACE_CONFIG"] = ":4096:8"
from pathlib import Path
from importlib.resources import files
import numpy as np, soundfile as sf
import torch
torch.use_deterministic_algorithms(True, warn_only=True)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

ROOT = Path(__file__).resolve().parents[2]   # tts-server/
sys.path.insert(0, str(ROOT))
import f5_server as F  # noqa: E402  (norm + paths)
from f5_tts.api import F5TTS  # noqa: E402
from server import whisper_engine  # noqa: E402

CK = Path(str(files("f5_tts").joinpath("../../ckpts/ayol_raw"))).resolve()
VOCAB = str(F.MODELS["uzbek100"]["vocab"])   # base 2545 (ayol_raw ham base vocab)
OUT = ROOT / "output" / "ayol_raw"; OUT.mkdir(parents=True, exist_ok=True)
PUB = ROOT.parent / "public" / "ayol_raw"; PUB.mkdir(parents=True, exist_ok=True)
RW = str(F.VOICES / "f5_ref_ayol.wav")
RT = F.normalize((F.VOICES / "f5_ref_ayol.txt").read_text(encoding="utf-8"))

SENTS = [
    "Xushxabar tarqaldi, xalq xursand bo'ldi.",
    "O'zbek xalqining tarixi g'oyat boy, tog'lari ko'rkam.",
    "G'alaba qo'shig'i yangrab, tog'u toshlar jaranglashdi.",
    "Maxsus xizmat xodimi muhim axborotni tekshirdi.",
    "Assalomu alaykum! Bugun sizga qiziqarli voqeani so'zlab beraman.",
    "Bahor keldi, bog'larda gullar ochildi, qushlar mayin sayraydi.",
]
SEEDS = [1234, 555, 99, 7, 42]

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
            cur=d[j]; d[j]=min(d[j]+1, d[j-1]+1, prev+(r[i-1]!=h[j-1])); prev=cur
    return d[len(h)]/len(r)

def synth(model, text, seed):
    t = F.apply_x2kh(F.smart_lowercase(F.normalize(text)), "init")  # XOM x
    parts, sr = [], 24000
    for sent in F.split_sentences(t):
        w, sr, _ = model.infer(RW, RT, ", " + sent, nfe_step=48, speed=0.9, seed=seed,
                               show_info=lambda *a, **k: None)
        if parts: parts.append(np.zeros(int(0.3*sr), dtype="float32"))
        parts.append(np.asarray(w, dtype="float32"))
    return np.concatenate(parts), sr

# Checkpoint nomzodlari
cands = []
for name in ["model_2000.pt", "model_last.pt"]:
    p = CK / name
    if p.exists():
        cands.append((name.replace(".pt", ""), str(p)))
for p in sorted(CK.glob("model_*.pt")):
    tag = p.stem
    if tag not in [c[0] for c in cands]:
        cands.append((tag, str(p)))

report = [f"AYOL_RAW (xom, kh'siz) test. ref={Path(RW).name}", f"ckpts: {[c[0] for c in cands]}", ""]
print("checkpoints:", [c[0] for c in cands], flush=True)
best_overall = None
cards = []
for tag, ckpt in cands:
    print(f"\n===== {tag} =====", flush=True)
    model = F5TTS(model="F5TTS_v1_Base", ckpt_file=ckpt, vocab_file=VOCAB)
    seed_res = {}
    for seed in SEEDS:
        errs = []
        for s in SENTS:
            wav, sr = synth(model, s, seed)
            b = io.BytesIO(); sf.write(b, wav, sr, format="WAV", subtype="PCM_16")
            errs.append(wer(s, whisper_engine.transcribe(b.getvalue())))
        seed_res[seed] = (sum(errs)/len(errs), max(errs))
        print(f"  seed={seed:>5} avg={seed_res[seed][0]:.0%} worst={seed_res[seed][1]:.0%}", flush=True)
    bseed = min(seed_res, key=lambda s: (seed_res[s][1], seed_res[s][0]))
    bavg, bworst = seed_res[bseed]
    report.append(f"== {tag} == eng yaxshi seed={bseed} avg={bavg:.0%} worst={bworst:.0%}")
    # eng yaxshi seed bilan audio saqlash + jumlama-jumla ASR
    cells = []
    for i, s in enumerate(SENTS):
        wav, sr = synth(model, s, bseed)
        sf.write(str(PUB / f"{tag}_{i}.wav"), wav, sr, subtype="PCM_16")
        b = io.BytesIO(); sf.write(b, wav, sr, format="WAV", subtype="PCM_16")
        h = whisper_engine.transcribe(b.getvalue()); e = wer(s, h)
        report.append(f"   [{i}] WER={e:.0%} {h}")
        cells.append(f'<div class=c><div class=l>[{i}] WER {e:.0%} — {h}</div>'
                     f'<audio controls preload=none src="/ayol_raw/{tag}_{i}.wav"></audio></div>')
    cards.append(f'<div class=card><h2>{tag} — seed {bseed}, avg {bavg:.0%}, worst {bworst:.0%}</h2>{"".join(cells)}</div>')
    if best_overall is None or (bworst, bavg) < (best_overall[2], best_overall[3]):
        best_overall = (tag, bseed, bworst, bavg, ckpt)
    report.append("")
    del model; gc.collect(); torch.cuda.empty_cache()

report.append(f">>> ENG YAXSHI: checkpoint={best_overall[0]} seed={best_overall[1]} "
              f"worst={best_overall[2]:.0%} avg={best_overall[3]:.0%}")
report.append(f"    ckpt yo'li: {best_overall[4]}")
(OUT / "REPORT.txt").write_text("\n".join(report), encoding="utf-8")
print("\n".join(report[-4:]), flush=True)

sents_html = "".join(f"<li>{i}. {s}</li>" for i, s in enumerate(SENTS))
html = f"""<!doctype html><html lang=uz><head><meta charset=utf-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>Ayol XOM (kh'siz) — natija</title><style>
:root{{color-scheme:dark}}body{{margin:0;padding:20px;font-family:system-ui,sans-serif;background:#0b0f17;color:#e6e9ef}}
.wrap{{max-width:900px;margin:0 auto}}h1{{font-size:20px}}ul{{color:#9aa4b2;font-size:13px}}
.card{{background:#111722;border:1px solid #1f2937;border-radius:12px;padding:12px 14px;margin:12px 0}}
.card h2{{font-size:14px;color:#a5b4fc;margin:0 0 8px}}.c{{margin:6px 0}}.l{{font-size:12px;color:#9aa4b2;margin-bottom:3px}}
audio{{width:100%;height:30px}}</style></head><body><div class=wrap>
<h1>🌅 Ayol XOM model (kh'siz) — tungi natija</h1>
<p style="color:#9aa4b2;font-size:13px">x/gʻ tiniqligini quloq bilan baholang. WER faqat tushunarlilik.</p>
<ul>{sents_html}</ul>{"".join(cards)}</div></body></html>"""
(ROOT.parent / "public" / "ayol_raw.html").write_text(html, encoding="utf-8")
print("Tinglash: http://localhost:3000/ayol_raw.html", flush=True)
