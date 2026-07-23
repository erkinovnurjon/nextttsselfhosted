"""
Video dublyaj (voiceover): ingliz video -> o'zbekcha ovozli tarjima.

Pipeline:
    manba (fayl/URL)
      -> ffmpeg           (audio ajratish: 16k ASR uchun + 24k mixlash uchun)
      -> EN Whisper       (distil-large-v3, segment vaqt belgilari bilan)
      -> tarjima          (NLLB-200 lokal | Claude API — ANTHROPIC_API_KEY bo'lsa)
      -> TTS              (Piper :8002 default — har segmentni o'zbekcha aytadi)
      -> vaqtga moslash   (segment slotiga sig'masa Piper length_scale bilan tezlatadi)
      -> mix + mux        (original ovoz pasaytirilib fon, ustiga o'zbek nutq) -> mp4

MUHIM: bu LAB-SINXRON dublyaj EMAS — original vaqtga moslangan o'zbekcha voiceover.

Foydalanish:
    .venv/Scripts/python.exe scripts/dub_video.py --source kino.mp4 --out kino_uz.mp4
    ... --voice piper --translator nllb --duck 0.18
"""

import argparse
import io
import json
import os
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from pathlib import Path

import numpy as np
import soundfile as sf

SCRIPTS = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS))
# extract_voice'dan tashqi-vosita topuvchi + URL yuklovchini qayta ishlatamiz.
from extract_voice import (  # noqa: E402
    _find_bin, _clean_subprocess_env, download_if_url, isolate_vocals,
)

PIPER_URL = os.environ.get("PIPER_URL", "http://127.0.0.1:8002")
MMS_URL = os.environ.get("TTS_BACKEND_URL", "http://127.0.0.1:8000")
F5_URL = os.environ.get("F5_BACKEND_URL", "http://127.0.0.1:8001")

# ASR modeli. distil-large-v3 (tezlik uchun siqilgan) kino/klip audiosida
# YIQILADI — bo'lak-bo'lak, takroriy axlat chiqaradi ("and you're, you're..."),
# tarjima esa o'sha axlatni sodiqlik bilan o'giradi. To'liq large-v3 xuddi shu
# audioda butun jumlalar beradi. Sekinroq va ~3 GB VRAM oladi, lekin sifat farqi
# hal qiluvchi. Zaif mashinada DUB_ASR_MODEL bilan distil'ga qaytarish mumkin.
ASR_MODEL = os.environ.get("DUB_ASR_MODEL", "openai/whisper-large-v3")

NLLB_SRC = "eng_Latn"
NLLB_TGT = "uzn_Latn"  # o'zbek (lotin)
# NLLB torch<2.6'da .bin yuklay olmaydi → safetensors'ga o'girilgan lokal nusxa
# (_convert_nllb.py). Papka yo'q bo'lsa hub'ga qaytamiz (torch>=2.6 mashinalar uchun).
NLLB_LOCAL = SCRIPTS.parent / "models" / "nllb-uz"
NLLB_MODEL = str(NLLB_LOCAL) if NLLB_LOCAL.exists() else "facebook/nllb-200-distilled-600M"

_asr = None
_nllb = None


# ───────────────────────── audio I/O ─────────────────────────

def _ffmpeg() -> str:
    return _find_bin("ffmpeg", "FFMPEG_BIN")


def extract_audio(video: Path, workdir: Path, sr: int, name: str) -> np.ndarray:
    out = workdir / f"{name}.wav"
    subprocess.run(
        [_ffmpeg(), "-y", "-i", str(video), "-vn", "-ac", "1", "-ar", str(sr), str(out)],
        check=True, capture_output=True, env=_clean_subprocess_env(),
    )
    a, _ = sf.read(str(out))
    return np.asarray(a, dtype="float32")


def _wav_to_mono(src: Path, workdir: Path, sr: int, name: str) -> np.ndarray:
    """Tayyor wav'ni ffmpeg bilan mono/sr'ga keltiradi (to'g'ri filtrlangan resample)."""
    out = workdir / f"{name}.wav"
    subprocess.run(
        [_ffmpeg(), "-y", "-i", str(src), "-ac", "1", "-ar", str(sr), str(out)],
        check=True, capture_output=True, env=_clean_subprocess_env(),
    )
    a, _ = sf.read(str(out))
    return np.asarray(a, dtype="float32")


