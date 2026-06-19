# F5-TTS inference mikroservisi (port 8001, .venv-f5 muhitida ishlaydi).
# Asosiy backend (.venv, :8000) bundan alohida — main.py /synthesize/f5'ni shu yerga proxy qiladi.
#
# Ishga tushirish:
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe -m uvicorn f5_server:app --host 127.0.0.1 --port 8001
#
# MUHIM: pyarrow/datasets torchaudio'дан OLDIN (Windows DLL segfault).
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401

import io
import os
import random
import re
import time
from pathlib import Path
from importlib.resources import files

import numpy as np
import soundfile as sf
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from f5_tts.api import F5TTS

ROOT = Path(__file__).resolve().parent  # tts-server/
VOICES = ROOT / "voices"

# ── Yo'llar ──
CKPTS_DIR = Path(str(files("f5_tts").joinpath("../../ckpts/feruza"))).resolve()
# ckpts ildizi va afzal ko'riladigan sub-papkalar tartibi. "feruza" tarixiy default edi,
# lekin u har doim mavjud emas — shu sababli live "uzbek100/model_last" (memory) kabi
# mavjud papkalarga avtomatik tushamiz (F5_CKPT env hammasidan ustun).
CKPTS_ROOT = CKPTS_DIR.parent
CKPT_PREF = ["feruza", "uzbek100", "uzbek", "ayol"]
# DEPLOY checkpoint = ISSAI+Feruza (43s) qayta o'rgatilgan model_34000 (ASR-WER: 24%→15%).
# Training davom etsa ckpts/uzbek/ o'zgaradi, lekin bu nusxa BARQAROR (ustiga yozilmaydi).
DEPLOY_CKPT = Path(str(files("f5_tts").joinpath("../../ckpts/uzbek_deploy.pt"))).resolve()
VOCAB = Path(str(files("f5_tts").joinpath("../../data/feruza_char/vocab.txt"))).resolve()
# Reference ovozlar (UI tanlovlari). F5 voice-cloning: tanlangan klip tembri/ohangida
# gapiradi (qayta o'rgatish SHART EMAS — faqat reference almashadi).
#   feruza = #1 audition (id 1187023182, tabiiy/tinch)   jonli = 05 audition (ifodali, jonliroq)
# F5_REF_WAV/F5_REF_TXT env bo'lsa "feruza"ni almashtiradi (eski xulq, moslik uchun).
REFS_FILES = {
    "feruza": (Path(os.environ.get("F5_REF_WAV", str(VOICES / "f5_ref_main.wav"))),
               Path(os.environ.get("F5_REF_TXT", str(VOICES / "f5_ref_main.txt")))),
    "jonli":  (VOICES / "f5_ref_jonli.wav", VOICES / "f5_ref_jonli.txt"),
}
DEFAULT_VOICE = "feruza"

# ── Matn normalizatsiyasi (TRAINING bilan AYNAN bir xil bo'lishi shart!) ──
# train: scripts/finalize_f5_metadata.py NORM bilan mos.
_NORM = [("﻿", ""), ("​", ""), (" ", " "),  # BOM / zero-width / nbsp — F5 buzadi
         ("‘", "'"), ("’", "'"), ("ʻ", "'"), ("ʼ", "'"), ("`", "'"),
         ("“", '"'), ("”", '"'), ("«", '"'), ("»", '"'),
         ("—", "-"), ("–", "-"), ("…", "..."),
         ("ӯ", "u"), ("Ӯ", "U"), ("ӽ", "x")]

def normalize(t: str) -> str:
    for a, b in _NORM:
        t = t.replace(a, b)
    return t.strip()


# Trening datasining ~78% (raw ISSAI 100.7k klip) BUTUNLAY kichik harfda — bosh harfli
# so'z ("Xalqaro") model uchun siyrak belgi: katta "X" ni "iks" deb o'qib yuborishi mumkin.
# Faqat bosh harfi katta (Title-case) so'zlarni kichraytiramiz; to'liq KATTA qisqartma
# (AQSH, BMT) tegilmaydi. F5_LOWER=0 bilan o'chadi.
_TITLE_WORD = re.compile(r"\b[A-ZА-ЯЁЎҒҚҲ][\w'ʻ-]*")

def smart_lowercase(t: str) -> str:
    if os.environ.get("F5_LOWER", "1") == "0":
        return t

    def fix(m: re.Match) -> str:
        w = m.group(0)
        if any(c.isupper() for c in w[1:]):  # AQSH, BMT — qisqartma, tegmaymiz
            return w
        return w.lower()

    return _TITLE_WORD.sub(fix, t)


