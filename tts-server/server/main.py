"""
NextTTS FastAPI server — XTTS v2 voice cloning HTTP endpoint.

Next.js frontend bu serverga so'rov yuboradi va sizning ovoz bilan
sintezlangan WAV audio'ni qaytaradi.

Ishga tushirish:
    cd tts-server
    .venv/Scripts/uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload

yoki PowerShell'da:
    .\.venv\Scripts\activate
    uvicorn server.main:app --port 8000

Endpointlar:
    GET  /health          → {status, model_loaded, device, vram_used}
    GET  /voices          → mavjud reference voicelar ro'yxati
    POST /synthesize      → matn → WAV audio
    POST /reference/build → reference.wav qayta yaratish (yangi yozuvlardan)
"""

import io
import os
import re
import sys
import time
import urllib.parse
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Literal, Optional

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["COQUI_TOS_AGREED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
VOICES_DIR = PROJECT_ROOT / "tts-server" / "voices"
SAMPLES_DIR = VOICES_DIR / "samples"
DEFAULT_REFERENCE = VOICES_DIR / "main" / "reference.wav"
CHECKPOINTS_DIR = PROJECT_ROOT / "tts-server" / "training" / "checkpoints" / "xtts_v2_uzbek"
XTTS_CACHE = Path.home() / "AppData" / "Local" / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"

# Make scripts importable
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field

from server.text_normalizer import normalize_uzbek_to_turkish_phonetic
from server.linguistic_normalizer import normalize_uzbek_text
from server import mms_engine

# Singleton model state.
# `loaded_checkpoint` — hozir RAM/VRAM'da turgan fine-tuned model uchun cache:
# {"id": "...", "path": Path, "model": Xtts, "config": XttsConfig}
state = {
    "tts": None,
    "loaded_checkpoint": None,
    "model_kind": "base",     # "base" yoki "finetuned"
    "device": "cpu",
    "model_load_time": None,
}

TRAIN_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "train_log.txt"
PIPELINE_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "pipeline_log.txt"
EXTEND_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "extend_log.txt"


def checkpoint_id_from_path(path: Path) -> str:
    """`xtts_v2_uzbek-May-26-2026_09+53PM-0000000/best_model.pth`
       → `May-26-2026_09+53PM`."""
    parent = path.parent.name
    m = re.search(r"-([A-Z][a-z]+-\d{2}-\d{4}_\d{2}\+\d{2}[AP]M)", parent)
    return m.group(1) if m else parent


def list_all_checkpoints() -> list[dict]:
    """Barcha mavjud fine-tuned checkpoint'larni katalog bilan birga qaytaradi.

    Har bir element: {"id", "name", "path", "size_gb", "mtime", "kind"}
    `kind` = "best" yoki "step" (best_model.pth vs checkpoint_NNNN.pth)
    """
    if not CHECKPOINTS_DIR.exists():
        return []
    items: list[dict] = []
    for path in CHECKPOINTS_DIR.rglob("best_model.pth"):
        items.append({
            "id": checkpoint_id_from_path(path),
            "name": f"{path.parent.name} / {path.name}",
            "path": str(path),
            "size_gb": round(path.stat().st_size / 1e9, 2),
            "mtime": path.stat().st_mtime,
            "kind": "best",
        })
    # Step checkpoint'lar (oraliq holatlar) — alohida, lekin har papka uchun
    # faqat eng yangisini olamiz (juda ko'p bo'lishi mumkin).
    for sub in CHECKPOINTS_DIR.iterdir():
        if not sub.is_dir():
            continue
        steps = list(sub.glob("checkpoint_*.pth"))
        if steps:
            latest = max(steps, key=lambda p: p.stat().st_mtime)
            items.append({
                "id": checkpoint_id_from_path(latest) + "-step",
                "name": f"{latest.parent.name} / {latest.name}",
                "path": str(latest),
                "size_gb": round(latest.stat().st_size / 1e9, 2),
                "mtime": latest.stat().st_mtime,
                "kind": "step",
            })
    # mtime kamayish bo'yicha — eng yangisi tepada
    items.sort(key=lambda x: -x["mtime"])
    return items


def find_latest_finetuned_checkpoint() -> Path | None:
    """Eng so'nggi fine-tuned checkpoint'ni topish.

    Override: NEXTTTS_FINETUNED_CHECKPOINT env var
    """
    env_path = os.environ.get("NEXTTTS_FINETUNED_CHECKPOINT")
    if env_path:
        p = Path(env_path)
        return p if p.exists() else None
    items = list_all_checkpoints()
    if not items:
        return None
    return Path(items[0]["path"])


def resolve_checkpoint(checkpoint_id: Optional[str]) -> Optional[Path]:
    """Berilgan checkpoint_id bo'yicha aniq fayl yo'lini topish.

    Agar id berilmagan bo'lsa, eng yangisini qaytaradi.
    """
    if not checkpoint_id:
        return find_latest_finetuned_checkpoint()
    items = list_all_checkpoints()
    for it in items:
        if it["id"] == checkpoint_id:
            return Path(it["path"])
    return None


def load_checkpoint_into_cache(ckpt_path: Path) -> None:
    """Berilgan checkpoint'ni RAM/VRAM'ga yuklash. Eski model tushiriladi.

    state["loaded_checkpoint"] ni yangilaydi.
    """
    import gc
    import torch
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    # Eski modelni tushirish — VRAM bo'shatish
    if state["loaded_checkpoint"]:
        old = state["loaded_checkpoint"]
        try:
            old["model"].to("cpu")
            del old["model"]
            del old["config"]
        except Exception:
            pass
        state["loaded_checkpoint"] = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    config = XttsConfig()
    config.load_json(str(XTTS_CACHE / "config.json"))
    model = Xtts.init_from_config(config)
    model.load_checkpoint(
        config,
        checkpoint_path=str(ckpt_path),
        vocab_path=str(XTTS_CACHE / "vocab.json"),
        use_deepspeed=False,
    )
    model.to(state["device"])

    state["loaded_checkpoint"] = {
        "id": checkpoint_id_from_path(ckpt_path),
        "path": ckpt_path,
        "model": model,
        "config": config,
    }
    state["model_kind"] = "finetuned"

SUPPORTED_LANGS = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pl": "Polish",
    "tr": "Turkish (o'zbek uchun eng yaqin)",
    "ru": "Russian",
    "nl": "Dutch",
    "cs": "Czech",
    "ar": "Arabic",
    "zh-cn": "Chinese",
    "ja": "Japanese",
    "hu": "Hungarian",
    "ko": "Korean",
    "hi": "Hindi",
}


