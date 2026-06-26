"""
Ixtiyoriy mediadan (video / audio / URL) klonlash uchun toza ovoz reference ajratish.

Pipeline:
    manba (URL yoki fayl)
      -> yt-dlp     (URL bo'lsa yuklab olish)
      -> ffmpeg     (audio -> 44.1k mono wav)
      -> demucs     (ovozni musiqa/fondan ajratish: vocals stem)
      -> segment    (VAD + sifat bahosi bo'yicha eng toza 6-15s bo'lak)
      -> reference  (24k mono wav, F5/CosyVoice zero-shot uchun)

Reference matni (ref_text) alohida — main server /transcribe (Whisper) orqali olinadi.

Foydalanish:
    python scripts/extract_voice.py --source "<url-yoki-fayl>" --out voices/clone_x.wav
    python scripts/extract_voice.py --source video.mp4 --out r.wav --no-demucs   # toza nutq bo'lsa
"""

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.parse
from pathlib import Path

import numpy as np
import soundfile as sf

PROJECT_ROOT = Path(__file__).resolve().parents[2]
TTS_SERVER = Path(__file__).resolve().parents[1]


# ───────────────────────── tashqi vositalarni topish ─────────────────────────

def _find_bin(name: str, env_var: str) -> str:
    """PATH'dan yoki keng tarqalgan joylardan binar topadi (Windows winget ham)."""
    override = os.environ.get(env_var)
    if override and Path(override).exists():
        return override
    found = shutil.which(name)
    if found:
        return found
    # winget ffmpeg odatda PATH'ga keyin tushadi — keng tarqalgan joylarni qidiramiz
    candidates = []
    if name == "ffmpeg":
        base = Path(os.environ.get("LOCALAPPDATA", "")) / "Microsoft" / "WinGet" / "Packages"
        if base.exists():
            candidates += list(base.glob("Gyan.FFmpeg*/**/bin/ffmpeg.exe"))
    for c in candidates:
        if c.exists():
            return str(c)
    raise FileNotFoundError(
        f"{name} topilmadi. PATH'ga qo'shing yoki {env_var} env bilan to'liq yo'lni bering."
    )


# ───────────────────────────── bosqichlar ─────────────────────────────

def _clean_subprocess_env() -> dict:
    """
    Bola python jarayoni (yt-dlp) uchun xavfsiz env.

    F5/torch determinizm uchun ish vaqtida `PYTHONHASHSEED` ni YAROQSIZ qiymatga
    (masalan bo'sh "") o'rnatishi mumkin — bu yt-dlp subprocess'ini ishga tushishida
    "Fatal Python error: PYTHONHASHSEED must be ..." bilan crash qiladi. Yaroqsiz
    bo'lsa olib tashlaymiz (yt-dlp determinizmga muhtoj emas).
    """
    env = os.environ.copy()
    hs = env.get("PYTHONHASHSEED")
    if hs is not None:
        valid = hs == "random" or (hs.isdigit() and 0 <= int(hs) <= 4294967295)
        if not valid:
            env.pop("PYTHONHASHSEED", None)
    return env


def _clean_media_url(url: str) -> str:
    """
    YouTube havolasidan playlist/kuzatuv parametrlarini olib tashlaydi.

    `youtu.be/{id}?list=...` yoki `watch?v={id}&list=...` -> `watch?v={id}`.
    --no-playlist buni hal qilsa-da, toza URL chekka holatlarni (radio/mix RD...)
    oldini oladi. YouTube bo'lmasa URL o'zgarmaydi.
    """
    try:
        u = urllib.parse.urlparse(url)
        host = u.netloc.lower()
        vid = None
        if "youtu.be" in host:
            vid = u.path.lstrip("/").split("/")[0]
        elif "youtube.com" in host:
            qs = urllib.parse.parse_qs(u.query)
            vid = (qs.get("v") or [None])[0]
            if not vid and "/shorts/" in u.path:
                vid = u.path.split("/shorts/")[1].split("/")[0]
        if vid and re.fullmatch(r"[A-Za-z0-9_-]{11}", vid):
            return f"https://www.youtube.com/watch?v={vid}"
    except Exception:
        pass
    return url


