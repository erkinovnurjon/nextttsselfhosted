"""
generate_samples.py
===================

Berilgan checkpoint orqali test sentences uchun WAV fayllar yaratish.
Server'siz, to'g'ridan-to'g'ri XTTS API. GPU kerak.

Foydalanish:
    # Eng so'nggi checkpoint × barcha test sentences
    python training/scripts/generate_samples.py --latest

    # Aniq checkpoint
    python training/scripts/generate_samples.py --checkpoint path/to/best_model.pth

    # Bir necha checkpoint birdaniga
    python training/scripts/generate_samples.py --all-checkpoints

Natija: voices/samples/<version_id>/<sentence_id>.wav
"""

import argparse
import gc
import json
import os
import re
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["COQUI_TOS_AGREED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

TTS_SERVER = PROJECT_ROOT / "tts-server"
VOICES_DIR = TTS_SERVER / "voices"
SAMPLES_DIR = VOICES_DIR / "samples"
CHECKPOINTS_DIR = TTS_SERVER / "training" / "checkpoints" / "xtts_v2_uzbek"
SENTENCES_JSON = TTS_SERVER / "training" / "scripts" / "test_sentences.json"
XTTS_CACHE = Path.home() / "AppData" / "Local" / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"


def pr(*args, **kwargs):
    kwargs.setdefault("flush", True)
    print(*args, **kwargs)


def checkpoint_id_from_path(path: Path) -> str:
    parent = path.parent.name
    m = re.search(r"-([A-Z][a-z]+-\d{2}-\d{4}_\d{2}\+\d{2}[AP]M)", parent)
    return m.group(1) if m else parent


def list_all_checkpoints() -> list[Path]:
    if not CHECKPOINTS_DIR.exists():
        return []
    cps = list(CHECKPOINTS_DIR.rglob("best_model.pth"))
    cps.sort(key=lambda p: p.stat().st_mtime)
    return cps


def find_latest_checkpoint() -> Path | None:
    cps = list_all_checkpoints()
    return cps[-1] if cps else None


def load_test_sentences() -> list[dict]:
    data = json.loads(SENTENCES_JSON.read_text(encoding="utf-8"))
    return data["sentences"]


def normalize_text(text: str) -> str:
    """Linguistik + light fonetik normalizatsiya — training bilan bir xil."""
    from server.linguistic_normalizer import normalize_uzbek_text
    from server.text_normalizer import normalize_uzbek_to_turkish_phonetic
    text = normalize_uzbek_text(text)
    text = normalize_uzbek_to_turkish_phonetic(text, light=True)
    return text


def generate_for_checkpoint(ckpt_path: Path, sentences: list[dict],
                            voice_name: str = "main") -> dict:
    """Bitta checkpoint uchun barcha sentences'lardan WAV yaratish."""
    import torch
    import soundfile as sf
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    cp_id = checkpoint_id_from_path(ckpt_path)
    out_dir = SAMPLES_DIR / cp_id
    out_dir.mkdir(parents=True, exist_ok=True)

    reference = VOICES_DIR / voice_name / "reference.wav"
    if not reference.exists():
        return {"ok": False, "error": f"Reference yo'q: {reference}"}

    device = "cuda" if torch.cuda.is_available() else "cpu"
    pr(f"\n📦 Checkpoint yuklash: {cp_id}")
    t0 = time.time()
    config = XttsConfig()
    config.load_json(str(XTTS_CACHE / "config.json"))
    model = Xtts.init_from_config(config)
    model.load_checkpoint(
        config,
        checkpoint_path=str(ckpt_path),
        vocab_path=str(XTTS_CACHE / "vocab.json"),
        use_deepspeed=False,
    )
    model.to(device)
    pr(f"   ✅ Yuklandi ({time.time()-t0:.1f}s)")

    results = []
    for s in sentences:
        sid = s["id"]
        out_wav = out_dir / f"{sid}.wav"
        if out_wav.exists() and out_wav.stat().st_size > 1000:
            pr(f"   ⏭  {sid} — allaqachon mavjud, o'tkazib yuborildi")
            results.append({"id": sid, "skipped": True})
            continue
        try:
            text_norm = normalize_text(s["text"])
            t1 = time.time()
            out = model.synthesize(
                text_norm,
                config,
                speaker_wav=str(reference),
                gpt_cond_len=3,
                language="tr",
                temperature=0.65,
                repetition_penalty=5.0,
                top_k=50,
                top_p=0.85,
                speed=1.0,
            )
            sf.write(str(out_wav), out["wav"], 24000, subtype="PCM_16")
            dur = len(out["wav"]) / 24000
            elapsed = time.time() - t1
            pr(f"   ✓ {sid} ({dur:.1f}s audio, {elapsed:.1f}s gen): {s['text'][:60]}")
            results.append({
                "id": sid,
                "text": s["text"],
                "text_normalized": text_norm,
                "audio_path": str(out_wav.relative_to(PROJECT_ROOT)),
                "audio_duration": round(dur, 2),
                "generation_time": round(elapsed, 2),
            })
        except Exception as e:
            pr(f"   ✗ {sid} XATO: {e}")
            results.append({"id": sid, "error": str(e)})

    # Metadata yozish
    meta_path = out_dir / "_metadata.json"
    meta = {
        "checkpoint_id": cp_id,
        "checkpoint_path": str(ckpt_path.relative_to(PROJECT_ROOT)),
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "voice": voice_name,
        "samples": results,
    }
    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    pr(f"   📋 Metadata: {meta_path}")

    # VRAM tozalash
    del model, config
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()

    return {"ok": True, "checkpoint_id": cp_id, "out_dir": str(out_dir),
            "count": len([r for r in results if "audio_path" in r])}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--checkpoint", type=str, help="Aniq checkpoint yo'li")
    parser.add_argument("--latest", action="store_true", help="Eng yangi checkpoint")
    parser.add_argument("--all-checkpoints", action="store_true",
                        help="Barcha mavjud checkpoint'lar")
    parser.add_argument("--voice", default="main")
    args = parser.parse_args()

    sentences = load_test_sentences()
    pr(f"📝 {len(sentences)} ta test sentence yuklandi")

    targets: list[Path] = []
    if args.checkpoint:
        p = Path(args.checkpoint)
        if not p.exists():
            sys.exit(f"❌ Checkpoint yo'q: {p}")
        targets = [p]
    elif args.latest:
        latest = find_latest_checkpoint()
        if not latest:
            sys.exit("❌ Checkpoint topilmadi")
        targets = [latest]
    elif args.all_checkpoints:
        targets = list_all_checkpoints()
        pr(f"🗂  {len(targets)} ta checkpoint topildi")
    else:
        sys.exit("Foydalanish: --latest yoki --checkpoint <yoʻl> yoki --all-checkpoints")

    for cp in targets:
        res = generate_for_checkpoint(cp, sentences, args.voice)
        if not res.get("ok"):
            pr(f"⚠️  {cp}: {res.get('error')}")

    pr(f"\n✅ Tugadi. Samples: {SAMPLES_DIR}")


if __name__ == "__main__":
    main()