def load_model():
    """Modelni yuklash: agar fine-tuned checkpoint bo'lsa, uni; aks holda base model.

    NEXTTTS_MMS_ONLY=1 bo'lsa — XTTS yuklanmaydi (yengil rejim, faqat MMS engine).
    Bu training GPU'ni band qilganda MMS'ni CPU'da sinash uchun ishlatiladi.
    """
    t0 = time.time()
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    state["device"] = device

    if os.environ.get("NEXTTTS_MMS_ONLY", "").strip() in ("1", "true", "True"):
        state["model_kind"] = "mms-only"
        state["model_load_time"] = time.time() - t0
        print("⚡ MMS-only rejim — XTTS yuklanmadi (yengil). Faqat /synthesize/mms ishlaydi.")
        return

    ft_path = find_latest_finetuned_checkpoint()
    if ft_path:
        print(f"⏳ Fine-tuned XTTS v2 yuklanmoqda: {ft_path.name}")
        load_checkpoint_into_cache(ft_path)
        print(f"✅ Fine-tuned model yuklandi ({device.upper()})")
    else:
        print("⏳ XTTS v2 base model yuklanmoqda...")
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        state["tts"] = tts
        state["model_kind"] = "base"
        print(f"✅ Base model yuklandi ({device.upper()})")

    state["model_load_time"] = time.time() - t0


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()
    yield


