# F5 ~70 soat TEST training (43s + 27s raw ISSAI). Warm-start model_34000 og'irligidan,
# YANGI LR jadvali bilan. Maqsad: ko'proq data talaffuzni (x/g'/k/ch/ng) qanchaga
# yaxshilashini ko'rish. Yoqsa -> to'liq 105s'ga.
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/train_uzbek70.py
# PAUZA: to'xtat; DAVOM: qayta ishga tushir (ckpts/uzbek70/model_last'dan avto).
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import sys, multiprocessing
from f5_tts.train import finetune_cli

INIT = r"C:/Projects/nexttts/tts-server/.venv-f5/Lib/ckpts/uzbek70_init.pt"
ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "uzbek70",
    "--tokenizer", "char",
    "--finetune",
    "--pretrain", INIT,
    "--learning_rate", "1e-5",
    "--batch_size_per_gpu", "3200",
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    "--epochs", "8",
    "--num_warmup_updates", "1000",
    "--save_per_updates", "2000",
    "--last_per_updates", "200",
    "--keep_last_n_checkpoints", "5",
    "--bnb_optimizer",
    "--logger", "tensorboard",
]
if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print("F5 uzbek70 (~70s) test fine-tune:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
