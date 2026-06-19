# F5 TO'LIQ dataset training: 43s (uzbek_f5) + raw ISSAI to'liq (~101s) = uzbek100.
# Warm-start uzbek70/model_last og'irligidan (eng yaxshi baza), YANGI LR jadvali.
# Maqsad: qiyin so'zlar talaffuzini yana ko'tarish (43->69s sakrashi davomi).
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/train_uzbek100.py
# PAUZA: to'xtat; DAVOM: qayta ishga tushir (ckpts/uzbek100/model_last'dan avto).
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import sys, multiprocessing
from f5_tts.train import finetune_cli

# Windows pagefile himoyasi: default num_workers=16 -> 17 python jarayon WinError 1455.
# 4 worker katta dataset uchun yetarli (training GPU-bound).
from f5_tts.model import trainer as _tm
_orig_train = _tm.Trainer.train
def _train_lowworkers(self, train_dataset, num_workers=16, resumable_with_seed=None):
    return _orig_train(self, train_dataset, num_workers=4, resumable_with_seed=resumable_with_seed)
_tm.Trainer.train = _train_lowworkers

INIT = r"C:/Projects/nexttts/tts-server/.venv-f5/Lib/ckpts/uzbek100_init.pt"
ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "uzbek100",
    "--tokenizer", "char",
    "--finetune",
    "--pretrain", INIT,
    "--learning_rate", "1e-5",
    "--batch_size_per_gpu", "3200",
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    "--epochs", "2",                   # ~17k update/epoch -> ~34k update (~20 soat); uzbek70 ~2 epochda peak qilgan
    "--num_warmup_updates", "1000",
    "--save_per_updates", "4000",      # oraliq ckpt har 4k — ertaga eng yaxshisini tanlaymiz
    "--last_per_updates", "250",
    "--keep_last_n_checkpoints", "4",  # disk: 4x3.2GB + last
    "--bnb_optimizer",
    "--logger", "tensorboard",
]
if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print("F5 uzbek100 (to'liq ISSAI) fine-tune:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
