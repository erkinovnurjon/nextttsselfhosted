"""
NextTTS server konfiguratsiyasi — yo'llar, konstantalar, mikroservis URL'lari.

MUHIM: bu modul boshqa server modullaridan OLDIN import qilinadi. Muhit
o'zgaruvchilari (UTF-8, Coqui TOS) va sys.path TTS/scripts import qilinishidan
oldin sozlanishi shart — shu sabab ular shu yerda, import paytida o'rnatiladi.
"""

import os
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["COQUI_TOS_AGREED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[2]
VOICES_DIR = PROJECT_ROOT / "tts-server" / "voices"
SAMPLES_DIR = VOICES_DIR / "samples"
DEFAULT_REFERENCE = VOICES_DIR / "main" / "reference.wav"
CHECKPOINTS_DIR = PROJECT_ROOT / "tts-server" / "training" / "checkpoints" / "xtts_v2_uzbek"
XTTS_CACHE = Path.home() / "AppData" / "Local" / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"

# Make scripts importable (scripts.prepare_reference, server.*)
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

# Training jarayoni loglari (Status sahifasi parse qiladi)
TRAIN_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "train_log.txt"
PIPELINE_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "pipeline_log.txt"
EXTEND_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "extend_log.txt"

# Mikroservislar — alohida venv'larda, boshqa portlarda ishlaydi, shu yerdan proxy qilinadi.
# F5-TTS (Feruza) — tabiiy/mayin ayol ovozi (:8001, .venv-f5).
F5_SERVER_URL = os.environ.get("F5_SERVER_URL", "http://127.0.0.1:8001")
# Piper-TTS — nativ o'zbek ovozi (:8002, venv-piper, CPU).
PIPER_SERVER_URL = os.environ.get("PIPER_SERVER_URL", "http://127.0.0.1:8002")

SUPPORTED_LANGS = {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "it": "Italian",
    "pt": "Portuguese",
    "pl": "Polish",
    "tr": "Turkish (o'zbek uchun eng yaqin)",
    "ru": "Russian",
    "nl": "Dutch",
    "cs": "Czech",
    "ar": "Arabic",
    "zh-cn": "Chinese",
    "ja": "Japanese",
    "hu": "Hungarian",
    "ko": "Korean",
    "hi": "Hindi",
}
