"""
extend_dataset_phonetic.py
==========================

Joriy metadata.csv (~10h) ni ISSAI raw datasidan **fonetik balansli** sample'lar
bilan kengaytirish. Maqsad: x va gʻ harflarining datasetdagi ulushini oshirish,
chunki XTTS v2 base modeli ularni turkcha aksent bilan o'qiydi (q, oʻ ham
kamroq darajada).

Strategiya:
    1. Mavjud metadata.csv dan foydalanilgan sample ID larni o'qish.
    2. ISSAI train/dev dan barcha mavjud bo'lmagan TXT+WAV juftlarini topish.
    3. Har bir transcription ni "rarity score" bilan baholash:
         x harf  → +5
         gʻ harf → +4
         q harf  → +1
         oʻ harf → +1
    4. Davomiylik (2-11s) va matn uzunligi (5-200) bo'yicha filterlash.
    5. Score yuqori sample'larni birinchi olib, target soatga yetguncha qo'shish.
    6. Audio'ni 22050 Hz mono ga aylantirib `processed_wavs/` ga yozish.
    7. Linguistik + light fonetik normalizatsiya qo'llab, metadata.csv ga append.

Foydalanish:
    python training/scripts/extend_dataset_phonetic.py --target-hours 20
    python training/scripts/extend_dataset_phonetic.py --target-hours 30 --workers 4
"""

import argparse
import csv
import os
import random
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

TRAIN_DIR = PROJECT_ROOT / "tts-server" / "training"
DATA_DIR = TRAIN_DIR / "data"
EXTRACT_DIR = DATA_DIR / "issai_raw" / "ISSAI_USC"
PROCESSED_DIR = DATA_DIR / "processed_wavs"
METADATA_PATH = DATA_DIR / "metadata.csv"

def pr(*args, **kwargs):
    """Unbuffered print — Windows pipe orqali ham real-time chiqishi uchun."""
    kwargs.setdefault("flush", True)
    print(*args, **kwargs)


MIN_DUR = 2.0
MAX_DUR = 11.0
MIN_TEXT_LEN = 5
MAX_TEXT_LEN = 200
TARGET_SR = 22050


def read_existing_ids() -> set:
    """metadata.csv dagi mavjud sample ID larini qaytarish."""
    ids = set()
    if not METADATA_PATH.exists():
        return ids
    with open(METADATA_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="|")
        for row in reader:
            ids.add(Path(row["audio_file"]).stem)
    return ids


def load_candidate_pairs(existing_ids: set) -> list:
    """Mavjud bo'lmagan WAV + TXT juftlarini topish."""
    candidates = []
    for split in ("train", "dev"):
        split_dir = EXTRACT_DIR / split
        if not split_dir.exists():
            continue
        for wav_path in split_dir.glob("*.wav"):
            uid = wav_path.stem
            if uid in existing_ids:
                continue
            txt_path = wav_path.with_suffix(".txt")
            if not txt_path.exists():
                continue
            candidates.append((wav_path, txt_path))
    return candidates


def read_transcription(txt_path: Path) -> str | None:
    """ISSAI TXT formati: bitta qator sof o'zbek matn."""
    try:
        text = txt_path.read_text(encoding="utf-8").strip()
    except Exception:
        return None
    # Ba'zilarida boshida "raqam\t" bo'lishi mumkin
    if "\t" in text:
        head, rest = text.split("\t", 1)
        if head.strip().isdigit():
            text = rest.strip()
    if not (MIN_TEXT_LEN <= len(text) <= MAX_TEXT_LEN):
        return None
    return text


def rarity_score(text: str) -> int:
    """Qancha kam uchraydigan o'zbek harflar matnda bor — shuncha yuqori score."""
    t = text.lower()
    score = 0
    # ISSAI metadata ʻ (U+02BB) ishlatadi, foydalanuvchi ' ham yozishi mumkin.
    if "x" in t:
        score += 5
    if "gʻ" in t or "g'" in t:
        score += 4
    if "q" in t:
        score += 1
    if "oʻ" in t or "o'" in t:
        score += 1
    return score


def quick_audio_duration(wav_path: Path) -> float | None:
    """Soundfile orqali tez davomiylik o'qish (audio ma'lumotni dekod qilmasdan)."""
    import soundfile as sf
    try:
        info = sf.info(str(wav_path))
        return info.duration
    except Exception:
        return None