app = FastAPI(
    title="NextTTS API",
    description="O'zbek tilida self-hosted TTS — XTTS v2 voice cloning",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="tr", description="Til kodi (tr — o'zbek uchun)")
    voice: str = Field(default="main", description="Reference voice nomi")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    normalize: bool = Field(
        default=True,
        description="O'zbek matnni turk fonetikasiga moslashtirish (sifat uchun tavsiya)",
    )
    temperature: float = Field(default=0.65, ge=0.1, le=1.5, description="Past = aniqroq, baland = ijodiyroq")
    repetition_penalty: float = Field(default=5.0, ge=1.0, le=20.0)
    top_k: int = Field(default=50, ge=1, le=200)
    top_p: float = Field(default=0.85, ge=0.1, le=1.0)
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Maxsus checkpoint id (masalan 'May-26-2026_09+53PM'). Bo'sh — eng yangisi",
    )


class BuildReferenceRequest(BaseModel):
    voice: str = Field(default="main")
    top: int = Field(default=3, ge=1, le=10)


@app.get("/health")
def health():
    import torch
    loaded = state["loaded_checkpoint"]
    mms_only = state["model_kind"] == "mms-only"
    info = {
        "status": "ok",
        "model_loaded": mms_only or state["tts"] is not None or loaded is not None,
        "model_kind": state["model_kind"],
        "mms": mms_engine.info(),
        "checkpoint": str(loaded["path"]) if loaded else None,
        "checkpoint_id": loaded["id"] if loaded else None,
        "device": state["device"],
        "model_load_time_sec": state["model_load_time"],
    }
    # F5 (Feruza) tabiiy ovoz mikroservisi holati — qisqa timeout, hech qachon health'ni buzmaydi.
    try:
        import requests as _rq
        fr = _rq.get(f"{F5_SERVER_URL}/health", timeout=1.0).json()
        info["f5"] = {"available": bool(fr.get("available")), "checkpoint": fr.get("checkpoint")}
    except Exception:
        info["f5"] = {"available": False, "checkpoint": None}
    if state["device"] == "cuda":
        info["gpu_name"] = torch.cuda.get_device_name(0)
        info["vram_total_gb"] = round(torch.cuda.get_device_properties(0).total_memory / 1e9, 1)
        info["vram_allocated_gb"] = round(torch.cuda.memory_allocated(0) / 1e9, 2)
    return info


@app.get("/checkpoints")
def list_checkpoints():
    """Barcha mavjud fine-tuned checkpoint'lar ro'yxati.

    Frontend Voice Lab sahifasi qaysi versiyani sinab ko'rishni tanlash uchun ishlatadi.
    """
    items = list_all_checkpoints()
    loaded = state["loaded_checkpoint"]
    active_id = loaded["id"] if loaded else None
    return {
        "active": active_id,
        "items": [
            {
                "id": it["id"],
                "name": it["name"],
                "size_gb": it["size_gb"],
                "mtime": it["mtime"],
                "kind": it["kind"],
                "active": it["id"] == active_id,
            }
            for it in items
        ],
    }


