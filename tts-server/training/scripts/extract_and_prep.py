"""
ISSAI_USC.tar.gz ni ochib, training uchun tayyorlash.

Bosqichlar:
1. tar.gz ni ochish
2. Audio fayllar va metadata strukturasini aniqlash
3. Audio'ni 22050 Hz mono ga aylantirish (XTTS v2 talabi)
4. Filtering: davomiylik 2-11 sek, matn 5-200 belgi
5. LJSpeech format'da metadata yozish
6. Foydalanuvchining 25 ta yozuvini qo'shish (high-priority training samples)

Foydalanish:
    python training/scripts/extract_and_prep.py
    python training/scripts/extract_and_prep.py --max-hours 10  # tezroq trening uchun
    python training/scripts/extract_and_prep.py --skip-extract  # extract o'tkazib yuborish
"""

import argparse
import csv
import json
import os
import shutil
import sys
import tarfile
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRAIN_DIR = PROJECT_ROOT / "tts-server" / "training"
DATA_DIR = TRAIN_DIR / "data"
TAR_PATH = DATA_DIR / "ISSAI_USC.tar.gz"
EXTRACT_DIR = DATA_DIR / "issai_raw"
PROCESSED_DIR = DATA_DIR / "processed_wavs"
METADATA_PATH = DATA_DIR / "metadata.csv"
USER_DATASET = PROJECT_ROOT / "dataset"
USER_SENTENCES_JSON = USER_DATASET / "sentences.json"


def extract_tarball():
    """ISSAI_USC.tar.gz ni ochish."""
    if EXTRACT_DIR.exists() and any(EXTRACT_DIR.iterdir()):
        print(f"✅ Ochilgan ko'rinmoqda: {EXTRACT_DIR}")
        return
    if not TAR_PATH.exists():
        sys.exit(f"❌ Tar fayl topilmadi: {TAR_PATH}\n   Avval: python training/scripts/download_issai.py")
    EXTRACT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"⏳ Ochilmoqda: {TAR_PATH.name} ({TAR_PATH.stat().st_size/1e9:.2f} GB)")
    t0 = time.time()
    with tarfile.open(TAR_PATH, "r:gz") as tar:
        tar.extractall(EXTRACT_DIR)
    print(f"✅ Ochildi ({time.time()-t0:.1f}s)")


def analyze_structure():
    """Ochilgan dataset strukturasini ko'rsatish."""
    print(f"\n📂 Struktura tahlili: {EXTRACT_DIR}")
    for root in sorted(EXTRACT_DIR.iterdir())[:20]:
        if root.is_dir():
            children = list(root.iterdir())[:5]
            print(f"   {root.name}/ ({len(list(root.iterdir()))} item)")
            for c in children:
                print(f"      {c.name}")
        else:
            print(f"   {root.name} ({root.stat().st_size:,} bytes)")


def find_audio_and_metadata():
    """ISSAI USC tipik strukturasi:
       ISSAI_USC/
       ├── Audio/{speaker_id}/{utterance_id}.wav  (yoki .flac)
       └── Transcriptions/{utterance_id}.txt
       Yoki alternativ:
       ├── train/wavs/, train/text
       ├── dev/wavs/, dev/text
       ├── test/wavs/, test/text
    """
    audio_files = list(EXTRACT_DIR.rglob("*.wav")) + list(EXTRACT_DIR.rglob("*.flac"))
    txt_files = list(EXTRACT_DIR.rglob("*.txt"))
    tsv_files = list(EXTRACT_DIR.rglob("*.tsv"))
    csv_files = list(EXTRACT_DIR.rglob("*.csv"))

    print(f"\n📊 Topilgan fayllar:")
    print(f"   Audio (wav/flac): {len(audio_files)}")
    print(f"   TXT fayllar:       {len(txt_files)}")
    print(f"   TSV fayllar:       {len(tsv_files)}")
    print(f"   CSV fayllar:       {len(csv_files)}")

    if audio_files:
        print(f"   Misol audio:  {audio_files[0].relative_to(EXTRACT_DIR)}")
    if tsv_files:
        print(f"   Misol TSV:    {tsv_files[0].relative_to(EXTRACT_DIR)}")
        try:
            with open(tsv_files[0], encoding="utf-8") as f:
                head = [next(f) for _ in range(3)]
            print(f"   TSV boshi:    {head[:3]}")
        except Exception:
            pass
    if txt_files:
        print(f"   Misol TXT:    {txt_files[0].relative_to(EXTRACT_DIR)}")

    return audio_files, txt_files, tsv_files