def process_and_write(wav_path: Path, target_path: Path) -> float | None:
    """Audio'ni 22050 Hz mono ga aylantirib yozish. Davomiylikni qaytaradi."""
    import soundfile as sf
    import librosa
    try:
        audio, sr = sf.read(str(wav_path))
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        duration = len(audio) / sr
        if not (MIN_DUR <= duration <= MAX_DUR):
            return None
        if sr != TARGET_SR:
            audio = librosa.resample(audio.astype("float32"), orig_sr=sr, target_sr=TARGET_SR)
        sf.write(str(target_path), audio, TARGET_SR, subtype="PCM_16")
        return duration
    except Exception:
        return None


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--target-hours", type=float, default=20.0,
                        help="Yangi qo'shiladigan audio soatlari (mavjud 10h ga qo'shimcha)")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--dry-run", action="store_true",
                        help="Faqat tahlil qil, fayllarni yozma")
    args = parser.parse_args()

    random.seed(args.seed)

    pr("=" * 70)
    pr("ISSAI dataset — fonetik balansli kengaytirish")
    pr("=" * 70)

    # 1. Mavjud sample'larni o'qish
    existing_ids = read_existing_ids()
    pr(f"\n📋 Mavjud sample'lar: {len(existing_ids)}")

    # 2. Nomzod (WAV+TXT) juftlarini topish
    pr("⏳ Nomzod juftlarni izlash...")
    pairs = load_candidate_pairs(existing_ids)
    pr(f"   Topildi: {len(pairs)} ta yangi juft")

    # 3. Transcription va score
    pr("⏳ Matn o'qish va score hisoblash...")
    scored = []
    t0 = time.time()
    for i, (wav_path, txt_path) in enumerate(pairs):
        if (i + 1) % 10000 == 0:
            pr(f"   {i+1}/{len(pairs)} ({time.time()-t0:.0f}s)")
        text = read_transcription(txt_path)
        if not text:
            continue
        s = rarity_score(text)
        if s == 0:
            # Hech qaysi muammoli harf yo'q — quyi prioritet, faqat target oxirida olamiz
            continue
        scored.append((s, wav_path, text))

    pr(f"   Foydali (score > 0): {len(scored)}")
    pr(f"   Score taqsimoti:")
    from collections import Counter
    score_dist = Counter(s for s, _, _ in scored)
    for s in sorted(score_dist.keys(), reverse=True):
        pr(f"      score={s}: {score_dist[s]} sample")

    # 4. Tartiblash — yuqori score birinchi, ichida random
    scored.sort(key=lambda t: (-t[0], random.random()))

    if args.dry_run:
        # Top 10 ni ko'rsatamiz
        pr("\n📝 TOP 10 (dry-run):")
        for s, wav, text in scored[:10]:
            pr(f"   [score={s}] {wav.name}: {text[:80]}")
        return

    # 5. Linguistik + fonetik normalizatsiya importlari
    from server.linguistic_normalizer import normalize_uzbek_text
    from server.text_normalizer import normalize_uzbek_to_turkish_phonetic

    def normalize(text: str) -> str:
        return normalize_uzbek_to_turkish_phonetic(normalize_uzbek_text(text), light=True)

    # 6. Audio'ni yozish va metadata yig'ish
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)

    new_rows = []
    total_dur = 0.0
    target_sec = args.target_hours * 3600
    processed = 0
    failed = 0
    pr(f"\n🔧 Audio konvert qilish (maqsad: {args.target_hours} soat)...")
    t0 = time.time()

    for s, wav_path, text in scored:
        if total_dur >= target_sec:
            pr(f"   ✅ Maqsadga yetildi: {total_dur/3600:.2f} soat")
            break

        uid = wav_path.stem
        target_wav = PROCESSED_DIR / f"{uid}.wav"
        duration = process_and_write(wav_path, target_wav)
        if duration is None:
            failed += 1
            continue

        norm_text = normalize(text)
        new_rows.append({
            "audio_file": f"processed_wavs/{uid}.wav",
            "text": norm_text,
            "speaker_name": "issai",
            "emotion_name": "neutral",
        })
        total_dur += duration
        processed += 1

        if processed % 500 == 0:
            elapsed = time.time() - t0
            rate = processed / elapsed if elapsed > 0 else 0
            eta = (target_sec - total_dur) / 3600 / (rate * 5 / 3600) if rate > 0 else 0
            pr(f"   {processed} ta saqlandi, {total_dur/3600:.2f}h, "
                  f"{rate:.1f} sample/s, ~{eta:.0f} min qoldi")

    pr(f"\n📊 Konvert natijasi:")
    pr(f"   Yangi sample: {processed}")
    pr(f"   Xatolar:      {failed}")
    pr(f"   Yangi soat:   {total_dur/3600:.2f}")

    # 7. metadata.csv ga append qilish
    pr(f"\n💾 metadata.csv ga qo'shish...")
    existing_rows = []
    with open(METADATA_PATH, encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter="|")
        fields = reader.fieldnames
        for row in reader:
            existing_rows.append(row)

    # Backup
    backup_path = METADATA_PATH.with_suffix(".csv.bak")
    if not backup_path.exists():
        import shutil
        shutil.copy2(METADATA_PATH, backup_path)
        pr(f"   Backup: {backup_path.name}")

    all_rows = existing_rows + new_rows
    # Aralashtirish (shuffle) — har epoch boshida tartib qarama-qarshi
    random.shuffle(all_rows)

    with open(METADATA_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields, delimiter="|")
        writer.writeheader()
        writer.writerows(all_rows)

    pr(f"   Eski: {len(existing_rows)} | Yangi: {len(new_rows)} | Jami: {len(all_rows)}")
    pr(f"\n✅ Tugadi. Endi training: python training/scripts/finetune_xtts.py "
          f"--resume-from <last_best_model.pth> --epochs 3 --lr 2e-6")


if __name__ == "__main__":
    main()