@app.get("/samples")
def list_samples():
    """Pre-generated sample audio'lar (offline tayyorlangan) ro'yxati.

    Struktura: tts-server/voices/samples/<checkpoint_id>/<sentence_id>.wav
    Har papkada `_metadata.json` bor — qachon yaratilgan, qaysi matn.
    """
    import json
    if not SAMPLES_DIR.exists():
        return {"checkpoints": [], "sentences": []}

    # Sentences ro'yxati (test_sentences.json'dan)
    sentences_path = PROJECT_ROOT / "tts-server" / "training" / "scripts" / "test_sentences.json"
    sentences = []
    if sentences_path.exists():
        try:
            sentences = json.loads(sentences_path.read_text(encoding="utf-8"))["sentences"]
        except Exception:
            sentences = []

    checkpoints = []
    for sub in sorted(SAMPLES_DIR.iterdir()):
        if not sub.is_dir():
            continue
        meta_path = sub / "_metadata.json"
        meta = {}
        if meta_path.exists():
            try:
                meta = json.loads(meta_path.read_text(encoding="utf-8"))
            except Exception:
                meta = {}
        wavs = sorted(sub.glob("*.wav"))
        samples = []
        for w in wavs:
            samples.append({
                "sentence_id": w.stem,
                "url": f"/samples/audio/{sub.name}/{w.stem}",
                "size_kb": round(w.stat().st_size / 1024, 1),
            })
        checkpoints.append({
            "id": sub.name,
            "generated_at": meta.get("generated_at"),
            "checkpoint_path": meta.get("checkpoint_path"),
            "samples": samples,
        })
    # Eng yangisi tepada
    checkpoints.sort(key=lambda x: x.get("generated_at") or "", reverse=True)
    return {"checkpoints": checkpoints, "sentences": sentences}


@app.get("/samples/audio/{checkpoint_id}/{sentence_id}")
def get_sample_audio(checkpoint_id: str, sentence_id: str):
    """Pre-generated sample WAV'ni serve qilish."""
    # Xavfsizlik — path traversal'dan himoyalanish
    if "/" in checkpoint_id or "\\" in checkpoint_id or ".." in checkpoint_id:
        raise HTTPException(400, "Yaroqsiz checkpoint_id")
    if "/" in sentence_id or "\\" in sentence_id or ".." in sentence_id:
        raise HTTPException(400, "Yaroqsiz sentence_id")
    wav_path = SAMPLES_DIR / checkpoint_id / f"{sentence_id}.wav"
    if not wav_path.exists():
        raise HTTPException(404, "Sample topilmadi")
    return FileResponse(str(wav_path), media_type="audio/wav")


@app.get("/training/status")
def training_status():
    """Hozirgi training jarayoni holati — train_log.txt oxirini parse qilib.

    Frontend Status sahifasi har 10 sekundda so'rab progress ko'rsatadi.
    Uy noutbukidan ham GitHub'dagi STATUS.md (auto-publish) o'rniga shu API ishlatish mumkin.
    """
    def _last_lines(path: Path, n: int = 200) -> list[str]:
        if not path.exists():
            return []
        try:
            with open(path, "rb") as f:
                f.seek(0, 2)
                size = f.tell()
                # 64 KB oxiri yetadi
                f.seek(max(0, size - 65536))
                data = f.read().decode("utf-8", errors="ignore")
                return data.splitlines()[-n:]
        except Exception:
            return []

    train_lines = _last_lines(TRAIN_LOG, 400)
    pipeline_lines = _last_lines(PIPELINE_LOG, 80)
    extend_lines = _last_lines(EXTEND_LOG, 40)

    # Step va loss'ni parse qilish (oxirgi qayd)
    step_pattern = re.compile(r"STEP:\s*(\d+)/(\d+).*GLOBAL_STEP:\s*(\d+)")
    mel_ce_pattern = re.compile(r"loss_mel_ce:\s*([\d.]+)\s*\(([\d.]+)\)")
    loss_pattern = re.compile(r"\| > loss:\s*([\d.]+)\s*\(([\d.]+)\)")
    eval_pattern = re.compile(r"avg_loss_mel_ce:\s*([\d.]+)", re.IGNORECASE)
    epoch_pattern = re.compile(r"EPOCH:\s*(\d+)/(\d+)")
    time_pattern = re.compile(r"TIME:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")

    step = step_max = global_step = None
    epoch = epoch_max = None
    last_loss = last_loss_avg = None
    last_mel_ce = last_mel_ce_avg = None
    last_eval_loss = None
    last_step_time = None

    for line in train_lines:
        m = step_pattern.search(line)
        if m:
            step, step_max, global_step = int(m.group(1)), int(m.group(2)), int(m.group(3))
        m = mel_ce_pattern.search(line)
        if m:
            last_mel_ce, last_mel_ce_avg = float(m.group(1)), float(m.group(2))
        m = loss_pattern.search(line)
        if m:
            last_loss, last_loss_avg = float(m.group(1)), float(m.group(2))
        m = epoch_pattern.search(line)
        if m:
            epoch, epoch_max = int(m.group(1)), int(m.group(2))
        m = time_pattern.search(line)
        if m:
            last_step_time = m.group(1)
        m = eval_pattern.search(line)
        if m:
            last_eval_loss = float(m.group(1))

    # Training jarayoni hali ishlamoqda?
    train_running = False
    if train_lines:
        # Oxirgi STEP yozuvi yaqinda bo'lsa, ishlamoqda deb hisoblaymiz
        train_running = any("STEP:" in ln for ln in train_lines[-30:])

    return {
        "extract": {
            "log_tail": extend_lines[-15:] if extend_lines else [],
            "finished": any("✅ Tugadi" in ln for ln in extend_lines),
        },
        "training": {
            "running": train_running,
            "epoch": epoch,
            "epoch_max": epoch_max,
            "step": step,
            "step_max": step_max,
            "global_step": global_step,
            "progress_pct": round(100 * step / step_max, 1) if step and step_max else None,
            "last_loss": last_loss,
            "last_loss_avg": last_loss_avg,
            "last_mel_ce": last_mel_ce,
            "last_mel_ce_avg": last_mel_ce_avg,
            "last_eval_loss": last_eval_loss,
            "last_step_time": last_step_time,
            "log_tail": train_lines[-25:],
        },
        "pipeline_tail": pipeline_lines[-15:],
        "now": time.strftime("%Y-%m-%d %H:%M:%S"),
    }


