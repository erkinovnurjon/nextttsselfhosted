"""
build_mms_multispk_hf.py
========================

MMS (facebook/mms-tts-uzb-script_cyrillic) ko'p-spikerli fine-tune uchun ~Nh
dataset quradi — TO'G'RIDAN HF DatasetDict (wav NUSXALANMAYDI, disk tejaladi:
ISSAI'dagi asl yo'llarga ishora qiladi; save_to_disk arrow'ga audio baytlarni embed qiladi).

Manba: issai_raw/ISSAI_USC/train/*.wav (+ yondosh .txt latin transkript).
Amal: spikerlar bo'yicha BALANSLAB (har spikerdan eng ko'pi --per-speaker) klip yig'adi
      → normalize + Latin→Cyrillic → dur 1..14s filtr → --hours ga yetguncha.

Foydalanish (.venv):
    PYTHONUTF8=1 .venv/Scripts/python.exe training/scripts/build_mms_multispk_hf.py \
        --hours 40 --per-speaker 60 --out training/data/mms_ft/uzb_multispk40_hf
"""
import argparse, os, sys, random
from collections import defaultdict
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TTS = PROJECT_ROOT / "tts-server"
sys.path.insert(0, str(TTS))
TRAIN = TTS / "training" / "data" / "issai_raw" / "ISSAI_USC" / "train"

MIN_SEC, MAX_SEC, MIN_CHARS = 1.0, 14.0, 5


def pr(*a, **k):
    k.setdefault("flush", True)
    print(*a, **k)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--hours", type=float, default=40.0, help="nishon jami soat")
    ap.add_argument("--per-speaker", type=int, default=60, help="har spikerdan max klip (balans)")
    ap.add_argument("--out", required=True, help="HF dataset chiqish papkasi")
    ap.add_argument("--src", default=str(TRAIN))
    args = ap.parse_args()

    import soundfile as sf
    from datasets import Dataset, DatasetDict, Audio
    from server.mms_engine import latin_to_cyrillic
    from server.linguistic_normalizer import normalize_uzbek_text

    src = Path(args.src)
    by_spk = defaultdict(list)
    for w in src.glob("*.wav"):
        by_spk[w.name.split("_")[0]].append(w)
    spks = sorted(by_spk)
    rnd = random.Random(123)
    for s in spks:
        by_spk[s].sort()
        rnd.shuffle(by_spk[s])
    pr(f"📂 {len(spks)} spiker, {sum(len(v) for v in by_spk.values())} wav")

    target = args.hours * 3600
    paths, texts = [], []
    total = 0.0
    spk_count = defaultdict(int)
    idx = defaultdict(int)
    active = list(spks)

    while active and total < target:
        for s in list(active):
            if total >= target:
                break
            if spk_count[s] >= args.per_speaker:
                active.remove(s)
                continue
            i = idx[s]
            idx[s] += 1
            if i >= len(by_spk[s]):
                active.remove(s)
                continue
            w = by_spk[s][i]
            txt = w.with_suffix(".txt")
            if not txt.exists():
                continue
            latin = txt.read_text(encoding="utf-8").strip()
            if len(latin) < MIN_CHARS:
                continue
            try:
                info = sf.info(str(w))
                dur = info.frames / info.samplerate
            except Exception:
                continue
            if dur < MIN_SEC or dur > MAX_SEC:
                continue
            cyr = latin_to_cyrillic(normalize_uzbek_text(latin)).strip()
            if len(cyr) < MIN_CHARS:
                continue
            paths.append(str(w.resolve()))
            texts.append(cyr)
            total += dur
            spk_count[s] += 1
        if len(paths) % 2000 < len(spks):  # davriy progress
            pr(f"   … {len(paths)} klip, {total/3600:.2f}h")

    used_spk = len([s for s in spk_count if spk_count[s] > 0])
    pr(f"\n✅ {len(paths)} klip, {total/3600:.2f} soat, {used_spk} spiker")
    pr(f"   namuna: {texts[0][:70]}")

    ds = Dataset.from_dict({"audio": paths, "text": texts}).cast_column(
        "audio", Audio(sampling_rate=16000))
    DatasetDict({"train": ds}).save_to_disk(args.out)
    pr(f"💾 saqlandi: {args.out}")


if __name__ == "__main__":
    main()
