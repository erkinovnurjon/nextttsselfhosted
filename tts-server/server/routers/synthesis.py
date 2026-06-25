"""Sintez endpointlari — barcha TTS dvigatellari va ASR.

POST /synthesize       → XTTS v2 voice cloning (base/fine-tuned), reference voice bo'yicha
POST /synthesize/f5    → F5-TTS tabiiy ayol ovozi (:8001 mikroservisiga proxy)
POST /synthesize/piper → Piper nativ o'zbek ovozi (:8002 mikroservisiga proxy)
POST /synthesize/mms   → Meta MMS (tug'ma o'zbek, reference kerak emas)
POST /transcribe       → WAV → o'zbek matn (Whisper ASR)

Linguistik normalizatsiya (raqam/sana/matematika/birlik → so'z) shu qatlamda,
har bir dvigatel uchun bir xil tarzda qo'llanadi.
"""

import io
import os
import time
import urllib.parse

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from server.config import VOICES_DIR, SUPPORTED_LANGS, F5_SERVER_URL, PIPER_SERVER_URL
from server.state import state
from server.model_loader import resolve_checkpoint, load_checkpoint_into_cache
from server.text_normalizer import normalize_uzbek_to_turkish_phonetic
from server.linguistic_normalizer import normalize_uzbek_text
from server.schemas import (
    SynthesizeRequest,
    MMSSynthesizeRequest,
    F5SynthesizeRequest,
    PiperSynthesizeRequest,
)

router = APIRouter()


@router.post("/synthesize")
def synthesize(req: SynthesizeRequest):
    if state["tts"] is None and state["loaded_checkpoint"] is None:
        raise HTTPException(503, "Model hali yuklanmagan")
    if req.language not in SUPPORTED_LANGS:
        raise HTTPException(400, f"Til qo'llanmaydi: {req.language}")

    voice_dir = VOICES_DIR / req.voice
    reference = voice_dir / "reference.wav"
    if not reference.exists():
        raise HTTPException(404, f"Reference yo'q: {req.voice}. Avval prepare_reference.py ishga tushiring.")

    # Maxsus checkpoint so'ralgan bo'lsa, uni yuklash (yoki almashtirish)
    if req.checkpoint_id:
        loaded = state["loaded_checkpoint"]
        if loaded is None or loaded["id"] != req.checkpoint_id:
            target = resolve_checkpoint(req.checkpoint_id)
            if not target:
                raise HTTPException(404, f"Checkpoint topilmadi: {req.checkpoint_id}")
            try:
                load_checkpoint_into_cache(target)
            except Exception as e:
                raise HTTPException(500, f"Checkpoint yuklab bo'lmadi: {e}")

    # Matnni 2 bosqich normalizatsiya qilish
    # MUHIM: fine-tuned model LIGHT normalizatsiyada o'rgatilgan (q, x, oʻ, gʻ saqlanadi)
    # Base model uchun HEAVY normalizatsiya kerak edi (q→k va h.k.)
    text_for_synth = req.text
    if req.normalize:
        text_for_synth = normalize_uzbek_text(text_for_synth)
        if req.language == "tr":
            use_light = state["model_kind"] == "finetuned"
            text_for_synth = normalize_uzbek_to_turkish_phonetic(text_for_synth, light=use_light)

    t0 = time.time()
    import tempfile
    import soundfile as sf

    if state["model_kind"] == "finetuned":
        # Lower-level Xtts API
        loaded = state["loaded_checkpoint"]
        model = loaded["model"]
        config = loaded["config"]
        out = model.synthesize(
            text_for_synth,
            config,
            speaker_wav=str(reference),
            gpt_cond_len=3,
            language=req.language,
            temperature=req.temperature,
            repetition_penalty=req.repetition_penalty,
            top_k=req.top_k,
            top_p=req.top_p,
            speed=req.speed,
        )
        elapsed = time.time() - t0
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        sf.write(tmp_path, out["wav"], 24000, subtype="PCM_16")
    else:
        # High-level TTS API
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_path = tmp.name
        state["tts"].tts_to_file(
            text=text_for_synth,
            file_path=tmp_path,
            speaker_wav=str(reference),
            language=req.language,
            speed=req.speed,
            split_sentences=True,
            temperature=req.temperature,
            repetition_penalty=req.repetition_penalty,
            top_k=req.top_k,
            top_p=req.top_p,
        )
        elapsed = time.time() - t0

    try:
        with open(tmp_path, "rb") as f:
            audio_bytes = f.read()

        loaded = state["loaded_checkpoint"]
        return StreamingResponse(
            io.BytesIO(audio_bytes),
            media_type="audio/wav",
            headers={
                "X-Synthesis-Time-Sec": f"{elapsed:.3f}",
                "X-Voice": req.voice,
                "X-Language": req.language,
                "X-Model-Kind": state["model_kind"],
                "X-Checkpoint-Id": loaded["id"] if loaded else "",
                "X-Original-Text": urllib.parse.quote(req.text[:200]),
                "X-Normalized-Text": urllib.parse.quote(text_for_synth[:200]),
                "Content-Disposition": 'inline; filename="synth.wav"',
            },
        )
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