@app.get("/voices")
def list_voices():
    voices = []
    for voice_dir in VOICES_DIR.iterdir():
        if voice_dir.is_dir():
            ref = voice_dir / "reference.wav"
            if ref.exists():
                import soundfile as sf
                info = sf.info(str(ref))
                voices.append({
                    "name": voice_dir.name,
                    "reference_path": str(ref.relative_to(PROJECT_ROOT)),
                    "duration_sec": round(info.duration, 2),
                    "sample_rate": info.samplerate,
                })
    return {"voices": voices}


@app.get("/languages")
def list_languages():
    return {"languages": [{"code": c, "name": n} for c, n in SUPPORTED_LANGS.items()]}


@app.post("/synthesize")
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


class MMSSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: Optional[str] = Field(default=None, description="base | erkak | ayol")
    normalize: bool = Field(
        default=True,
        description="O'zbek linguistik normalizatsiya (sonlar, qisqartmalar)",
    )
    speaking_rate: Optional[float] = Field(
        default=None, ge=0.3, le=1.5,
        description="PAST = sekinroq (0.5 ~ tabiiy). Bo'sh — server default.",
    )
    noise_scale_duration: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="PAST = barqarorroq ritm. Bo'sh — server default.",
    )


# F5-TTS (Feruza) — tabiiy/mayin ayol ovozi. Alohida .venv-f5 muhitida 8001-portda
# ishlaydi (torch/transformers versiyalari boshqacha), shu yerdan proxy qilamiz.
F5_SERVER_URL = os.environ.get("F5_SERVER_URL", "http://127.0.0.1:8001")


class F5SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speed: float = Field(default=1.0, ge=0.3, le=2.0)
    # nfe=48: ASR-sweep bilan tanlandi — o'qish aniqligi 28%→18% WER (cfg=2.0 eng yaxshi,
    # oshirish battar; nfe=64 qo'shimcha foyda bermaydi). Sekinroq, lekin tiniqroq.
    nfe_step: int = Field(default=48, ge=8, le=64)
    # F5 reference tanlovi: feruza (#1, tabiiy) | jonli (05, ifodali). f5_server'ga uzatiladi.
    voice: str = Field(default="feruza")


