"""
mms_synthesize.py
=================

facebook/mms-tts-uzb (Meta MMS) orqali o'zbekcha TTS — fine-tuning'siz, tug'ma o'zbek.
XTTS bilan solishtirish uchun bir xil test_sentences.json jumlalarini ovozlaydi.

Natija: voices/samples/<version_id>/<sentence_id>.wav  (XTTS bilan bir xil format,
        shuning uchun /compare UI avtomatik ko'rsatadi)

Foydalanish:
    # Lotin model (asosiy)
    python scripts/mms_synthesize.py

    # Kirill model (Latin->Cyrillic transliteratsiya bilan)
    python scripts/mms_synthesize.py --script cyrillic

    # Tokenizer vocab'ni tekshirish (qaysi harflar qo'llab-quvvatlanadi)
    python scripts/mms_synthesize.py --inspect
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
sys.stdout.reconfigure(encoding="utf-8")
sys.stderr.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TTS_SERVER = PROJECT_ROOT / "tts-server"
VOICES_DIR = TTS_SERVER / "voices"
SAMPLES_DIR = VOICES_DIR / "samples"
SENTENCES_JSON = TTS_SERVER / "training" / "scripts" / "test_sentences.json"

# Diqqat: MMS o'zbek modeli FAQAT kirill alifbosida mavjud.
# Lotin pipeline uchun Latin->Cyrillic transliteratsiya qilinadi (lat_to_cyr).
MODELS = {
    "cyrillic": "facebook/mms-tts-uzb-script_cyrillic",
}


def pr(*a, **k):
    k.setdefault("flush", True)
    print(*a, **k)


def load_test_sentences():
    data = json.loads(SENTENCES_JSON.read_text(encoding="utf-8"))
    return data["sentences"]


# --- Lotin -> Kirill transliteratsiya (MMS kirill modeli uchun) ---
LAT2CYR = [
    ("oʻ", "ў"), ("gʻ", "ғ"), ("Oʻ", "Ў"), ("Gʻ", "Ғ"),
    ("o'", "ў"), ("g'", "ғ"), ("O'", "Ў"), ("G'", "Ғ"),
    ("sh", "ш"), ("ch", "ч"), ("Sh", "Ш"), ("Ch", "Ч"),
    ("ng", "нг"),
    ("ya", "я"), ("yo", "ё"), ("yu", "ю"), ("ye", "е"),
    ("a", "а"), ("b", "б"), ("d", "д"), ("e", "е"), ("f", "ф"),
    ("g", "г"), ("h", "ҳ"), ("i", "и"), ("j", "ж"), ("k", "к"),
    ("l", "л"), ("m", "м"), ("n", "н"), ("o", "о"), ("p", "п"),
    ("q", "қ"), ("r", "р"), ("s", "с"), ("t", "т"), ("u", "у"),
    ("v", "в"), ("x", "х"), ("y", "й"), ("z", "з"),
    ("'", "ъ"),  # tutuq belgisi: sanʼat -> санъат, maʼno -> маъно
]


def lat_to_cyr(text: str) -> str:
    out = text
    for lat, cyr in LAT2CYR:
        out = out.replace(lat, cyr)
        out = out.replace(lat.upper(), cyr.upper())
    return out


def normalize_for_mms_latin(text: str) -> str:
    """MMS lotin modeli uchun: modifier letter oʻ/gʻ -> oddiy o'/g', kichik harf."""
    text = text.replace("ʻ", "'").replace("ʼ", "'").replace("`", "'")
    return text.lower()


def inspect_tokenizer(script: str):
    from transformers import AutoTokenizer
    tok = AutoTokenizer.from_pretrained(MODELS[script])
    vocab = tok.get_vocab()
    chars = sorted(vocab.keys())
    pr(f"Model: {MODELS[script]}")
    pr(f"Vocab hajmi: {len(chars)}")
    pr("Belgilar: " + " ".join(repr(c) for c in chars))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", choices=["cyrillic"], default="cyrillic")
    ap.add_argument("--inspect", action="store_true")
    ap.add_argument("--model-dir", default="", help="Local fine-tuned VitsModel papkasi (bo'sh = baza MMS)")
    ap.add_argument("--version-id", default="", help="/compare papka nomi (bo'sh = avtomatik)")
    ap.add_argument("--device", default="", help="cpu yoki cuda (bo'sh = avtomatik)")
    ap.add_argument("--noise-scale-duration", type=float, default=None,
                    help="PAST = barqarorroq ritm (default 0.8)")
    ap.add_argument("--speaking-rate", type=float, default=None, help="PAST = sekinroq (default 1.0)")
    ap.add_argument("--noise-scale", type=float, default=None, help="Spektral tasodifiylik (default 0.667)")
    ap.add_argument("--postprocess", type=float, default=0.0,
                    help="Audio yaxshilash kuchi (0 = o'chiq, 1.0 = standart)")
    args = ap.parse_args()

    if args.inspect:
        inspect_tokenizer(args.script)
        return

    import torch
    import soundfile as sf
    from transformers import VitsModel, AutoTokenizer

    model_id = args.model_dir or MODELS[args.script]
    if args.device in ("cpu", "cuda"):
        device = args.device
    else:
        device = "cuda" if torch.cuda.is_available() else "cpu"
    version_id = args.version_id or (f"mms_uzb_{args.script}" if not args.model_dir else "mms_uzb_ft")
    out_dir = SAMPLES_DIR / version_id
    out_dir.mkdir(parents=True, exist_ok=True)

    pr(f"📦 Model yuklash: {model_id}")
    t0 = time.time()
    model = VitsModel.from_pretrained(model_id).to(device)
    tok = AutoTokenizer.from_pretrained(model_id)
    if args.noise_scale_duration is not None:
        model.noise_scale_duration = args.noise_scale_duration
    if args.speaking_rate is not None:
        model.speaking_rate = args.speaking_rate
    if args.noise_scale is not None:
        model.noise_scale = args.noise_scale
    sr = model.config.sampling_rate
    pr(f"   ✅ Yuklandi ({time.time()-t0:.1f}s), sampling_rate={sr}")

    sentences = load_test_sentences()
    pr(f"📝 {len(sentences)} ta test jumla")

    results = []
    for s in sentences:
        sid = s["id"]
        raw = s["text"]
        if args.script == "cyrillic":
            text = lat_to_cyr(normalize_for_mms_latin(raw))
        else:
            text = normalize_for_mms_latin(raw)
        out_wav = out_dir / f"{sid}.wav"
        try:
            inputs = tok(text, return_tensors="pt").to(device)
            t1 = time.time()
            with torch.no_grad():
                wav = model(**inputs).waveform[0].cpu().numpy()
            if args.postprocess > 0:
                sys.path.insert(0, str(TTS_SERVER))
                from server.mms_engine import postprocess
                wav = postprocess(wav, sr, args.postprocess)
            sf.write(str(out_wav), wav, sr, subtype="PCM_16")
            dur = len(wav) / sr
            elapsed = time.time() - t1
            pr(f"   ✓ {sid} ({dur:.1f}s, {elapsed:.1f}s gen) [{text[:50]}]")
            results.append({
                "id": sid,
                "text": raw,
                "text_normalized": text,
                "audio_path": str(out_wav.relative_to(PROJECT_ROOT)),
                "audio_duration": round(dur, 2),
                "generation_time": round(elapsed, 2),
            })
        except Exception as e:
            pr(f"   ✗ {sid} XATO: {e}")
            results.append({"id": sid, "error": str(e)})

    meta = {
        "checkpoint_id": version_id,
        "checkpoint_path": model_id,
        "engine": "mms-vits",
        "generated_at": time.strftime("%Y-%m-%d %H:%M:%S"),
        "voice": f"mms-{args.script}",
        "samples": results,
    }
    (out_dir / "_metadata.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8")
    pr(f"\n✅ Tugadi. Samples: {out_dir}")


if __name__ == "__main__":
    main()