def asr_audio(video: Path, workdir: Path, isolate: bool) -> np.ndarray:
    """
    ASR uchun 16k mono audio.

    isolate=True bo'lsa Demucs bilan avval NUTQ musiqadan/effektdan ajratiladi.
    Kino/klip audiosida bu KRITIK: fon ustida Whisper qotib qoladi va takroriy
    axlat chiqaradi ("and you're, you're, and you're..."), tarjima esa o'sha
    axlatni sodiqlik bilan o'zbekchaga o'giradi. Ajratish faqat ASR uchun —
    chiqish videosidagi fon musiqa ORIGINALDAN olinadi, ya'ni yo'qolmaydi.
    """
    if not isolate:
        return extract_audio(video, workdir, 16000, "asr")
    # Demucs to'liq chastotali kirish kutadi (model 44.1k).
    extract_audio(video, workdir, 44100, "asr_full")
    vocals = isolate_vocals(workdir / "asr_full.wav", workdir)
    return _wav_to_mono(vocals, workdir, 16000, "asr_vocals")


def _resample_linear(a: np.ndarray, src_sr: int, dst_sr: int) -> np.ndarray:
    """Yengil chiziqli resample (fon audio uchun yetarli — sifat kritik emas)."""
    if src_sr == dst_sr:
        return a
    n_dst = int(round(len(a) * dst_sr / src_sr))
    x_old = np.linspace(0, 1, num=len(a), endpoint=False)
    x_new = np.linspace(0, 1, num=n_dst, endpoint=False)
    return np.interp(x_new, x_old, a).astype("float32")


# ───────────────────────── 1) EN ASR (segment + vaqt) ─────────────────────────

def _segment_rms(audio16: np.ndarray, start: float, end: float) -> float:
    """Segment oynasidagi original audio energiyasi (RMS)."""
    a = audio16[int(start * 16000) : int(end * 16000)]
    if a.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(a.astype("float64") ** 2)))


# Shundan past RMS = amalda sukunat. Nutq odatda >0.02; tinch xona shovqini
# ~0.001-0.003. Chegara ataylab past — jimroq nutqni kesib yubormaslik uchun.
SILENCE_RMS = 0.005


def drop_hallucinations(segments: list[dict], audio16: np.ndarray) -> list[dict]:
    """
    Whisper sukunat ustida MATN TO'QIYDI ("Thank you.", subtitr krediti va h.k.) —
    bu distil-whisper'ning ma'lum xatti-harakati. Jim videoda bu "Sizga rahmat"
    deb ovozlangan dublyajga aylanadi, ya'ni foydalanuvchi ma'nosiz natija oladi.
    Yechim: segment ostidagi ORIGINAL audio jim bo'lsa, segmentni tashlaymiz —
    to'qilgan matnni matndan emas, manbadan turib aniqlaymiz.
    """
    kept = []
    for s in segments:
        if _segment_rms(audio16, s["start"], s["end"]) >= SILENCE_RMS:
            kept.append(s)
    dropped = len(segments) - len(kept)
    if dropped:
        print(f"  {dropped} segment tashlandi (jim joyda to'qilgan matn)", flush=True)
    return kept