def download_if_url(source: str, workdir: Path) -> Path:
    """URL bo'lsa yt-dlp bilan eng yaxshi audioni yuklaydi; fayl bo'lsa o'zini qaytaradi."""
    if not (source.startswith("http://") or source.startswith("https://")):
        p = Path(source)
        if not p.exists():
            raise ValueError(f"Fayl topilmadi: {source}")
        return p

    url = _clean_media_url(source)
    out_tmpl = str(workdir / "dl.%(ext)s")
    # yt-dlp modul sifatida (PATH shart emas). --quiet OLIB TASHLANDI: xato bo'lsa
    # stderr'ni ushlab haqiqiy sababni ko'rsatamiz (opaque "exit 1" o'rniga).
    cmd = [
        sys.executable, "-m", "yt_dlp",
        "-f", "bestaudio/best",
        "-o", out_tmpl,
        "--no-playlist", "--no-warnings",
        "--retries", "5", "--fragment-retries", "5",
        url,
    ]
    print(f"⏬ Yuklab olinmoqda: {url}")
    proc = subprocess.run(
        cmd, capture_output=True, text=True, encoding="utf-8", errors="replace",
        env=_clean_subprocess_env(),
    )
    if proc.returncode != 0:
        tail = (proc.stderr or proc.stdout or "").strip().splitlines()[-6:]
        msg = " | ".join(s.strip() for s in tail if s.strip()) or f"exit {proc.returncode}"
        raise ValueError(f"Videoni yuklab bo'lmadi: {msg}")
    files = [f for f in workdir.iterdir() if f.name.startswith("dl.")]
    if not files:
        raise ValueError("yt-dlp hech qanday fayl yuklamadi")
    return files[0]


def to_wav(media: Path, workdir: Path, sr: int = 44100) -> Path:
    """ffmpeg bilan ixtiyoriy mediani mono wav'ga aylantiradi."""
    ffmpeg = _find_bin("ffmpeg", "FFMPEG_BIN")
    out = workdir / "audio.wav"
    cmd = [
        ffmpeg, "-y", "-i", str(media),
        "-vn", "-ac", "1", "-ar", str(sr),
        "-loglevel", "error",
        str(out),
    ]
    print("🎞️  Audio ajratilmoqda (ffmpeg)...")
    subprocess.run(cmd, check=True)
    return out


_DEMUCS_MODEL = None


def _get_demucs():
    """htdemucs modelini bir marta yuklab keshlaydi (endpoint uchun ham)."""
    global _DEMUCS_MODEL
    if _DEMUCS_MODEL is None:
        from demucs.pretrained import get_model
        _DEMUCS_MODEL = get_model("htdemucs")
        _DEMUCS_MODEL.eval()
    return _DEMUCS_MODEL


def isolate_vocals(wav: Path, workdir: Path) -> Path:
    """
    Demucs (htdemucs) Python API bilan ovozni fondan ajratadi.

    CLI o'rniga API ishlatamiz: demucs 4.0.1 + yangi torch'da CLI'dagi
    `wav -= ref.mean()` (mono->stereo expand) bug'ini chetlab o'tadi.
    """
    import torch
    import torchaudio
    from demucs.apply import apply_model

    print("🎚️  Ovoz musiqadan ajratilmoqda (Demucs htdemucs)...")
    model = _get_demucs()
    device = "cuda" if torch.cuda.is_available() else "cpu"

    audio, sr = sf.read(str(wav))
    if audio.ndim == 1:
        audio = audio[None, :]            # [1, samples]
    else:
        audio = audio.T                   # [ch, samples]
    wav_t = torch.tensor(audio, dtype=torch.float32)

    if sr != model.samplerate:
        wav_t = torchaudio.functional.resample(wav_t, sr, model.samplerate)
        sr = model.samplerate
    if wav_t.shape[0] == 1:
        wav_t = wav_t.repeat(2, 1)        # mono->stereo (repeat = contiguous, expand emas)

    ref = wav_t.mean(0)
    std = ref.std().clamp(min=1e-8)
    wav_t = (wav_t - ref.mean()) / std    # out-of-place normalizatsiya (bug yo'q)

    with torch.no_grad():
        sources = apply_model(
            model.to(device), wav_t[None].to(device), device=device, progress=False
        )[0]
    sources = sources * std + ref.mean()

    idx = model.sources.index("vocals")
    vocals = sources[idx].mean(0).cpu().numpy()   # stereo -> mono

    out = workdir / "vocals.wav"
    sf.write(str(out), vocals.astype(np.float32), sr, subtype="PCM_16")
    return out


_VAD_MODEL = None


def _get_vad():
    global _VAD_MODEL
    if _VAD_MODEL is None:
        from silero_vad import load_silero_vad
        _VAD_MODEL = load_silero_vad()
    return _VAD_MODEL


