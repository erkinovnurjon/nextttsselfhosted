"""Model holati — singleton (RAM/VRAM'da yuklangan model uchun cache)."""

# `loaded_checkpoint` — hozir RAM/VRAM'da turgan fine-tuned model uchun cache:
# {"id": "...", "path": Path, "model": Xtts, "config": XttsConfig}
state = {
    "tts": None,
    "loaded_checkpoint": None,
    "model_kind": "base",     # "base" yoki "finetuned"
    "device": "cpu",
    "model_load_time": None,
}