def transcribe_en(audio16: np.ndarray) -> list[dict]:
    global _asr
    if _asr is None:
        import torch
        from transformers import pipeline
        dev = 0 if torch.cuda.is_available() else -1
        dtype = torch.float16 if dev == 0 else torch.float32
        # chunk_length_s ATAYLAB berilmagan: u bilan pipeline "chunked" yo'lga
        # tushadi (HF o'zi buni seq2seq uchun eksperimental deb ogohlantiradi).
        # Busiz Whisper o'zining ketma-ket long-form dekodini ishlatadi.
        _asr = pipeline(
            "automatic-speech-recognition",
            model=ASR_MODEL,
            torch_dtype=dtype, device=dev,
        )
    out = _asr(
        {"array": audio16, "sampling_rate": 16000},
        return_timestamps=True,
        generate_kwargs={
            # Manba ingliz — avtoaniqlashga tashlab qo'ymaymiz.
            "language": "en", "task": "transcribe",
            # Takror-siklga qarshi standart himoyalar.
            "repetition_penalty": 1.2, "no_repeat_ngram_size": 4,
        },
    )
    segs = []
    for ch in out.get("chunks", []):
        ts = ch.get("timestamp") or (None, None)
        text = (ch.get("text") or "").strip()
        if text and ts[0] is not None:
            start = float(ts[0])
            end = float(ts[1]) if ts[1] is not None else start + 2.0
            segs.append({"start": start, "end": end, "en": text})
    return segs


# Bir segmentga sig'adigan maksimal davomiylik (undan uzunini bo'lamiz).
MERGE_MAX_SEC = 12.0
# Shundan uzun pauza = yangi fikr, qo'shmaymiz.
MERGE_GAP_SEC = 0.8
_SENT_END = (".", "!", "?", "…")


def merge_segments(segs: list[dict]) -> list[dict]:
    """
    Whisper matnni mayda, grammatik tugallanmagan bo'laklarga kesadi
    ("And you,", "and you're,"). Har bo'lakni ALOHIDA tarjima qilish g'aliz
    natija beradi — NLLB'ga kontekst kerak, "they're," dan ma'no chiqmaydi.
    Shuning uchun bo'laklarni gap oxirigacha (. ! ?) qo'shib, jumla birligiga
    keltiramiz. Uzoq pauza yoki MERGE_MAX_SEC chegara — bo'lish nuqtasi.

    Vaqt belgilari saqlanadi: birinchi bo'lakning start'i, oxirgisining end'i —
    ya'ni dublyaj original vaqtga moslashda yutqazmaydi.
    """
    out: list[dict] = []
    for s in segs:
        if not out:
            out.append(dict(s))
            continue
        prev = out[-1]
        prev_text = prev["en"].rstrip()
        joinable = (
            not prev_text.endswith(_SENT_END)
            and (s["start"] - prev["end"]) <= MERGE_GAP_SEC
            and (s["end"] - prev["start"]) <= MERGE_MAX_SEC
        )
        if joinable:
            prev["en"] = f"{prev_text} {s['en'].lstrip()}".strip()
            prev["end"] = s["end"]
        else:
            out.append(dict(s))
    return out


# ───────────────────────── 2) Tarjima EN->UZ ─────────────────────────

def _translate_nllb(texts: list[str]) -> list[str]:
    global _nllb
    if _nllb is None:
        import torch
        from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
        tok = AutoTokenizer.from_pretrained(NLLB_MODEL, src_lang=NLLB_SRC)
        model = AutoModelForSeq2SeqLM.from_pretrained(NLLB_MODEL)
        if torch.cuda.is_available():
            model = model.to("cuda")
        _nllb = (tok, model)
    tok, model = _nllb
    import torch
    bos = tok.convert_tokens_to_ids(NLLB_TGT)
    out = []
    for t in texts:
        inputs = tok(t, return_tensors="pt", truncation=True, max_length=512)
        inputs = {k: v.to(model.device) for k, v in inputs.items()}
        with torch.no_grad():
            gen = model.generate(
                **inputs, forced_bos_token_id=bos, max_length=512, num_beams=4,
                # NLLB ba'zan takror-siklga tushadi ("o'shanda o'shanda...") — bu
                # standart himoyalar buni to'xtatadi.
                no_repeat_ngram_size=3, repetition_penalty=1.3,
            )
        res = tok.batch_decode(gen, skip_special_tokens=True)[0].strip()
        out.append(_collapse_repeats(res))
    return out


def _collapse_repeats(text: str, max_run: int = 2) -> str:
    """Bir so'z ketma-ket 2 martadan ko'p takrorlansa qisqartiradi (himoya to'ri —
    generate himoyasidan o'tib ketgan takrorlarga qarshi)."""
    words = text.split()
    out: list[str] = []
    run = 0
    for w in words:
        if out and w.lower() == out[-1].lower():
            run += 1
            if run >= max_run:
                continue
        else:
            run = 0
        out.append(w)
    return " ".join(out)


