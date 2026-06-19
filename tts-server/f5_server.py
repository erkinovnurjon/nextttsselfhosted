# F5-TTS inference mikroservisi (port 8001, .venv-f5 muhitida ishlaydi).
# Asosiy backend (.venv, :8000) bundan alohida — main.py /synthesize/f5'ni shu yerga proxy qiladi.
#
# Ko'p-modelli: bir nechta F5 fine-tune (har biri alohida checkpoint+vocab) bir vaqtda
# yuklanadi, "voice" parametri bilan tanlanadi:
#   feruza/jonli -> uzbek100 modeli (umumiy, reference almashinadi)
#   ayol         -> 1571110404 (01) speakerga ATALGAN model (yosh/mayin, x->kh baked-in)
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
DATA_ROOT = Path(str(files("f5_tts").joinpath("../../data"))).resolve()
# DEPLOY checkpoint = ISSAI+Feruza (43s) qayta o'rgatilgan model_34000 (ASR-WER: 24%→15%).
# Training davom etsa ckpts/uzbek/ o'zgaradi, lekin bu nusxa BARQAROR (ustiga yozilmaydi).
DEPLOY_CKPT = Path(str(files("f5_tts").joinpath("../../ckpts/uzbek_deploy.pt"))).resolve()

# ── Modellar (har biri alohida fine-tune: checkpoint + vocab) ──
# VRAM yetarli bo'lsa kerakli modellar startup'da yuklanadi. F5_CKPT env faqat uzbek100'ни
# almashtiradi (tarixiy default, moslik uchun).
MODELS = {
    "uzbek100": {"dir": "uzbek100", "vocab": DATA_ROOT / "feruza_char" / "vocab.txt",
                 "deploy": DEPLOY_CKPT, "env": "F5_CKPT", "fallback": CKPT_PREF},
    "ayol": {"dir": "ayol", "vocab": DATA_ROOT / "ayol_char" / "vocab.txt",
             "deploy": None, "env": None, "fallback": []},
}

# ── Ovozlar (UI tanlovlari): voice -> model + reference + x->kh rejimi ──
# F5 voice-cloning: tanlangan klip tembri/ohangida gapiradi.
#   feruza = #1 audition (tabiiy/tinch), jonli = 05 (ifodali) — ikkalasi uzbek100 modelida.
#   ayol   = 1571110404 (01) speakerning O'Z klipi + O'Z modeli (mayin/yosh).
# x2kh: "init" = so'z boshidagi x (F5_FIX_X env, default o'chiq) | "all" = barcha x->kh
#       (ayol modeli butun x'ni kh deb o'rgangan — training bilan AYNAN).
# F5_REF_WAV/F5_REF_TXT env bo'lsa "feruza"ni almashtiradi (eski xulq, moslik uchun).
# seed: None = har so'rovda random (variativ/tabiiyroq). Butun son = FIKS seed (barqaror,
#   takrorlanuvchan). ayol=99: scripts/_ayol_seed_sweep.py (8 seed x 5 qiyin jumla, ASR-WER)
#   bilan tanlandi — avg 24%, worst 50% (random/1234'dan yaxshi: katastrofik xato kamroq).
#   F5_SEED env hamma ovozni majburan almashtiradi (eski xulq).
VOICE_CFG = {
    "feruza": {"model": "uzbek100",
               "wav": Path(os.environ.get("F5_REF_WAV", str(VOICES / "f5_ref_main.wav"))),
               "txt": Path(os.environ.get("F5_REF_TXT", str(VOICES / "f5_ref_main.txt"))),
               "x2kh": "init", "seed": None},
    "jonli": {"model": "uzbek100", "wav": VOICES / "f5_ref_jonli.wav",
              "txt": VOICES / "f5_ref_jonli.txt", "x2kh": "init", "seed": None},
    "ayol": {"model": "ayol", "wav": VOICES / "f5_ref_ayol.wav",
             "txt": VOICES / "f5_ref_ayol.txt", "x2kh": "all", "seed": 99},
}
DEFAULT_VOICE = "feruza"

