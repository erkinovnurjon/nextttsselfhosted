# F5-TTS inference mikroservisi (port 8001, .venv-f5 muhitida ishlaydi).
# Asosiy backend (.venv, :8000) bundan alohida — main.py /synthesize/f5'ni shu yerga proxy qiladi.
#
# Ko'p-modelli: bir nechta F5 fine-tune (har biri alohida checkpoint+vocab) bir vaqtda
# yuklanadi, "voice" parametri bilan tanlanadi:
#   feruza/jonli/ayol -> uzbek100 modeli (umumiy; reference klip almashinadi)
#   ayol = speaker-01 (1571110404) ref bilan zero-shot klon, XOM matn (x/gʻ to'g'ri).
#   (Eski dedicated kh-model "ayol" o'chirildi — x'ni buzardi; ckpts/ayol qoldi, ishlatilmaydi.)
#
# Matn normalizatsiya (f5lib/textnorm.py) va audio trim (f5lib/audio.py) alohida modullarda.
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

# ── Determinizm ──  F5 diffuziyasi jarayonlar orasida CUDA-nondeterminizm beradi: fiks seed
# bitta server-jarayonida yaxshi, qayta ishga tushirilganda buzilishi mumkin. Quyidagi rejim
# seed natijasini RESTART'lar orasida ham takrorlanadigan qiladi (ayol seed=555 shu rejimda,
# det-sweep bilan tanlangan — barcha qiyin x/gʻ jumlalar 0% WER). CUBLAS env torch'dan OLDIN.
os.environ.setdefault("CUBLAS_WORKSPACE_CONFIG", ":4096:8")
import torch  # noqa: E402
torch.use_deterministic_algorithms(True, warn_only=True)
torch.backends.cudnn.deterministic = True
torch.backends.cudnn.benchmark = False

import numpy as np
import soundfile as sf
from fastapi import FastAPI
from fastapi.responses import JSONResponse, Response
from pydantic import BaseModel
from f5_tts.api import F5TTS

# Matn normalizatsiya + audio trim — f5lib paketida (og'ir deps yo'q, import tartibiga
# ta'sirsiz). f5_tts import'idan KEYIN qo'yildi (tartib o'zgarmasin).
from f5lib.textnorm import normalize, smart_lowercase, apply_pron_fix, apply_x2kh, split_sentences
from f5lib.audio import _trim_lead_silence, _trim_carrier

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
    # ayol = uzbek100 zero-shot klon, XOM matn (kh YO'Q — uzbek100 x/gʻ'ni o'zi to'g'ri o'qiydi).
    # 2026-06-23 YAKUNIY: reference = speaker-01 (sevimli mayin tembr) klipining ~4.5s
    #   TRIM'i + audioga AYNAN mos matn (Whisper bilan). SABOQ: F5 reference matni audiodan
    #   qisqa bo'lsa unlilarni (i) cho'zadi → trim+mos matn buni tuzatadi. speaker-01'ning x'i
    #   o'zidan to'g'ri (kh). 671820432 (boshqa speaker) i'ni tuzatdi-yu x'ni "iks" qildi (klipда
    #   x yo'q) → speaker-01 trim eng yaxshisi: x=kh VA i tabiiy. seed=99. Full ref bak'da.
    "ayol": {"model": "uzbek100", "wav": VOICES / "f5_ref_ayol.wav",
             "txt": VOICES / "f5_ref_ayol.txt", "x2kh": "init", "seed": 99},
}
DEFAULT_VOICE = "feruza"


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

def _warmup():
    """Cold-start: F5'ning BIRINCHI inference'i CUDA kernellarni isitadi (~147s!). Startup'da
    bir marta qisqa bo'sh sintez qilib, REAL birinchi so'rovni tez qilamiz. Sifatga ta'sir yo'q."""
    try:
        v = state["voices"].get(DEFAULT_VOICE) or next(iter(state["voices"].values()), None)
        if v is None:
            return
        state["models"][v["model"]].infer(
            v["wav"], v["text"], "salom dunyo", nfe_step=8,
            show_info=lambda *a, **k: None,
        )
        print("✅ F5 warmup tugadi — cold-start o'ldirildi", flush=True)
    except Exception as e:
        print(f"⚠️ F5 warmup xato (zararsiz): {e}", flush=True)


@app.on_event("startup")
def _startup():
    load()
    _warmup()

class SynthReq(BaseModel):
    text: str
    speed: float = 1.0
    nfe_step: int = 48  # ASR-sweep: 28%→18% WER (cfg=2.0 default eng yaxshi)
    remove_silence: bool = False
    voice: str = "feruza"  # feruza (tabiiy) | jonli (ifodali) | ayol (mayin, dedicated model)
    # ── Per-user ZERO-SHOT klon ──
    # ref_wav berilsa, VOICE_CFG'ni chetlab o'tamiz: uzbek100 modeli + foydalanuvchining
    # o'z reference klipi (Next.js /api/tts DB'dan beradi — mijozdan EMAS). Qo'shimcha model
    # yuklash yo'q, faqat reference almashadi → soniyalarda "mening ovozim".
    ref_wav: str | None = None
    ref_text: str | None = None       # reference klip transkripti
    seed: int | None = None           # None = random (tabiiy variatsiya)
    onset: bool = True                # False = onset-pad ", " o'chadi (boshidagi g'aliz tovushni sinash uchun)
    # ── Onset strategiya sweep (boshidagi "noaniq so'z"ni yo'qotish uchun) ──
    onset_text: str | None = None     # onset prefiksini literal override (", " | ". " | "" ...)
    onset_carrier: str | None = None  # tashlab yuboriladigan karrier so'z (masalan "Eshiting, ") — keyin kesiladi
    ref_suffix: str | None = None     # ref_text oxiriga qo'shiladi (ref/gen chokkasini yumshatish, masalan ". ")


