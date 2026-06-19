# F5-TTS uzbek fine-tune — Feruza+ISSAI (~43s, 27986 klip, ko'p-spiker).
# WARM-START: model_last og'irliklaridan (uzbek_warmstart_init.pt) YANGI LR jadvali bilan.
# Maqsad: o'zbekchani ancha yaxshi o'qish; ovoz #1 reference orqali sintezda beriladi.
#
# Ishga tushirish (backend GPU'ni band qilmasligi uchun :8001 F5 serverни to'xtatib):
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/train_uzbek.py
#
# PAUZA: jarayonni to'xtat (Ctrl+C / TaskStop). DAVOM: shu skriptni qayta ishga tushir —
# ckpts/uzbek/model_last.pt'dan AVTOMATIK davom etadi (boshidan emas).
import pyarrow.dataset  # noqa: F401  (torchaudio'dan oldin)
import datasets  # noqa: F401

import sys
import multiprocessing
from f5_tts.train import finetune_cli

INIT = r"C:/Projects/nexttts/tts-server/.venv-f5/Lib/ckpts/uzbek_warmstart_init.pt"

ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "uzbek",          # -> data/uzbek_char/, ckpts/uzbek/
    "--tokenizer", "char",
    "--finetune",
    "--pretrain", INIT,                 # warm-start (faqat og'irlik, fresh schedule)
    "--learning_rate", "1e-5",
    "--batch_size_per_gpu", "3200",
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    "--epochs", "10",
    "--num_warmup_updates", "1000",
    "--save_per_updates", "2000",       # test nuqtalari
    "--last_per_updates", "200",        # PAUZA xavfsizligi — har 200 qadam
    "--keep_last_n_checkpoints", "5",
    "--bnb_optimizer",
    "--logger", "tensorboard",
]

if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print("F5 uzbek (Feruza+ISSAI) fine-tune:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