def load_transcriptions(audio_files, txt_files, tsv_files):
    """Audio fayllarga matnni juftlash."""
    transcriptions = {}  # utterance_id -> text

    # Variant 1: TSV/CSV fayllarda matn (typical Common Voice / ISSAI format)
    for f in tsv_files + [c for c in (DATA_DIR.glob("*.tsv") or [])]:
        try:
            with open(f, encoding="utf-8") as fh:
                # Sniff delimiter
                first_line = fh.readline()
                fh.seek(0)
                delim = "\t" if "\t" in first_line else "|" if "|" in first_line else ","
                reader = csv.DictReader(fh, delimiter=delim)
                for row in reader:
                    # Try common column names
                    text = (row.get("sentence") or row.get("text") or
                            row.get("transcript") or row.get("transcription"))
                    path = (row.get("path") or row.get("file") or
                            row.get("audio_file") or row.get("filename"))
                    if text and path:
                        uid = Path(path).stem
                        transcriptions[uid] = text.strip()
        except Exception as e:
            print(f"   ⚠️  {f.name} o'qib bo'lmadi: {e}")

    # Variant 2: TXT fayllar — har biri bitta audio uchun.
    # ISSAI USC: TXT fayl nomi WAV bilan bir xil, ichida sof matn (bir qator).
    for txt in txt_files:
        try:
            uid = txt.stem
            if uid in transcriptions:
                continue
            content = txt.read_text(encoding="utf-8").strip()
            if not content:
                continue
            # Agar boshida raqam + tab bo'lsa (kashka format), olib tashlaymiz
            if "\t" in content:
                parts = content.split("\t", 1)
                if parts[0].strip().isdigit():
                    content = parts[1].strip()
            transcriptions[uid] = content
        except Exception:
            pass

    print(f"\n📝 Transcriptions topildi: {len(transcriptions)}")
    return transcriptions


def process_dataset(audio_files, transcriptions, max_hours, min_dur, max_dur, target_sr):
    """Audio'ni preprocess qilish va metadata.csv yozish."""
    import soundfile as sf
    import librosa

    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    rows = []
    total_dur = 0.0
    skipped_no_text = skipped_short = skipped_long = skipped_err = 0

    print(f"\n🔧 Preprocess (target_sr={target_sr} Hz, dur={min_dur}-{max_dur}s, max_hours={max_hours})")

    for i, audio_path in enumerate(audio_files):
        if max_hours and total_dur / 3600 >= max_hours:
            print(f"   {max_hours} soatga yetildi, to'xtatildi")
            break

        uid = audio_path.stem
        text = transcriptions.get(uid)
        if not text:
            skipped_no_text += 1
            continue

        try:
            audio, sr = sf.read(str(audio_path))
            if audio.ndim > 1:
                audio = audio.mean(axis=1)
            duration = len(audio) / sr
            if duration < min_dur:
                skipped_short += 1
                continue
            if duration > max_dur:
                skipped_long += 1
                continue
            if sr != target_sr:
                audio = librosa.resample(audio.astype("float32"), orig_sr=sr, target_sr=target_sr)
            out_path = PROCESSED_DIR / f"{uid}.wav"
            sf.write(str(out_path), audio, target_sr, subtype="PCM_16")
            rows.append({
                "audio_file": f"processed_wavs/{uid}.wav",
                "text": text,
                "speaker": "issai",
                "duration": round(duration, 2),
            })
            total_dur += duration
            if (i + 1) % 500 == 0:
                print(f"   {i+1} ta tahlil qilindi, {len(rows)} ta saqlandi, {total_dur/3600:.2f} soat")
        except Exception as e:
            skipped_err += 1
            if skipped_err <= 3:
                print(f"   ⚠️  {uid} xato: {e}")

    print(f"\n📊 Preprocess natijasi:")
    print(f"   Saqlangan:           {len(rows)}")
    print(f"   Matn yo'q:           {skipped_no_text}")
    print(f"   Juda qisqa:          {skipped_short}")
    print(f"   Juda uzun:           {skipped_long}")
    print(f"   Xato:                {skipped_err}")
    print(f"   Jami davomiylik:     {total_dur/3600:.2f} soat ({total_dur:.0f} soniya)")

    return rows