def _estimate_snr(speech: np.ndarray, full: np.ndarray) -> float:
    """Nutq RMS / (umumiy - nutq) shovqin RMS ~ qo'pol SNR bahosi (dB)."""
    s_rms = float(np.sqrt(np.mean(speech ** 2) + 1e-12))
    floor = float(np.percentile(np.abs(full), 10)) + 1e-6
    return round(20 * np.log10(max(s_rms, 1e-6) / floor), 1)


_VOICE_ENC = None


def _get_voice_encoder():
    global _VOICE_ENC
    if _VOICE_ENC is None:
        from resemblyzer import VoiceEncoder
        _VOICE_ENC = VoiceEncoder(verbose=False)
    return _VOICE_ENC


def _group_by_speaker(
    audio16: np.ndarray, sr16: int, segs: list[tuple[float, float]],
    sim_thr: float = 0.65, min_emb_s: float = 1.0,
) -> tuple[list[tuple[float, float]], int]:
    """
    Nutq bo'laklarini gapiruvchi bo'yicha ajratib, ENG KO'P gapirganini qaytaradi.

    Har bo'lak resemblyzer embedding'i bilan ifodalanadi. "Anchor = eng ko'p
    qo'llab-quvvatlash" yondashuvi: har bo'lak uchun unga o'xshash (cos>=thr)
    bo'laklarning JAMI davomiyligini hisoblaymiz; eng kattasini "asosiy gapiruvchi"
    deb olamiz va faqat unga o'xshash bo'laklarni qaytaramiz. Greedy clustering'dan
    mustahkamroq (bir spikerning bo'laklari bo'linib ketmaydi). sklearn shart emas.
    Chegara 0.65: kalibratsiya — bir-spiker ichi ~0.66-0.85, spikerlararo ~0.47-0.62.
    Qaytadi: (asosiy_gapiruvchi_bo'laklari, taxminiy_gapiruvchilar_soni).
    """
    enc = _get_voice_encoder()

    embs: list[np.ndarray] = []
    kept: list[tuple[float, float]] = []
    for (s, e) in segs:
        if (e - s) < min_emb_s:
            continue
        clip = audio16[int(s * sr16): int(e * sr16)]
        peak = float(np.max(np.abs(clip))) if len(clip) else 0.0
        if peak <= 0:
            continue
        try:
            embs.append(enc.embed_utterance(clip * (0.95 / peak)))
            kept.append((s, e))
        except Exception:
            continue

    if len(embs) <= 1:
        return segs, 1

    E = np.asarray(embs, dtype=np.float64)
    E /= (np.linalg.norm(E, axis=1, keepdims=True) + 1e-9)
    sim = E @ E.T                                    # kosinus-o'xshashlik matritsasi
    dur = np.asarray([e - s for (s, e) in kept])
    same = sim >= sim_thr

    # asosiy gapiruvchi = unga o'xshash bo'laklarning jami davomiyligi eng katta
    support = same @ dur
    anchor = int(np.argmax(support))
    sel = same[anchor].copy()

    # sentroid bilan tozalash: anchor'ga tasodifan yaqin tushgan boshqa-ovoz
    # bo'laklarini chiqaradi (sentroid asosiy ovoz tomon tortiladi).
    for _ in range(2):
        centroid = E[sel].mean(axis=0)
        centroid /= (np.linalg.norm(centroid) + 1e-9)
        new_sel = (E @ centroid) >= sim_thr
        if new_sel.sum() == 0:
            break
        sel = new_sel

    dom = [kept[i] for i in range(len(kept)) if sel[i]]

    # gapiruvchilar sonini taxminlash (faqat metadata uchun)
    assigned = np.zeros(len(kept), dtype=bool)
    n_speakers = 0
    for i in range(len(kept)):
        if assigned[i]:
            continue
        n_speakers += 1
        assigned |= same[i]

    return dom, n_speakers


