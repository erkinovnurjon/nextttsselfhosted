"""
Mediada (video/audio/URL) NECHTA ODAM gapirganini aniqlash (ovoz tonidan).

Usul (extract_voice.py bilan bir xil poydevor):
    manba -> [yt-dlp] -> ffmpeg(wav) -> [demucs] -> Silero VAD (nutq bo'laklari)
      -> resemblyzer embedding (har bo'lak "ovoz toni" vektori)
      -> klasterlash (kosinus >= 0.65 = bitta odam) -> har gapiruvchi ulushi

Foydalanish:
    python scripts/count_speakers.py --source "<url-yoki-fayl>"
    python scripts/count_speakers.py --source video.mp4 --no-demucs   # toza nutq bo'lsa

Chiqish: JSON — n_speakers + har birining gapirgan vaqti/ulushi.
Eslatma: bu TAXMIN — juda o'xshash ovozlar qo'shilib, bitta odamning keskin
farqli ohanglari bo'linib ketishi mumkin (kalibrlangan chegara 0.65).
"""

import argparse
import json
import sys
import tempfile
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))
from extract_voice import (  # noqa: E402
    download_if_url,
    to_wav,
    isolate_vocals,
    _get_vad,
    _get_voice_encoder,
)

SIM_THR = 0.65      # _group_by_speaker bilan bir xil kalibratsiya
MIN_EMB_S = 1.0     # 1s'dan qisqa bo'lak embedding uchun ishonchsiz
MIN_SPEAKER_S = 2.0 # jami 2s'dan kam gapirgan "gapiruvchi" = shovqin deb tashlanadi


def count_speakers(source: str, use_demucs: bool = True) -> dict:
    import torch
    import soundfile as sf
    from silero_vad import get_speech_timestamps

    with tempfile.TemporaryDirectory(prefix="spkcount_") as td:
        workdir = Path(td)
        media = download_if_url(source, workdir)
        wav = to_wav(media, workdir)
        voice_src = isolate_vocals(wav, workdir) if use_demucs else wav

        audio, sr = sf.read(str(voice_src))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)

    if sr != 16000:
        import librosa
        audio = librosa.resample(audio, orig_sr=sr, target_sr=16000)
        sr = 16000

    ts = get_speech_timestamps(
        torch.from_numpy(audio).float(), _get_vad(),
        sampling_rate=sr, return_seconds=True,
        min_speech_duration_ms=250, min_silence_duration_ms=120,
    )
    total_speech = float(sum(t["end"] - t["start"] for t in ts))
    if total_speech < 1.0:
        return {"n_speakers": 0, "speech_total": round(total_speech, 1),
                "speakers": [], "note": "Nutq deyarli topilmadi (musiqa/jim manba)."}

    # ── Har nutq bo'lagi uchun ovoz-embedding ──
    enc = _get_voice_encoder()
    embs, kept = [], []
    for t in ts:
        s, e = t["start"], t["end"]
        if (e - s) < MIN_EMB_S:
            continue
        clip = audio[int(s * sr): int(e * sr)]
        peak = float(np.max(np.abs(clip))) if len(clip) else 0.0
        if peak <= 0:
            continue
        try:
            embs.append(enc.embed_utterance(clip * (0.95 / peak)))
            kept.append((s, e))
        except Exception:
            continue

    if len(embs) == 0:
        return {"n_speakers": 1 if total_speech >= 1.0 else 0,
                "speech_total": round(total_speech, 1), "speakers": [],
                "note": "Bo'laklar juda qisqa — aniq ajratib bo'lmadi."}

    E = np.asarray(embs, dtype=np.float64)
    E /= (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
    sim = E @ E.T
    same = sim >= SIM_THR
    dur = np.asarray([e - s for (s, e) in kept])

    # ── Klasterlash: "anchor = eng ko'p qo'llab-quvvatlash", sentroid tozalash ──
    # (extract_voice._group_by_speaker bilan bir xil yondashuv, barcha klasterlar uchun)
    assigned = np.zeros(len(kept), dtype=bool)
    clusters: list[np.ndarray] = []
    while not assigned.all():
        rest = ~assigned
        support = (same & rest) @ (dur * rest)
        support[assigned] = -1
        anchor = int(np.argmax(support))
        sel = same[anchor] & rest
        for _ in range(2):
            centroid = E[sel].mean(axis=0)
            centroid /= (np.linalg.norm(centroid) + 1e-9)
            new_sel = ((E @ centroid) >= SIM_THR) & rest
            if new_sel.sum() == 0:
                break
            sel = new_sel
        if sel.sum() == 0:
            sel = np.zeros(len(kept), dtype=bool)
            sel[anchor] = True
        clusters.append(sel)
        assigned |= sel

    speakers = []
    for sel in clusters:
        d = float(dur[sel].sum())
        if d < MIN_SPEAKER_S:
            continue  # juda qisqa klaster — shovqin/xato bo'lishi mumkin
        speakers.append({
            "speech_sec": round(d, 1),
            "share_pct": round(100 * d / max(total_speech, 1e-6), 1),
            "segments": int(sel.sum()),
        })
    speakers.sort(key=lambda s: -s["speech_sec"])
    for i, s in enumerate(speakers):
        s["speaker"] = i + 1

    return {
        "n_speakers": len(speakers),
        "speech_total": round(total_speech, 1),
        "speakers": speakers,
    }


def main():
    ap = argparse.ArgumentParser(description="Mediada nechta odam gapirganini aniqlash")
    ap.add_argument("--source", required=True, help="URL yoki video/audio fayl yo'li")
    ap.add_argument("--no-demucs", action="store_true",
                    help="Demucs'siz (manba allaqachon toza nutq)")
    args = ap.parse_args()
    result = count_speakers(args.source, use_demucs=not args.no_demucs)
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