@router.post("/synthesize/f5")
def synthesize_f5(req: F5SynthesizeRequest):
    """F5-TTS tabiiy ovoz — :8001 mikroservisiga proxy.

    Linguistik normalizatsiya (raqam/sana/matematik ifoda/birlik/lug'at → so'z) SHU YERDA
    qilinadi — Piper/MMS bilan bir xil. F5 server keyin char/x→kh/talaffuz bilan davom etadi.
    (Avval F5 XOM matn olardi → "2025"/"3+5=8"/"5000 so'm" g'aliz o'qilardi.)
    """
    import requests as _rq

    # Raqam/sana/matematika/birlikni so'zga aylantiramiz (F5 server buni o'zi qilmaydi).
    # x/gʻ/q char-normalizatsiya F5 server'da qoladi (training bilan mos).
    text = normalize_uzbek_text(req.text)

    try:
        r = _rq.post(
            f"{F5_SERVER_URL}/synthesize/f5",
            json={"text": text, "speed": req.speed, "nfe_step": req.nfe_step,
                  "voice": req.voice, "ref_wav": req.ref_wav, "ref_text": req.ref_text,
                  "seed": req.seed},
            timeout=180,
        )
    except Exception as e:
        raise HTTPException(
            503,
            f"F5 ovoz serveri (8001) bilan bog'lanib bo'lmadi: {e}. "
            "Ishga tushirish: .venv-f5/Scripts/python.exe -m uvicorn f5_server:app --port 8001",
        )
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"F5 sintez xatosi: {r.text[:300]}")

    return StreamingResponse(
        io.BytesIO(r.content),
        media_type="audio/wav",
        headers={
            "X-Synthesis-Time-Sec": r.headers.get("X-Synthesis-Time-Sec", ""),
            "X-Model-Kind": "f5-feruza",
            "X-Engine": "f5",
            "X-Voice": r.headers.get("X-Voice", req.voice),
            "X-Checkpoint-Id": "f5-feruza",
            "X-Checkpoint": r.headers.get("X-Checkpoint", ""),
            "Content-Disposition": 'inline; filename="f5.wav"',
        },
    )


@router.post("/synthesize/piper")
def synthesize_piper(req: PiperSynthesizeRequest):
    """Piper nativ o'zbek ovozi — :8002 CPU mikroservisiga proxy."""
    import requests as _rq

    # MMS singari linguistik normalizatsiya: espeak xom raqamni xato o'qiydi
    # (2025→2008). normalize_uzbek_text sonlar/sana/qisqartmani lotin so'zga aylantiradi.
    text = normalize_uzbek_text(req.text) if req.normalize else req.text

    try:
        r = _rq.post(
            f"{PIPER_SERVER_URL}/synthesize/piper",
            json={"text": text, "length_scale": req.length_scale},
            timeout=120,
        )
    except Exception as e:
        raise HTTPException(
            503,
            f"Piper ovoz serveri (8002) bilan bog'lanib bo'lmadi: {e}. "
            "Ishga tushirish: venv-piper/Scripts/python.exe -m uvicorn piper_server:app --port 8002",
        )
    if r.status_code != 200:
        raise HTTPException(r.status_code, f"Piper sintez xatosi: {r.text[:300]}")

    return StreamingResponse(
        io.BytesIO(r.content),
        media_type="audio/wav",
        headers={
            "X-Model-Kind": "piper-uz",
            "X-Engine": "piper",
            "X-Checkpoint-Id": "piper-uz",
            "Content-Disposition": 'inline; filename="piper.wav"',
        },
    )


@router.post("/synthesize/mms")
def synthesize_mms(req: MMSSynthesizeRequest):
    """Meta MMS bilan sintez — tug'ma o'zbek, ovoz cloning yo'q, fonetik to'liq.

    XTTS'dan farqi: reference voice kerak emas, bitta fikslangan ovoz, lekin
    q/x/oʻ/gʻ to'g'ri talaffuz qilinadi. Lotin matn ichida kirillga o'giriladi.
    """
    import io as _io
    import soundfile as sf
    from server import mms_engine

    text = req.text
    if req.normalize:
        text = normalize_uzbek_text(text)

    t0 = time.time()
    try:
        wav, sr, cyr = mms_engine.synthesize(
            text,
            voice=req.voice,
            speaking_rate=req.speaking_rate,
            noise_scale_duration=req.noise_scale_duration,
        )
    except Exception as e:
        raise HTTPException(500, f"MMS sintez xatosi: {e}")
    elapsed = time.time() - t0

    buf = _io.BytesIO()
    sf.write(buf, wav, sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="audio/wav",
        headers={
            "X-Synthesis-Time-Sec": f"{elapsed:.3f}",
            "X-Model-Kind": "mms-vits",
            "X-Engine": "mms",
            "X-Original-Text": urllib.parse.quote(req.text[:200]),
            "X-Normalized-Text": urllib.parse.quote(cyr[:200]),
            "Content-Disposition": 'inline; filename="mms.wav"',
        },
    )


@router.post("/transcribe")
async def transcribe(request: Request):
    """Ovozli kiritish — WAV baytlardan o'zbek matnini qaytaradi (Whisper)."""
    audio = await request.body()
    if not audio:
        raise HTTPException(400, "Audio bo'sh")
    try:
        from server import whisper_engine
        text = whisper_engine.transcribe(audio)
    except Exception as e:
        raise HTTPException(500, f"ASR xatosi: {e}")
    return {"text": text}