# ── Matn normalizatsiyasi (TRAINING bilan AYNAN bir xil bo'lishi shart!) ──
# train: scripts/finalize_f5_metadata.py NORM bilan mos.
_NORM = [("﻿", ""), ("​", ""), (" ", " "),  # BOM / zero-width / nbsp — F5 buzadi
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


def fix_x_all(t: str) -> str:
    # ayol modeli uchun: BARCHA x -> kh (training metadata'si shunday normalizatsiyalangan,
    # model kh = /x/ ni o'rgangan). test_ayol_final.py norm() bilan AYNAN bir xil.
    return t.replace("X", "Kh").replace("x", "kh")


def apply_x2kh(t: str, mode: str) -> str:
    return fix_x_all(t) if mode == "all" else fix_x_pronunciation(t)


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


def resolve_ckpt(model_key: str) -> str | None:
    """Model checkpoint'ini topish. Tartib: <env> > deploy.pt > ckpts/<dir> > fallback papkalar."""
    cfg = MODELS[model_key]
    env_name = cfg.get("env")
    if env_name:
        env = os.environ.get(env_name)
        if env and Path(env).exists():
            return env
    deploy = cfg.get("deploy")
    if deploy and deploy.exists():
        return str(deploy)
    hit = _pick_from_dir(CKPTS_ROOT / cfg["dir"])
    if hit:
        return hit
    for name in cfg.get("fallback", []):
        hit = _pick_from_dir(CKPTS_ROOT / name)
        if hit:
            return hit
    # Oxirgi chora: ckpts ostidagi har qanday papka.
    if CKPTS_ROOT.exists():
        for d in sorted(CKPTS_ROOT.iterdir()):
            if d.is_dir():
                hit = _pick_from_dir(d)
                if hit:
                    return hit
    return None


# ── Model holati ──
# models: {model_key: F5TTS}, ckpts: {model_key: path}, voices: {voice: {...}}
state = {"models": {}, "ckpts": {}, "voices": {}}

def load():
    # Qaysi modellar kerak (reference'i mavjud ovozlar uchun).
    needed: dict[str, list[str]] = {}
    for v, c in VOICE_CFG.items():
        if Path(c["wav"]).exists():
            needed.setdefault(c["model"], []).append(v)
    if not needed:
        raise RuntimeError(f"Hech qanday F5 reference topilmadi: {VOICES}/f5_ref_*.wav")

    for mk, voices in needed.items():
        ckpt = resolve_ckpt(mk)
        if not ckpt:
            print(f"⚠️  F5 model '{mk}' checkpoint topilmadi — ovozlar {voices} o'tkazib yuborildi",
                  flush=True)
            continue
        vocab = MODELS[mk]["vocab"]
        vocab_s = str(vocab) if vocab.exists() else ""
        print(f"⏳ F5 model yuklanmoqda: {mk}  ckpt={ckpt}", flush=True)
        state["models"][mk] = F5TTS(model="F5TTS_v1_Base", ckpt_file=ckpt, vocab_file=vocab_s)
        state["ckpts"][mk] = ckpt

    for v, c in VOICE_CFG.items():
        if c["model"] in state["models"] and Path(c["wav"]).exists():
            txt = Path(c["txt"])
            state["voices"][v] = {
                "model": c["model"],
                "wav": str(c["wav"]),
                "text": normalize(txt.read_text(encoding="utf-8")) if txt.exists() else "",
                "x2kh": c["x2kh"],
                "seed": c.get("seed"),
            }

    if not state["models"]:
        raise RuntimeError(f"Hech qanday F5 model yuklanmadi: {CKPTS_ROOT} ostida {CKPT_PREF} yo'q")
    print(f"✅ F5 tayyor. ovozlar={list(state['voices'])} "
          f"modellar={ {k: Path(p).parent.name + '/' + Path(p).name for k, p in state['ckpts'].items()} }",
          flush=True)

app = FastAPI(title="NextTTS F5 engine")

@app.on_event("startup")
def _startup():
    load()

class SynthReq(BaseModel):
    text: str
    speed: float = 1.0
    nfe_step: int = 48  # ASR-sweep: 28%→18% WER (cfg=2.0 default eng yaxshi)
    remove_silence: bool = False
    voice: str = "feruza"  # feruza (tabiiy) | jonli (ifodali) | ayol (mayin, dedicated model)

@app.get("/health")
def health():
    ck = state["ckpts"]
    return {
        "available": bool(state["models"]),
        "engine": "f5",
        "voices": list(state["voices"]),
        "models": {k: Path(p).parent.name + "/" + Path(p).name for k, p in ck.items()},
        # backward-compat: main.py "checkpoint" kalitini o'qiydi
        "checkpoint": ck.get("uzbek100") or (next(iter(ck.values())) if ck else None),
    }

@app.post("/synthesize/f5")
def synthesize(req: SynthReq):
    if not state["models"]:
        return JSONResponse({"error": "model yuklanmagan"}, status_code=503)
    voice = req.voice if req.voice in state["voices"] else DEFAULT_VOICE
    vc = state["voices"].get(voice)
    if vc is None:
        vc = next(iter(state["voices"].values()), None)
    if vc is None:
        return JSONResponse({"error": "reference yuklanmagan"}, status_code=503)
    model = state["models"][vc["model"]]

    text = smart_lowercase(normalize(req.text))
    if not text:
        return JSONResponse({"error": "matn bo'sh"}, status_code=400)
    # Seed tartibi: F5_SEED env (global override) > ovozning fiks seed'i (VOICE_CFG, masalan
    # ayol=99 — sweep bilan tanlangan barqaror) > random (variativ). Bitta so'rov ichida
    # barcha jumlaga BIR seed (jumlalar orasida mikro-ohang sakramasin).
    env_seed = os.environ.get("F5_SEED")
    if env_seed:
        seed = int(env_seed)
    elif vc.get("seed") is not None:
        seed = int(vc["seed"])
    else:
        seed = random.randint(0, 2**31 - 1)
    t0 = time.time()
    # x -> kh: ovozga qarab (ayol = barcha x; uzbek100 = so'z boshi/F5_FIX_X).
    text = apply_x2kh(text, vc["x2kh"])
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
        w, sr, _ = model.infer(
            vc["wav"], vc["text"], onset_pad + sent,
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
    ckpt = state["ckpts"].get(vc["model"], "")
    return Response(
        content=buf.read(),
        media_type="audio/wav",
        headers={"X-Synthesis-Time-Sec": f"{dt:.2f}", "X-Engine": "f5",
                 "X-Voice": voice,
                 "X-Checkpoint": Path(ckpt).name if ckpt else ""},
    )
