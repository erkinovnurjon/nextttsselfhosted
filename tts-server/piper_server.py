# Piper-TTS inference mikroservisi (port 8002, venv-piper muhitida, CPU/onnxruntime).
# Nativ o'zbek ovoz (FeruzaSpeech, espeak fonema: x→χ, gʻ→ʁ, ch→tʃ). GPU TALAB QILMAYDI
# → training GPU'da ketayotganda ham ishlaydi. main.py /synthesize/piper'ni bu yerga proxy qiladi.
#
# Ishga tushirish:
#   cd tts-server
#   PYTHONUTF8=1 venv-piper/Scripts/python.exe -m uvicorn piper_server:app --host 127.0.0.1 --port 8002
import io
import os
import wave
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from piper import PiperVoice, SynthesisConfig

# Piper/espeak chiqishi gap boshida ~1.5s, oxirida ~0.3s sukunat qoldiradi.
# Onset/offset sukunatini kesib, tabiiy attack uchun kichik pad qoldiramiz.
LEAD_PAD_MS = 40    # boshda qoldiriladigan sukunat
TAIL_PAD_MS = 120   # oxirda qoldiriladigan sukunat


def _trim_silence(pcm: bytes, sr: int, lead_ms=LEAD_PAD_MS, tail_ms=TAIL_PAD_MS) -> bytes:
    """16-bit mono PCM boshi/oxiridagi sukunatni kesadi, kichik pad qoldiradi."""
    a = np.frombuffer(pcm, dtype=np.int16)
    if a.size == 0:
        return pcm
    amp = np.abs(a.astype(np.float32))
    peak = amp.max()
    if peak <= 0:
        return pcm
    thr = max(peak * 0.02, 300.0)  # nisbiy + mutlaq pol (juda jim onsetlarni ham ushlaydi)
    voiced = np.where(amp > thr)[0]
    if voiced.size == 0:
        return pcm
    start = max(0, voiced[0] - int(sr * lead_ms / 1000))
    end = min(a.size, voiced[-1] + 1 + int(sr * tail_ms / 1000))
    return a[start:end].tobytes()

ROOT = Path(__file__).resolve().parent  # tts-server/
# Barqaror deploy nusxasi (training ustiga yozmaydi); PIPER_ONNX env bilan almashtiriladi.
ONNX = os.environ.get(
    "PIPER_ONNX",
    str(ROOT / "training" / "data" / "piper_uz" / "uz_feruza_deploy.onnx"),
)

state = {"voice": None}
app = FastAPI(title="NextTTS Piper engine")


@app.on_event("startup")
def _load():
    cfg = ONNX + ".json"
    print(f"⏳ Piper yuklanmoqda: {ONNX}", flush=True)
    state["voice"] = PiperVoice.load(ONNX, config_path=cfg)
    print("✅ Piper tayyor (CPU)", flush=True)


class Req(BaseModel):
    text: str
    length_scale: float = 1.0   # >1 = sekinroq/tinchroq, <1 = tezroq
    # noise 0.667/0.8 (Piper default) gʻ/q/j undoshlarini beqaror qilardi (buzilish
    # WER ~22%). ASR-sweep bilan 0.5/0.6 tanlandi → WER ~9%, tabiiylik saqlanadi.
    noise_scale: float = 0.5
    noise_w: float = 0.6


@app.get("/health")
def health():
    return {"available": state["voice"] is not None, "engine": "piper",
            "onnx": os.path.basename(ONNX)}


@app.post("/synthesize/piper")
def synthesize(req: Req):
    if state["voice"] is None:
        return JSONResponse({"error": "model yuklanmagan"}, status_code=503)
    text = (req.text or "").strip()
    if not text:
        return JSONResponse({"error": "matn bo'sh"}, status_code=400)
    syn = SynthesisConfig(
        length_scale=req.length_scale,
        noise_scale=req.noise_scale,
        noise_w_scale=req.noise_w,
    )
    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        state["voice"].synthesize_wav(text, wf, syn_config=syn)

    # Gap boshi/oxiridagi sukunatni kesib qayta o'ramiz (pauza muammosi).
    buf.seek(0)
    with wave.open(buf, "rb") as rf:
        nch, sw, sr = rf.getnchannels(), rf.getsampwidth(), rf.getframerate()
        raw = rf.readframes(rf.getnframes())
    if nch == 1 and sw == 2:
        raw = _trim_silence(raw, sr)
    out = io.BytesIO()
    with wave.open(out, "wb") as wf:
        wf.setnchannels(nch); wf.setsampwidth(sw); wf.setframerate(sr)
        wf.writeframes(raw)

    return Response(
        content=out.getvalue(),
        media_type="audio/wav",
        headers={
            "X-Engine": "piper",
            "X-Model-Kind": "piper-uz",
            "Content-Disposition": 'inline; filename="piper.wav"',
        },
    )