def add_user_recordings(rows):
    """Foydalanuvchining shaxsiy yozuvlarini qo'shish."""
    if not USER_SENTENCES_JSON.exists():
        print("   ⚠️  sentences.json yo'q, foydalanuvchi yozuvlari qo'shilmaydi")
        return rows

    import soundfile as sf
    data = json.loads(USER_SENTENCES_JSON.read_text(encoding="utf-8"))
    user_rows = []
    for s in data:
        if not s.get("audioPath"):
            continue
        wav_path = PROJECT_ROOT / s["audioPath"]
        if not wav_path.exists():
            continue
        try:
            info = sf.info(str(wav_path))
            # Foydalanuvchi audio'sini ham processed_wavs ga ko'chiramiz (bir xil joyda turishi uchun)
            target = PROCESSED_DIR / f"user_{s['id']}.wav"
            shutil.copy2(wav_path, target)
            user_rows.append({
                "audio_file": f"processed_wavs/user_{s['id']}.wav",
                "text": s["text"],
                "speaker": "main",
                "duration": round(info.duration, 2),
            })
        except Exception as e:
            print(f"   ⚠️  user #{s['id']}: {e}")

    print(f"\n👤 Foydalanuvchi yozuvlari qo'shildi: {len(user_rows)}")
    return rows + user_rows


def write_metadata(rows):
    """Coqui format metadata yozish (built-in 'coqui' formatter uchun).

    Format: audio_file|text|speaker_name|emotion_name (header bilan)
    """
    formatted = [
        {
            "audio_file": r["audio_file"],
            "text": r["text"],
            "speaker_name": r["speaker"],
            "emotion_name": "neutral",
        }
        for r in rows
    ]
    with open(METADATA_PATH, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(
            f,
            fieldnames=["audio_file", "text", "speaker_name", "emotion_name"],
            delimiter="|",
        )
        writer.writeheader()
        writer.writerows(formatted)
    print(f"\n💾 Metadata yozildi: {METADATA_PATH}")
    print(f"   Jami satr: {len(formatted)}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-extract", action="store_true", help="Tar ochishni o'tkazib yuborish")
    parser.add_argument("--max-hours", type=float, default=None, help="Maks audio soati (test uchun)")
    parser.add_argument("--min-dur", type=float, default=2.0, help="Min audio davomiyligi (sek)")
    parser.add_argument("--max-dur", type=float, default=11.0, help="Max audio davomiyligi (XTTS limit ~11s)")
    parser.add_argument("--target-sr", type=int, default=22050)
    args = parser.parse_args()

    print("=" * 70)
    print("ISSAI USC + foydalanuvchi yozuvlari → training metadata")
    print("=" * 70)

    if not args.skip_extract:
        extract_tarball()

    analyze_structure()
    audio_files, txt_files, tsv_files = find_audio_and_metadata()
    if not audio_files:
        sys.exit("❌ Audio fayllar topilmadi")

    transcriptions = load_transcriptions(audio_files, txt_files, tsv_files)
    if not transcriptions:
        sys.exit("❌ Transcriptions topilmadi — datasetda matn yo'q")

    rows = process_dataset(
        audio_files, transcriptions,
        max_hours=args.max_hours,
        min_dur=args.min_dur,
        max_dur=args.max_dur,
        target_sr=args.target_sr,
    )
    rows = add_user_recordings(rows)
    write_metadata(rows)

    print("\n👉 Keyingi qadam: python training/scripts/finetune_xtts.py")


if __name__ == "__main__":
    main()
