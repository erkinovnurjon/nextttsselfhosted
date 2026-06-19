"""
eval_piper_uz.py — Piper uz checkpoint'ni baholash.
Eng so'nggi ckpt'ni onnx'ga eksport → o'zbek x/gʻ test gaplari sintez → :3000/piper_uz.html
CPU'da ishlaydi (treningga xalaqit bermaydi).
  cd tts-server/training/piper1-gpl
  PYTHONUTF8=1 ../../venv-piper/Scripts/python.exe ../scripts/eval_piper_uz.py
"""
import sys, os, glob, subprocess, wave
from pathlib import Path
os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

TTS = Path(__file__).resolve().parents[2]            # tts-server
sys.path.insert(0, str(TTS / "training" / "piper1-gpl" / "src"))

CKDIR = TTS / "training/data/piper_uz/run/lightning_logs"  # version_* / checkpoints / *.ckpt
CFG = TTS / "training/data/piper_uz/uz_feruza.json"
ONNX = TTS / "training/data/piper_uz/uz_feruza.onnx"
PUB = TTS.parent / "public" / "piper_uz"; PUB.mkdir(parents=True, exist_ok=True)

TESTS = [
    "Oʻzbek xalqining tarixi gʻoyat boy, shaharlari keng, togʻlari koʻrkam.",
    "Xalqaro xabarlarga koʻra, xavfsizlik masalasi juda muhim.",
    "Gʻalaba bayrami katta tantana bilan nishonlanadi.",
    "Maktab oʻquvchilari bilim olish uchun har kuni darsga qatnashadi.",
    "Bugun ob-havo ochiq va quyoshli, harorat yigirma besh daraja.",
    "Kitob oʻqish insonni kamolotga yetaklaydi.",
]

# 1) eng so'nggi ckpt (barcha version_* papkalardan)
ckpts = sorted(glob.glob(str(CKDIR / "version_*" / "checkpoints" / "*.ckpt")), key=os.path.getmtime)
if not ckpts:
    print("ckpt yo'q"); sys.exit(1)
ckpt = ckpts[-1]
print(f"ckpt: {os.path.basename(ckpt)}", flush=True)

# 2) onnx eksport
print("onnx eksport...", flush=True)
r = subprocess.run([sys.executable, "-m", "piper.train.export_onnx",
                    "--checkpoint", ckpt, "--output-file", str(ONNX)],
                   capture_output=True, text=True, cwd=str(TTS / "training/piper1-gpl"))
if not ONNX.exists():
    print("EKSPORT XATO:", r.stderr[-500:]); sys.exit(1)
# config'ni onnx yoniga (.onnx.json)
import shutil
shutil.copy(str(CFG), str(ONNX) + ".json")
print("eksport OK", flush=True)

# 3) sintez (PiperVoice, CPU)
from piper import PiperVoice
voice = PiperVoice.load(str(ONNX), config_path=str(ONNX) + ".json")
for i, t in enumerate(TESTS, 1):
    out = PUB / f"{i}.wav"
    with wave.open(str(out), "wb") as wf:
        voice.synthesize_wav(t, wf)
    print(f"  [{i}] {out.name}", flush=True)

# 4) HTML
step = "".join(c for c in os.path.basename(ckpt) if c.isdigit() or c == '=')
rows = "".join(
    f'<div class="row"><div class="t">{i}. {t}</div>'
    f'<audio controls preload="none" src="piper_uz/{i}.wav"></audio></div>'
    for i, t in enumerate(TESTS, 1))
html = f"""<!doctype html><html lang="uz"><head><meta charset="utf-8">
<title>Piper o'zbek (FeruzaSpeech) — {os.path.basename(ckpt)}</title>
<style>body{{font-family:system-ui;margin:24px;background:#111;color:#eee;max-width:760px}}
.row{{border:1px solid #444;border-radius:8px;padding:12px;margin:10px 0;background:#1a1a24}}
.t{{margin-bottom:8px}}audio{{width:100%}}h2{{margin-bottom:2px}}p{{color:#9aa}}</style></head><body>
<h2>Piper o'zbek ovozi — nativ (espeak fonema: x→χ, gʻ→ʁ)</h2>
<p>Checkpoint: {os.path.basename(ckpt)} · FeruzaSpeech ayol · {len(TESTS)} test gap. x/gʻ to'g'ri o'qilishini tinglang.</p>
{rows}</body></html>"""
(TTS.parent / "public" / "piper_uz.html").write_text(html, encoding="utf-8")
print(f"\nTAYYOR → :3000/piper_uz.html", flush=True)
