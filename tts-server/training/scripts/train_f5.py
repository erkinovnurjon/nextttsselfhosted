# F5-TTS fine-tune launcher (RTX 3060, lokal).
# MUHIM 1: pyarrow/datasets'ni torchaudio'дан oldin import (Windows DLL segfault'ini oldini olish).
# MUHIM 2: Windows'da DataLoader worker'lari spawn bo'ladi -> __main__ himoyasi shart.
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401

import sys
import multiprocessing
from f5_tts.train import finetune_cli

# Fine-tune sozlamalari — FeruzaSpeech (13.38h, char tokenizer, base vocab 2545).
ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "feruza",
    "--tokenizer", "char",
    "--finetune",                      # base model_1250000.safetensors'дан boshlaydi
    "--learning_rate", "1e-5",
    "--batch_size_per_gpu", "3200",    # frame; OOM bo'lsa kamaytiriladi
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    "--epochs", "50",
    "--num_warmup_updates", "1000",    # default 20000 — bizning hajmga juda katta
    "--save_per_updates", "2000",      # har 2000 update'da checkpoint
    "--last_per_updates", "500",
    "--keep_last_n_checkpoints", "3",
    "--bnb_optimizer",                 # 8-bit Adam — VRAM tejaydi
    "--logger", "tensorboard",
]

if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print("F5 fine-tune boshlanmoqda:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