class CloneExtractReq(BaseModel):
    # source = URL (yt-dlp yuklaydi) YOKI shu mashinadagi media fayl yo'li (video/audio).
    source: str
    # out_path = ajratilgan reference.wav saqlanadigan yo'l (Next.js user_{id}/reference.wav beradi).
    out_path: str
    use_demucs: bool = True            # False = manba allaqachon toza nutq (ajratish shart emas)


@app.post("/clone/extract")
def clone_extract(req: CloneExtractReq):
    """
    Mediadan (video/qo'shiq) klonlash uchun toza ovoz reference ajratadi.

    Pipeline scripts/extract_voice.py'da: yt-dlp -> ffmpeg -> Demucs -> segment.
    Natija out_path'ga yoziladi; transkripsiya (ref_text) Next.js tomonidan
    main :8000 /transcribe orqali alohida olinadi.
    """
    import sys as _sys
    scripts_dir = str(ROOT / "scripts")
    if scripts_dir not in _sys.path:
        _sys.path.insert(0, scripts_dir)
    try:
        from extract_voice import extract
    except Exception as e:
        return JSONResponse({"error": f"extract_voice import xatosi: {e}"}, status_code=500)

    out = Path(req.out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    try:
        meta = extract(req.source, out, use_demucs=req.use_demucs)
    except ValueError as e:
        # Sifat darvozasi (masalan "yetarli nutq topilmadi") — foydalanuvchiga to'g'ridan ko'rsatiladi.
        return JSONResponse({"error": str(e)}, status_code=422)
    except Exception as e:
        return JSONResponse({"error": f"ajratish xatosi: {e}"}, status_code=500)
    return meta


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
    # ── Per-user zero-shot klon: ref_wav berilsa VOICE_CFG'ni chetlab o'tamiz ──
    if req.ref_wav:
        ref_path = Path(req.ref_wav)
        if not ref_path.is_file():
            return JSONResponse({"error": f"reference topilmadi: {req.ref_wav}"},
                                status_code=400)
        mk = "uzbek100" if "uzbek100" in state["models"] else next(iter(state["models"]))
        vc = {
            "model": mk,
            "wav": str(ref_path),
            "text": normalize(req.ref_text or ""),  # load() bilan bir xil (smart_lowercase'siz)
            "x2kh": "init",   # uzbek100 xom x/gʻ'ni o'zi to'g'ri o'qiydi
            "seed": req.seed,
        }
        voice = "myvoice"
    else:
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
    # Talaffuz lug'ati: muammoli x-so'zlar (tarix -> tarih) — model "ks" buzilishini tuzatadi.
    text = apply_pron_fix(text)
    # x -> kh: ovozga qarab (ayol = barcha x; uzbek100 = so'z boshi/F5_FIX_X).
    text = apply_x2kh(text, vc["x2kh"])
    # Jumlama-jumla — har birini alohida sintez qilib, orasiga qisqa jimlik qo'shamiz.
    sentences = split_sentences(text)
    # Onset-pad: gap BOSHIDAGI birinchi so'z F5'da beqaror (xabar->sabr, xavfsizlik->
    # savsizlik, hatto "ha baribir" gallyutsinatsiya). Jumla boshiga ", " qo'ysak model
    # avval mikro-pauza oladi va birinchi so'z omon qoladi (ASR-eval 2 model x 4 gap x
    # 3 seed: 1-so'z to'g'ri 7/12 -> 12/12). Narxi: ba'zan juda qisqa onset tovushi.
    # F5_ONSET_PAD=0 bilan o'chadi.
    # Onset strategiya: karrier so'z > onset_text override > ", " (default) > "" (o'chiq).
    # Karrier ishlatilsa boshidagi karrierни _trim_carrier kesadi; aks holda konservativ trim.
    if req.onset_carrier:
        onset_pad, trim_fn = req.onset_carrier, _trim_carrier
    elif req.onset_text is not None:
        onset_pad, trim_fn = req.onset_text, _trim_lead_silence
    else:
        onset_pad = ", " if (req.onset and os.environ.get("F5_ONSET_PAD", "1") != "0") else ""
        trim_fn = _trim_lead_silence
    # ref_text: ref/gen chokkasini yumshatish uchun oxiriga ref_suffix (masalan ". ") qo'shsa bo'ladi.
    ref_text_eff = (vc["text"].rstrip() + req.ref_suffix) if req.ref_suffix else vc["text"]
    parts, sr = [], 24000
    prev_end = ""
    for sent in sentences:
        w, sr, _ = model.infer(
            vc["wav"], ref_text_eff, onset_pad + sent,
            nfe_step=req.nfe_step, speed=req.speed, remove_silence=req.remove_silence,
            seed=seed, show_info=lambda *a, **k: None,
        )
        if parts:
            # Pauza tinish belgisiga mos (savol/undov uzunroq). KAMAYTIRILDI: ilgari
            # 0.3-0.45 jumlalar orasini robotsimon/uzuq-yuluq qilardi.
            pause = {"?": 0.32, "!": 0.32, ".": 0.2}.get(prev_end, 0.16)
            parts.append(np.zeros(int(pause * sr), dtype="float32"))
        # HAR segment boshidagi onset-pad sukunatини kesamiz — aks holda har jumla orasida
        # qo'shimcha pauza chiqib uzuq-yuluq bo'ladi (birinchi-so'z himoyasi saqlanadi).
        parts.append(trim_fn(np.asarray(w, dtype="float32"), sr))
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