@app.post("/synthesize/f5")
def synthesize_f5(req: F5SynthesizeRequest):
    """F5-TTS (Feruza) tabiiy ayol ovozi — :8001 mikroservisiga proxy.

    Matn normalizatsiyasi F5 serverning o'zida (training bilan AYNAN mos) bajariladi,
    shuning uchun bu yerda matnga tegmaymiz — test_f5.py bilan bir xil natija.
    """
    import requests as _rq

    try:
        r = _rq.post(
            f"{F5_SERVER_URL}/synthesize/f5",
            json={"text": req.text, "speed": req.speed, "nfe_step": req.nfe_step,
                  "voice": req.voice},
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


# Piper-TTS — NATIV o'zbek ovoz (FeruzaSpeech, espeak fonema: x→χ, gʻ→ʁ, ch→tʃ).
# Alohida venv-piper muhitida 8002-portda CPU'da ishlaydi (GPU talab qilmaydi).
PIPER_SERVER_URL = os.environ.get("PIPER_SERVER_URL", "http://127.0.0.1:8002")


class PiperSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    length_scale: float = Field(default=1.0, ge=0.5, le=2.0)
    normalize: bool = Field(
        default=True,
        description="O'zbek linguistik normalizatsiya (sonlar, sana, qisqartmalar)",
    )


@app.post("/synthesize/piper")
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


@app.post("/synthesize/mms")
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


@app.post("/transcribe")
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


@app.post("/reference/build")
def build_reference(req: BuildReferenceRequest):
    """Yangi yozuvlar qoʻshilgandan keyin reference.wav'ni qayta yaratish."""
    from scripts.prepare_reference import load_recorded, compute_quality_score
    import numpy as np
    import soundfile as sf

    voice_dir = VOICES_DIR / req.voice
    voice_dir.mkdir(parents=True, exist_ok=True)
    output_path = voice_dir / "reference.wav"

    recorded = load_recorded()
    candidates = []
    for s in recorded:
        wav_path = PROJECT_ROOT / s["audioPath"]
        if not wav_path.exists():
            continue
        try:
            duration, rms, snr = compute_quality_score(wav_path)
            duration_score = 1.0 - abs(duration - 6.0) / 10.0
            score = duration_score * 0.5 + (snr / 40.0) * 0.5
            candidates.append({
                "id": s["id"],
                "path": wav_path,
                "duration": duration,
                "rms": rms,
                "snr": snr,
                "score": score,
            })
        except Exception:
            pass

    if not candidates:
        raise HTTPException(400, "Yaroqli yozuvlar topilmadi")

    candidates.sort(key=lambda c: -c["score"])
    selected = candidates[: req.top]

    target_sr = 22050
    silence = np.zeros(int(0.3 * target_sr), dtype=np.float32)
    parts = []
    for i, c in enumerate(selected):
        audio, sr = sf.read(str(c["path"]))
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != target_sr:
            import librosa
            audio = librosa.resample(audio.astype(np.float32), orig_sr=sr, target_sr=target_sr)
        audio = audio.astype(np.float32)
        peak = float(np.max(np.abs(audio)))
        if peak > 0:
            audio = audio * (0.707 / peak)
        parts.append(audio)
        if i < len(selected) - 1:
            parts.append(silence)

    combined = np.concatenate(parts)
    sf.write(str(output_path), combined, target_sr, subtype="PCM_16")
    return {
        "voice": req.voice,
        "reference_path": str(output_path.relative_to(PROJECT_ROOT)),
        "duration_sec": len(combined) / target_sr,
        "selected_ids": [c["id"] for c in selected],
    }


@app.get("/")
def root():
    return {
        "name": "NextTTS",
        "version": "0.1.0",
        "endpoints": ["/health", "/voices", "/languages", "/synthesize", "/reference/build"],
    }