# Bir so'rovga nechta segment. Butun kinoni BITTA so'rovга tiqish max_tokens'ni
# oshirib yuboradi → javob o'rtadan kesiladi va segmentlarning yarmi jimgina
# inglizcha qoladi (eski bug). 40 = kontekst uchun yetarli (ketma-ket replikalar
# birga tarjima qilinsa tabiiyroq), lekin javobni chegaraга sig'diradi.
CLAUDE_BATCH = 40

# Bir batch chiqishiga yetarli tokens. 40 qisqa replika ≈ 1.5-2k token; 8000
# katta zaxira. stop_reason=="max_tokens" bo'lsa OGOHLANTIRAMIZ (jim kesilmasin).
CLAUDE_MAX_TOKENS = 8000

_CLAUDE_SYS = (
    "Sen film/video dublyaji uchun ingliz→o'zbek tarjimonisen. Qoidalar:\n"
    "- TABIIY, og'zaki o'zbek tili (lotin yozuvi) — kitobiy emas, personaj gapiradigandek.\n"
    "- Atoqli otlar (ism, joy, tashkilot) o'zbekcha tanish shaklда saqlansin "
    "(masalan 'White Walkers' → 'Oq Yuruvchilar', 'John' → 'Jon').\n"
    "- Har replikaning uzunligini imkon qadar saqla — dublyaj original vaqtga sig'ishi kerak.\n"
    "- Kontekstni hisobga ol: replikalar ketma-ket, bir sahna.\n"
    "- FAQAT tarjimani '<raqam>. <tarjima>' formatida qaytar, izohsiz."
)


