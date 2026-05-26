"""
Reference audio tayyorlash skripti.

Foydalanuvchining yozilgan WAV fayllaridan eng yaxshilarini tanlab,
ularni birlashtirib XTTS v2 uchun "voice reference" fayl yaratadi.

XTTS v2 6-30 soniyalik toza reference audio talab qiladi.
Biz 12-25 soniyalik diapazonni maqsad qilamiz.

Foydalanish:
    python scripts/prepare_reference.py
    python scripts/prepare_reference.py --top 5 --target-duration 20
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import soundfile as sf

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATASET_DIR = PROJECT_ROOT / "dataset"
SENTENCES_JSON = DATASET_DIR / "sentences.json"
WAVS_DIR = DATASET_DIR / "wavs"
VOICE_DIR = PROJECT_ROOT / "tts-server" / "voices" / "main"


def load_recorded() -> list[dict]:
    if not SENTENCES_JSON.exists():
        sys.exit(f"❌ sentences.json topilmadi: {SENTENCES_JSON}")
    data = json.loads(SENTENCES_JSON.read_text(encoding="utf-8"))
    recorded = [s for s in data if s.get("audioPath")]
    if not recorded:
        sys.exit("❌ Hech qanday yozilgan jumla yo'q. Avval UI orqali yozing.")
    return recorded


def compute_quality_score(wav_path: Path) -> tuple[float, float, float]:
    """Returns (duration, rms, snr_estimate)."""
    audio, sr = sf.read(str(wav_path))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)

    duration = len(audio) / sr
    rms = float(np.sqrt(np.mean(audio**2)))

    # Crude SNR estimate: ratio of central RMS to edge (silence) RMS
    edge = int(0.05 * len(audio))
    edge_rms = float(np.sqrt(np.mean(audio[:edge] ** 2) + np.mean(audio[-edge:] ** 2)) / 2)
    snr = 20 * np.log10(rms / max(edge_rms, 1e-6))

    return duration, rms, snr


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--top", type=int, default=3, help="Nechta eng yaxshi WAV birlashtirilsin")
    parser.add_argument("--target-duration", type=float, default=20.0, help="Maqbul jami davomiylik (soniya)")
    parser.add_argument("--silence-gap", type=float, default=0.3, help="Yozuvlar orasidagi jimlik")
    parser.add_argument("--output", default=str(VOICE_DIR / "reference.wav"), help="Output fayl")
    args = parser.parse_args()

    recorded = load_recorded()
    print(f"📁 {len(recorded)} ta yozilgan jumla topildi\n")

    # Score each recording
    candidates = []
    for s in recorded:
        wav_path = PROJECT_ROOT / s["audioPath"]
        if not wav_path.exists():
            print(f"⚠️  #{s['id']} fayl yo'q: {wav_path}")
            continue
        try:
            duration, rms, snr = compute_quality_score(wav_path)
            # Composite score: prefer 4-8 sec duration, high RMS, high SNR
            duration_score = 1.0 - abs(duration - 6.0) / 10.0
            quality_score = duration_score * 0.5 + (snr / 40.0) * 0.5
            candidates.append({
                "id": s["id"],
                "text": s["text"],
                "path": wav_path,
                "duration": duration,
                "rms": rms,
                "snr": snr,
                "score": quality_score,
            })
        except Exception as e:
            print(f"⚠️  #{s['id']} o'qib bo'lmadi: {e}")

    if not candidates:
        sys.exit("❌ Yaroqli yozuvlar topilmadi")

    # Sort by quality, take top N
    candidates.sort(key=lambda c: -c["score"])
    selected = candidates[: args.top]

    print(f"✅ Top {len(selected)} tanlandi:\n")
    print(f"{'#':<5} {'Davomiy':<10} {'RMS':<8} {'SNR':<8} Matn")
    print("-" * 80)
    for c in selected:
        text_preview = c["text"][:50] + ("…" if len(c["text"]) > 50 else "")
        print(f"#{c['id']:<4} {c['duration']:>6.2f}s   {c['rms']:>6.3f}  {c['snr']:>5.1f}dB  {text_preview}")

    # Load and concatenate
    target_sr = 22050
    silence = np.zeros(int(args.silence_gap * target_sr), dtype=np.float32)
    parts = []
    for i, c in enumerate(selected):
        audio, sr = sf.read(str(c["path"]))
        if audio.ndim > 1:
            audio = audio.mean(axis=1)
        if sr != target_sr:
            # Simple resampling via librosa if needed
            import librosa
            audio = librosa.resample(audio.astype(np.float32), orig_sr=sr, target_sr=target_sr)
        audio = audio.astype(np.float32)
        # Normalize each clip to -3 dB peak
        peak = float(np.max(np.abs(audio)))
        if peak > 0:
            audio = audio * (0.707 / peak)
        parts.append(audio)
        if i < len(selected) - 1:
            parts.append(silence)

    combined = np.concatenate(parts)
    total_duration = len(combined) / target_sr

    output_path = Path(args.output)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(output_path), combined, target_sr, subtype="PCM_16")

    print(f"\n🎤 Reference yaratildi:")
    print(f"   Fayl:       {output_path}")
    print(f"   Davomiylik: {total_duration:.2f} soniya")
    print(f"   Sample rate: {target_sr} Hz, mono, 16-bit PCM")

    if total_duration < 6:
        print("\n⚠️  6 soniyadan kam — ko'proq yozuv yozish tavsiya etiladi")
    elif total_duration > 30:
        print("\n⚠️  30 soniyadan ko'p — XTTS v2 ko'p kontekst ishlatmaydi, --top kamroq qiling")
    else:
        print("\n✅ Davomiylik XTTS v2 uchun ideal (6-30 soniya)")


if __name__ == "__main__":
    main()