# F5 talaffuz lug'ati: so'z BOSHIDAGI "x" ni "kh" ga almashtiramiz — model /x/ tovushini
# shunda to'g'ri chiqaradi (foydalanuvchi quloq bilan tasdiqladi: khalq -> to'g'ri 'xalq').
# So'z O'RTASIDAGI x (yaxshi, axborot) yaxshi o'qiladi — tegilmaydi. Lookbehind apostrof/
# harfni istisno qiladi (o'xshash dagi x mid-word -> tegilmaydi). F5_FIX_X=0 bilan o'chadi.
_X_INIT = re.compile(r"(?<![a-zA-Z'`’ʻ])([xX])")

def fix_x_pronunciation(t: str) -> str:
    # Default O'CHIQ: uzbek70+ avlod modellar /x/ ni o'zi to'g'ri o'qiydi, kh-hiyla
    # ularda ZARAR (x-zich matn ASR-eval: khOFF 16% vs khON 40%). F5_FIX_X=1 bilan yonadi
    # (faqat eski feruza/uzbek_deploy'dan oldingi ckpt uchun kerak bo'lishi mumkin).
    if os.environ.get("F5_FIX_X", "0") == "0":
        return t
    return _X_INIT.sub(lambda m: "Kh" if m.group(1) == "X" else "kh", t)


# Gap oxiri belgilaridan keyin bo'lamiz (probel/satr oxiri bilan). F5 uzun matnni
# bir o'qishda chalkashtiradi — har jumlani ALOHIDA sintez qilsak o'qish ancha
# aniqroq bo'ladi (ASR-sweep: nfe=48 bilan birga eng yaxshi natija).
_SENT_SPLIT = re.compile(r"(?<=[.!?…])\s+")

def split_sentences(text: str) -> list[str]:
    parts: list[str] = []
    for line in text.split("\n"):
        line = line.strip()
        if not line:
            continue
        for s in _SENT_SPLIT.split(line):
            s = s.strip()
            if s:
                parts.append(s)
    # Juda qisqa bo'laklarni (masalan "1.") oldingi jumlaga qo'shamiz.
    merged: list[str] = []
    for s in parts:
        if merged and len(s.replace(".", "").strip()) < 3:
            merged[-1] = merged[-1] + " " + s
        else:
            merged.append(s)
    return merged or [text]

def _pick_from_dir(d: Path) -> str | None:
    """Bitta papkadan eng yangi checkpoint: model_last ustun, aks holda eng katta step."""
    if not d.exists():
        return None
    cands = list(d.glob("model_*.pt")) + list(d.glob("model_*.safetensors"))
    if not cands:
        return None
    last = [p for p in cands if "last" in p.name]
    if last:
        return str(max(last, key=lambda p: p.stat().st_mtime))
    # step raqami bo'yicha (model_last yo'q bo'lsa eng katta step)
    def step(p: Path) -> int:
        m = re.search(r"model_(\d+)", p.name)
        return int(m.group(1)) if m else -1
    return str(max(cands, key=step))


def latest_checkpoint() -> str | None:
    """Tanlov tartibi: F5_CKPT env > uzbek_deploy.pt > ckpts/{feruza,uzbek100,uzbek,ayol}
    > ckpts ostidagi istalgan model_*. (feruza har doim mavjud emas — env'siz ham ishlaydi.)"""
    env = os.environ.get("F5_CKPT")
    if env and Path(env).exists():
        return env
    if DEPLOY_CKPT.exists():
        return str(DEPLOY_CKPT)
    # Afzal sub-papkalar (feruza birinchi — tarixiy default; keyin live uzbek100).
    for name in CKPT_PREF:
        hit = _pick_from_dir(CKPTS_ROOT / name)
        if hit:
            return hit
    # Oxirgi chora: ckpts ostidagi har qanday papkadan checkpoint izlash.
    if CKPTS_ROOT.exists():
        for d in sorted(CKPTS_ROOT.iterdir()):
            if d.is_dir():
                hit = _pick_from_dir(d)
                if hit:
                    return hit
    return None

# ── Model holati ──  refs: {voice: {"wav": str, "text": str}}
state = {"model": None, "ckpt": None, "refs": {}}

