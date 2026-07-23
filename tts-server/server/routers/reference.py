"""Reference voice yaratish endpointi.

POST /reference/build → yangi yozuvlardan reference.wav'ni qayta yaratish
(eng sifatli kliplarni tanlab, normalizatsiya qilib, birlashtirib).
"""

from fastapi import APIRouter, HTTPException

from server.config import PROJECT_ROOT, VOICES_DIR
from server.schemas import BuildReferenceRequest

router = APIRouter()


@router.post("/reference/build")
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