def _translate_claude_batch(texts: list[str], key: str, model: str) -> list[str]:
    """Bitta batchni tarjima qiladi. Xato bo'lsa o'sha batch inglizcha qoladi
    (butun kinoni yiqitmaslik uchun) — sabab stderr'ga chiqadi."""
    numbered = "\n".join(f"{i+1}. {t}" for i, t in enumerate(texts))
    body = json.dumps({
        "model": model,
        "max_tokens": CLAUDE_MAX_TOKENS,
        "system": _CLAUDE_SYS,
        "messages": [{"role": "user", "content": numbered}],
    }).encode()
    req = urllib.request.Request(
        "https://api.anthropic.com/v1/messages", data=body,
        headers={"x-api-key": key, "anthropic-version": "2023-06-01",
                 "content-type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "replace")[:200]
        print(f"  ⚠️ Claude batch xatosi ({e.code}): {detail}", flush=True)
        return list(texts)  # inglizcha fallback
    except Exception as e:
        print(f"  ⚠️ Claude batch xatosi: {type(e).__name__}: {e}", flush=True)
        return list(texts)

    # Xavfsizlik rad javobi (opus-4-8 stop_reason='refusal') — content bo'sh bo'lishi mumkin.
    if data.get("stop_reason") == "refusal":
        print("  ⚠️ Claude tarjimani rad etdi (refusal) — bu batch inglizcha qoladi.", flush=True)
        return list(texts)
    if data.get("stop_reason") == "max_tokens":
        # Endi JIM emas — ko'rinadigan ogohlantirish. CLAUDE_BATCH kichraytirilsa yo'qoladi.
        print("  ⚠️ Claude javobi max_tokens'ga yetdi — batch qisqartiring.", flush=True)

    text = "".join(b.get("text", "") for b in data.get("content", []))
    by_num: dict[int, str] = {}
    for line in text.splitlines():
        line = line.strip()
        if not line or "." not in line:
            continue
        num, _, rest = line.partition(".")
        if num.strip().isdigit():
            by_num[int(num.strip())] = rest.strip()
    # Yetishmagan qator (parse xatosi yoki kesilish) inglizcha qoladi.
    return [by_num.get(i + 1, texts[i]) for i in range(len(texts))]


def _translate_claude(texts: list[str]) -> list[str]:
    key = os.environ.get("ANTHROPIC_API_KEY", "").strip()
    if not key:
        raise RuntimeError("ANTHROPIC_API_KEY yo'q — Claude tarjima ishlamaydi.")
    model = os.environ.get("CHATBOT_MODEL", "claude-opus-4-8")
    out: list[str] = []
    total = (len(texts) + CLAUDE_BATCH - 1) // CLAUDE_BATCH
    for bi, i in enumerate(range(0, len(texts), CLAUDE_BATCH), start=1):
        batch = texts[i : i + CLAUDE_BATCH]
        if total > 1:
            print(f"  Claude tarjima: batch {bi}/{total} ({len(batch)} replika)", flush=True)
        out.extend(_translate_claude_batch(batch, key, model))
    return out


def translate(texts: list[str], engine: str) -> list[str]:
    if not texts:
        return []
    if engine == "claude":
        return _translate_claude(texts)
    return _translate_nllb(texts)


# ───────────────────────── 3) TTS (segment -> o'zbek nutq) ─────────────────────────

def tts_piper(text: str, length_scale: float = 1.0) -> tuple[np.ndarray, int]:
    body = json.dumps({"text": text, "length_scale": length_scale}).encode()
    req = urllib.request.Request(f"{PIPER_URL}/synthesize/piper", data=body,
                                 headers={"content-type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        wav_bytes = r.read()
    a, sr = sf.read(io.BytesIO(wav_bytes))
    return np.asarray(a, dtype="float32"), int(sr)


# ───────────────────────── 4) Timeline yig'ish + mix + mux ─────────────────────────

def _has_letters(text: str) -> bool:
    """Matnda hech bo'lmasa bitta harf bormi (tinish belgisi sanalmaydi)."""
    return any(ch.isalpha() for ch in text)


def build_dub(segments: list[dict], total_sec: float, voice: str) -> tuple[np.ndarray, int]:
    # Piper SR'ni birinchi sintezdan aniqlaymiz.
    sr = None
    placed: list[tuple[int, np.ndarray]] = []
    n = len(segments)
    for i, seg in enumerate(segments):
        uz = seg["uz"].strip()
        # Harfsiz matn ("...", "?!") Piper'da fonemaga aylanmaydi -> nol freym ->
        # wave.close() yiqiladi -> 500. Bunday segmentni umuman yubormaymiz.
        if not _has_letters(uz):
            continue
        try:
            wav, s = tts_piper(uz)
            if sr is None:
                sr = s
            avail = (segments[i + 1]["start"] - seg["start"]) if i + 1 < n else (total_sec - seg["start"])
            dur = len(wav) / sr
            # Slotga sig'masa Piper'da tezlatamiz (length_scale<1 = tezroq), max ~1.6x.
            if avail > 0.4 and dur > avail:
                scale = max(0.62, avail / dur)
                wav, s = tts_piper(uz, length_scale=scale)
        except Exception as e:
            # Bitta segment butun dublyajni o'ldirmasin — uni jim qoldiramiz.
            print(f"  [{i+1}/{n}] TASHLANDI ({type(e).__name__}): {uz[:40]}", flush=True)
            continue
        placed.append((int(seg["start"] * sr), wav))
        print(f"  [{i+1}/{n}] {seg['start']:.1f}s  {uz[:50]}", flush=True)
    if sr is None:
        sr = 22050
    total_len = int(total_sec * sr) + sr
    track = np.zeros(total_len, dtype="float32")
    for start_i, wav in placed:
        end_i = min(total_len, start_i + len(wav))
        track[start_i:end_i] += wav[: end_i - start_i]
    return track, sr


def mux(video: Path, dub: np.ndarray, orig: np.ndarray, orig_sr: int, sr: int,
        duck: float, out: Path, workdir: Path) -> None:
    # Original ovozni sr'ga keltirib pasaytiramiz (fon), ustiga dub qo'shamiz.
    bg = _resample_linear(orig, orig_sr, sr) * duck
    L = max(len(dub), len(bg))
    mix = np.zeros(L, dtype="float32")
    mix[: len(bg)] += bg
    mix[: len(dub)] += dub
    peak = float(np.max(np.abs(mix))) or 1.0
    if peak > 0.98:
        mix *= 0.98 / peak
    audio_path = workdir / "dub_audio.wav"
    sf.write(str(audio_path), mix, sr, subtype="PCM_16")
    # Video oqimini nusxalab, audioni almashtiramiz.
    subprocess.run(
        # +faststart: `moov` atomini fayl BOSHIGA ko'chiradi. Ffmpeg default'da
        # uni oxiriga yozadi — u holda brauzer <video> davomiylikni bilish uchun
        # fayl dumini alohida Range so'rovi bilan olishga majbur bo'ladi va
        # nosozlikda "0:00" jim pleyer chiqadi. Boshda tursa — darrov ochiladi.
        [_ffmpeg(), "-y", "-i", str(video), "-i", str(audio_path),
         "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac",
         "-movflags", "+faststart", "-shortest", str(out)],
        check=True, capture_output=True, env=_clean_subprocess_env(),
    )


# ───────────────────────── Orkestr ─────────────────────────

def run(source: str, out: Path, voice: str = "piper", translator: str = "nllb",
        duck: float = 0.18, isolate: bool = True) -> dict:
    with tempfile.TemporaryDirectory(prefix="dub_") as td:
        workdir = Path(td)
        video = download_if_url(source, workdir) if source.startswith(("http://", "https://")) else Path(source)
        print("🎞️  Audio ajratilmoqda...", flush=True)
        # orig24 = mixlash uchun ORIGINAL (musiqa/effekt saqlanadi).
        # audio16 = ASR uchun, isolate=True bo'lsa faqat nutq.
        orig24 = extract_audio(video, workdir, 24000, "orig")
        audio16 = asr_audio(video, workdir, isolate)
        total_sec = len(orig24) / 24000

        print("📝 Ingliz nutq aniqlanmoqda (Whisper)...", flush=True)
        segments = merge_segments(drop_hallucinations(transcribe_en(audio16), audio16))
        if not segments:
            raise RuntimeError("Nutq topilmadi (video jim yoki musiqa bo'lishi mumkin).")
        print(f"  {len(segments)} segment, {total_sec:.0f}s video", flush=True)

        print(f"🌐 Tarjima ({translator})...", flush=True)
        uz = translate([s["en"] for s in segments], translator)
        for s, u in zip(segments, uz):
            s["uz"] = u

        print("🎙️  O'zbekcha ovoz yozilmoqda...", flush=True)
        dub, sr = build_dub(segments, total_sec, voice)

        print("🎬 Video yig'ilmoqda...", flush=True)
        mux(video, dub, orig24, 24000, sr, duck, out, workdir)

    meta = {"segments": len(segments), "duration_sec": round(total_sec, 1),
            "voice": voice, "translator": translator, "out": str(out)}
    # Segment matnlarini yon .json'ga (tekshirish uchun).
    Path(str(out) + ".segments.json").write_text(
        json.dumps(segments, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n✅ Dublyaj tayyor:", json.dumps(meta, ensure_ascii=False), flush=True)
    return meta


def main():
    ap = argparse.ArgumentParser(description="Video dublyaj: EN -> o'zbekcha voiceover")
    ap.add_argument("--source", required=True, help="Video fayl yo'li yoki URL")
    ap.add_argument("--out", required=True, help="Chiqish mp4 yo'li")
    ap.add_argument("--voice", default="piper", help="Dublyaj ovozi (hozircha piper)")
    ap.add_argument("--translator", default="nllb", choices=["nllb", "claude"])
    ap.add_argument("--duck", type=float, default=0.18, help="Original ovoz balandligi (fon)")
    ap.add_argument("--no-isolate", dest="isolate", action="store_false",
                    help="Demucs'siz — audio allaqachon toza nutq bo'lsa (tezroq)")
    args = ap.parse_args()
    run(args.source, Path(args.out), args.voice, args.translator, args.duck, args.isolate)


if __name__ == "__main__":
    main()