def load():
    ckpt = latest_checkpoint()
    if not ckpt:
        raise RuntimeError(f"Checkpoint topilmadi: {CKPTS_ROOT} ostida {CKPT_PREF} yo'q")
    vocab = str(VOCAB) if VOCAB.exists() else ""
    print(f"⏳ F5 yuklanmoqda: ckpt={ckpt}", flush=True)
    state["model"] = F5TTS(model="F5TTS_v1_Base", ckpt_file=ckpt, vocab_file=vocab)
    state["ckpt"] = ckpt
    refs = {}
    for name, (wav, txt) in REFS_FILES.items():
        if wav.exists():
            refs[name] = {
                "wav": str(wav),
                "text": normalize(txt.read_text(encoding="utf-8")) if txt.exists() else "",
            }
    state["refs"] = refs
    print(f"✅ F5 tayyor. ovozlar={list(refs)}", flush=True)

app = FastAPI(title="NextTTS F5 engine")

@app.on_event("startup")
def _startup():
    load()

class SynthReq(BaseModel):
    text: str
    speed: float = 1.0
    nfe_step: int = 48  # ASR-sweep: 28%→18% WER (cfg=2.0 default eng yaxshi)
    remove_silence: bool = False
    voice: str = "feruza"  # reference tanlovi: feruza (#1, tabiiy) | jonli (05, ifodali)

@app.get("/health")
def health():
    return {
        "available": state["model"] is not None,
        "engine": "f5",
        "checkpoint": state["ckpt"],
        "voices": list(state["refs"]),
    }

@app.post("/synthesize/f5")
def synthesize(req: SynthReq):
    if state["model"] is None:
        return JSONResponse({"error": "model yuklanmagan"}, status_code=503)
    text = smart_lowercase(normalize(req.text))
    if not text:
        return JSONResponse({"error": "matn bo'sh"}, status_code=400)
    ref = state["refs"].get(req.voice) or state["refs"].get(DEFAULT_VOICE)
    if ref is None:
        return JSONResponse({"error": "reference yuklanmagan"}, status_code=503)
    # Seed: F5_SEED env bo'lsa fiks (takrorlanuvchan test); bo'lmasa har SO'ROVDA yangi
    # random (variativ, tabiiyroq) — lekin bitta so'rov ichida barcha jumlaga BIR seed
    # (jumlalar orasida mikro-ohang sakramasin).
    env_seed = os.environ.get("F5_SEED")
    seed = int(env_seed) if env_seed else random.randint(0, 2**31 - 1)
    t0 = time.time()
    # So'z boshidagi "x" -> "kh" (faqat gen matn; reference matnga TEGILMAYDI).
    text = fix_x_pronunciation(text)
    # Jumlama-jumla — har birini alohida sintez qilib, orasiga qisqa jimlik qo'shamiz.
    sentences = split_sentences(text)
    # Onset-pad: gap BOSHIDAGI birinchi so'z F5'da beqaror (xabar->sabr, xavfsizlik->
    # savsizlik, hatto "ha baribir" gallyutsinatsiya). Jumla boshiga ", " qo'ysak model
    # avval mikro-pauza oladi va birinchi so'z omon qoladi (ASR-eval 2 model x 4 gap x
    # 3 seed: 1-so'z to'g'ri 7/12 -> 12/12). Narxi: ba'zan juda qisqa onset tovushi.
    # F5_ONSET_PAD=0 bilan o'chadi.
    onset_pad = ", " if os.environ.get("F5_ONSET_PAD", "1") != "0" else ""
    parts, sr = [], 24000
    prev_end = ""
    for sent in sentences:
        w, sr, _ = state["model"].infer(
            ref["wav"], ref["text"], onset_pad + sent,
            nfe_step=req.nfe_step, speed=req.speed, remove_silence=req.remove_silence,
            seed=seed, show_info=lambda *a, **k: None,
        )
        if parts:
            # Pauza oldingi jumlaning tinish belgisiga mos: savol/undov nutqda
            # uzunroq to'xtam talab qiladi, oddiy nuqta o'rtacha.
            pause = {"?": 0.45, "!": 0.45, ".": 0.35}.get(prev_end, 0.3)
            parts.append(np.zeros(int(pause * sr), dtype="float32"))
        parts.append(np.asarray(w, dtype="float32"))
        prev_end = sent.rstrip()[-1:] if sent.rstrip() else ""
    wav = np.concatenate(parts) if parts else np.zeros(1, dtype="float32")
    dt = time.time() - t0
    buf = io.BytesIO()
    sf.write(buf, np.asarray(wav), sr, format="WAV", subtype="PCM_16")
    buf.seek(0)
    return Response(
        content=buf.read(),
        media_type="audio/wav",
        headers={"X-Synthesis-Time-Sec": f"{dt:.2f}", "X-Engine": "f5",
                 "X-Voice": req.voice,
                 "X-Checkpoint": Path(state["ckpt"]).name if state["ckpt"] else ""},
    )
