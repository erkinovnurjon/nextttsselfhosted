"""Meta endpointlar — server holati, ovozlar, tillar, checkpoint'lar, sample'lar.

GET /              → API haqida qisqa ma'lumot
GET /health        → status, model_loaded, device, vram, mms/f5 mikroservis holati
GET /checkpoints   → fine-tuned checkpoint'lar ro'yxati (Voice Lab tanlovi uchun)
GET /samples       → oldindan tayyorlangan sample audio'lar
GET /samples/audio/{checkpoint_id}/{sentence_id} → sample WAV'ni serve qilish
GET /voices        → mavjud reference voicelar
GET /languages     → qo'llab-quvvatlanadigan tillar
"""

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from server.config import (
    PROJECT_ROOT,
    VOICES_DIR,
    SAMPLES_DIR,
    SUPPORTED_LANGS,
    F5_SERVER_URL,
)
from server.state import state
from server.model_loader import list_all_checkpoints
from server import mms_engine

router = APIRouter()


@router.get("/health")
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


@router.get("/checkpoints")
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


@router.get("/samples")
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


@router.get("/samples/audio/{checkpoint_id}/{sentence_id}")
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


@router.get("/voices")
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


@router.get("/languages")
def list_languages():
    return {"languages": [{"code": c, "name": n} for c, n in SUPPORTED_LANGS.items()]}


@router.get("/")
def root():
    return {
        "name": "NextTTS",
        "version": "0.1.0",
        "endpoints": ["/health", "/voices", "/languages", "/synthesize", "/reference/build"],
    }