def select_best_segment(
    vocals_wav: Path, min_s: float = 4.0, max_s: float = 15.0, target_s: float = 12.0
) -> tuple[np.ndarray, int, dict]:
    """
    Silero VAD + speaker-diarizatsiya bilan AYNAN BITTA gapiruvchining toza nutqini
    topib birlashtiradi (musiqa/jimlik tashlanadi, ovozlar aralashmaydi).

    Nutq yetarli bo'lmasa (instrumental/musiqa/jim video) ValueError qaytaradi.
    """
    import torch
    from silero_vad import get_speech_timestamps

    audio, sr = sf.read(str(vocals_wav))
    if audio.ndim > 1:
        audio = audio.mean(axis=1)
    audio = audio.astype(np.float32)

    # VAD 16kHz'da ishlaydi
    if sr != 16000:
        import librosa
        audio16 = librosa.resample(audio, orig_sr=sr, target_sr=16000)
    else:
        audio16 = audio

    model = _get_vad()
    ts = get_speech_timestamps(
        torch.from_numpy(audio16).float(), model,
        sampling_rate=16000, return_seconds=True,
        min_speech_duration_ms=250, min_silence_duration_ms=120,
    )
    total_speech = float(sum(t["end"] - t["start"] for t in ts))

    if total_speech < min_s:
        raise ValueError(
            f"Yetarli nutq topilmadi (faqat {total_speech:.1f}s nutq aniqlandi). "
            f"Bu manba asosan musiqa/jim bo'lishi mumkin — GAPIRAYOTGAN odam "
            f"videosini (intervyu/vlog) sinab ko'ring."
        )

    segs = [(t["start"], t["end"]) for t in ts]

    # ── Bitta gapiruvchini tanlash (ko'p ovozli videoda aralashmaslik uchun) ──
    n_speakers = 1
    try:
        dom_segs, n_speakers = _group_by_speaker(audio16, 16000, segs)
        dom_total = sum(e - s for s, e in dom_segs)
        if dom_total >= min_s:
            segs = dom_segs            # faqat dominant gapiruvchi
        # aks holda (dominant juda qisqa) — barcha nutqni saqlab qolamiz (fallback)
    except Exception:
        pass                           # diarizatsiya xato bo'lsa hammasini ishlatamiz

    # Tanlangan bo'laklarni ORIGINAL sr'dan kesib birlashtiramiz, target_s ga yetguncha.
    gap = np.zeros(int(0.12 * sr), dtype=np.float32)
    parts: list[np.ndarray] = []
    acc = 0.0
    for (s, e) in segs:
        parts.append(audio[int(s * sr): int(e * sr)])
        acc += (e - s)
        if acc >= target_s:
            break
        parts.append(gap)

    clip = np.concatenate(parts)[: int(max_s * sr)]

    snr = _estimate_snr(clip, audio)

    # peak normalizatsiya -3 dB
    peak = float(np.max(np.abs(clip))) if len(clip) else 0.0
    if peak > 0:
        clip = clip * (0.707 / peak)

    meta = {
        "duration": round(len(clip) / sr, 2),
        "speech_total": round(total_speech, 1),
        "n_segments": len(segs),
        "n_speakers": n_speakers,
        "snr": snr,
    }
    return clip, sr, meta


def save_reference(clip: np.ndarray, sr: int, out_path: Path, target_sr: int = 24000) -> Path:
    if sr != target_sr:
        import librosa
        clip = librosa.resample(clip.astype(np.float32), orig_sr=sr, target_sr=target_sr)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out_path), clip.astype(np.float32), target_sr, subtype="PCM_16")
    return out_path


# ───────────────────────────── CLI ─────────────────────────────

def extract(source: str, out: Path, use_demucs: bool = True) -> dict:
    with tempfile.TemporaryDirectory(prefix="voiceclone_") as td:
        workdir = Path(td)
        media = download_if_url(source, workdir)
        wav = to_wav(media, workdir)
        voice_src = isolate_vocals(wav, workdir) if use_demucs else wav
        clip, sr, meta = select_best_segment(voice_src)
        save_reference(clip, sr, out)
    meta["reference_path"] = str(out)
    print("\n✅ Reference tayyor:")
    print(json.dumps(meta, ensure_ascii=False, indent=2))
    if meta["snr"] < 10:
        print("⚠️  SNR past — fon shovqini ko'p bo'lishi mumkin, boshqa segment/manba sinab ko'ring.")
    return meta


def main():
    ap = argparse.ArgumentParser(description="Mediadan klonlash uchun ovoz reference ajratish")
    ap.add_argument("--source", required=True, help="URL yoki audio/video fayl yo'li")
    ap.add_argument("--out", required=True, help="Chiqish reference.wav yo'li")
    ap.add_argument("--no-demucs", action="store_true", help="Demucs'siz (manba allaqachon toza nutq)")
    args = ap.parse_args()
    extract(args.source, Path(args.out), use_demucs=not args.no_demucs)


if __name__ == "__main__":
    main()
