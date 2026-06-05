"""
prepare_mms_dataset.py
======================

MMS (facebook/mms-tts-uzb-script_cyrillic) fine-tune uchun bitta-spikerli
o'zbek datasetni tayyorlaydi.

Manba: ISSAI USC raw (Latin transkript, 16kHz mono wav).
Amal:  bitta spikerni ajratish → transkriptni normalizatsiya + Latin→Cyrillic
       → audio uzunligini filtrlash → HF audiofolder formatida saqlash.

Natija:
    training/data/mms_ft/<dataset_name>/
        wavs/*.wav
        metadata.csv        (ustunlar: file_name,text)

Foydalanish:
    python training/scripts/prepare_mms_dataset.py --speaker 1459541555
    python training/scripts/prepare_mms_dataset.py --speaker 1459541555 --max 0   # cheklovsiz
"""

import argparse
import csv
import os
import shutil
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TTS_SERVER = PROJECT_ROOT / "tts-server"
sys.path.insert(0, str(TTS_SERVER))

USC_TRAIN = TTS_SERVER / "training" / "data" / "issai_raw" / "ISSAI_USC" / "train"
OUT_ROOT = TTS_SERVER / "training" / "data" / "mms_ft"

MIN_SEC = 1.0
MAX_SEC = 14.0
MIN_CHARS = 5


def pr(*a, **k):
    k.setdefault("flush", True)
    print(*a, **k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--speaker", required=True, help="USC spiker id (fayl prefiksi)")
    ap.add_argument("--max", type=int, default=0,
                    help="Maksimal yozuv soni (0 = cheklovsiz)")
    ap.add_argument("--src", default=str(USC_TRAIN), help="Manba papka")
    args = ap.parse_args()

    import soundfile as sf
    from server.mms_engine import latin_to_cyrillic
    from server.linguistic_normalizer import normalize_uzbek_text

    src = Path(args.src)
    name = f"uzb_spk{args.speaker}"
    out_dir = OUT_ROOT / name
    wav_dir = out_dir / "wavs"
    wav_dir.mkdir(parents=True, exist_ok=True)

    wavs = sorted(src.glob(f"{args.speaker}_*.wav"))
    if args.max:
        wavs = wavs[: args.max]
    pr(f"📂 {len(wavs)} ta wav topildi (spiker {args.speaker})")

    rows = []
    total_sec = 0.0
    skipped = {"no_txt": 0, "empty": 0, "dur": 0, "translit": 0}

    for i, wav in enumerate(wavs):
        txt = wav.with_suffix(".txt")
        if not txt.exists():
            skipped["no_txt"] += 1
            continue
        latin = txt.read_text(encoding="utf-8").strip()
        if len(latin) < MIN_CHARS:
            skipped["empty"] += 1
            continue
        try:
            info = sf.info(str(wav))
            dur = info.frames / info.samplerate
        except Exception:
            skipped["dur"] += 1
            continue
        if dur < MIN_SEC or dur > MAX_SEC:
            skipped["dur"] += 1
            continue

        norm = normalize_uzbek_text(latin)
        cyr = latin_to_cyrillic(norm).strip()
        if len(cyr) < MIN_CHARS:
            skipped["translit"] += 1
            continue

        dst_name = wav.name
        shutil.copy2(str(wav), str(wav_dir / dst_name))
        rows.append((f"wavs/{dst_name}", cyr))
        total_sec += dur
        if (i + 1) % 500 == 0:
            pr(f"   … {i+1}/{len(wavs)} ishlandi")

    meta = out_dir / "metadata.csv"
    with open(meta, "w", encoding="utf-8", newline="") as f:
        w = csv.writer(f)
        w.writerow(["file_name", "text"])
        w.writerows(rows)

    pr(f"\n✅ Tayyor: {out_dir}")
    pr(f"   yozuvlar: {len(rows)}")
    pr(f"   jami audio: {total_sec/3600:.2f} soat ({total_sec/60:.1f} daqiqa)")
    pr(f"   o'tkazib yuborilgan: {skipped}")
    pr(f"   metadata: {meta}")
    if rows:
        pr(f"   namuna matn: {rows[0][1][:80]}")


if __name__ == "__main__":
    main()
