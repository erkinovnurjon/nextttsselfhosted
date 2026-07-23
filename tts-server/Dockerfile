# NextTTS backend — FastAPI (MMS TTS + Whisper ASR)
# GPU: `docker run --gpus all` / compose'да deploy.resources bilan. CPU'да ham ishlaydi.
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 PYTHONIOENCODING=utf-8 HF_HUB_DISABLE_XET=1

# Audio kutubxonalari uchun system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    libsndfile1 ffmpeg git curl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Torch — CPU wheel (CPU-pilot: yengil image, MMS CPU'да ishlaydi). GPU server uchun
# cu121 wheel'ga almashtiring: --index-url https://download.pytorch.org/whl/cu121
RUN pip install --no-cache-dir torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Qolgan inference bog'liqliklari
RUN pip install --no-cache-dir \
    "fastapi" "uvicorn[standard]" "transformers==4.55.0" \
    soundfile librosa scipy numpy praat-parselmouth huggingface_hub accelerate

# Server kodi (server/) — model'lar runtime'да HF'дan yuklanadi va volume'да keshlanadi
COPY server /app/server

# Model kesh va voices papkalar (compose volume bilan ulanadi)
ENV HF_HOME=/app/.hf_cache
EXPOSE 8000

# MMS-only rejim (XTTS+parselmouth segfault bermasligi uchun)
ENV NEXTTTS_MMS_ONLY=1 MMS_DEFAULT_VOICE=base MMS_NOISE_SCALE_DURATION=0.8 MMS_POSTPROCESS=1.0

CMD ["uvicorn", "server.main:app", "--host", "0.0.0.0", "--port", "8000"]
