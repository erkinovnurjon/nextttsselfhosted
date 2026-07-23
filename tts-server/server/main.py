"""
NextTTS FastAPI server — entry point.

Next.js frontend bu serverga so'rov yuboradi va sintezlangan WAV audio'ni
qaytaradi. Endpointlar mavzu bo'yicha router'larga ajratilgan:

    server/config.py          — yo'llar, konstantalar, muhit, mikroservis URL'lari
    server/state.py           — yuklangan model holati (singleton)
    server/model_loader.py    — XTTS checkpoint topish/yuklash + load_model
    server/schemas.py         — Pydantic so'rov sxemalari
    server/routers/meta.py    — /, /health, /voices, /languages, /checkpoints, /samples
    server/routers/training.py    — /training/status
    server/routers/synthesis.py   — /synthesize, /synthesize/{f5,piper,mms}, /transcribe
    server/routers/reference.py   — /reference/build

Ishga tushirish:
    cd tts-server
    .venv/Scripts/uvicorn server.main:app --host 0.0.0.0 --port 8000 --reload

yoki PowerShell'da:
    .\.venv\Scripts\activate
    uvicorn server.main:app --port 8000
"""

# config BIRINCHI import qilinadi: muhit o'zgaruvchilari (UTF-8, Coqui TOS) va
# sys.path TTS/scripts import qilinishidan oldin sozlanadi.
import server.config  # noqa: F401

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from server.model_loader import load_model
from server.routers import meta, training, synthesis, reference


@asynccontextmanager
async def lifespan(_app: FastAPI):
    load_model()
    yield


app = FastAPI(
    title="NextTTS API",
    description="O'zbek tilida self-hosted TTS — XTTS v2 voice cloning",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(meta.router)
app.include_router(training.router)
app.include_router(synthesis.router)
app.include_router(reference.router)
