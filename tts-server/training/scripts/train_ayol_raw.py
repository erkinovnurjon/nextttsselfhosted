# DEDICATED single-speaker F5 fine-tune: 1571110404 (mayin AYOL), XOM matn (kh'siz).
# train_ayol.py ning aynan nusxasi, FARQ: dataset_name=ayol_raw (xom x/gʻ). Warm-start
# uzbek100 ema (ayol_init.pt) — uzbek100 xom x/gʻ'ni to'g'ri o'qiydi, model tembr+x'ni saqlaydi.
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/train_ayol_raw.py
# PAUZA/DAVOM: ckpts/ayol_raw/model_last'dan avto-resume.
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import sys, multiprocessing
from f5_tts.train import finetune_cli

# Windows pagefile himoyasi: num_workers=1 (2+ -> WinError 1455 pagefile).
from f5_tts.model import trainer as _tm
_orig_train = _tm.Trainer.train
def _train_lowworkers(self, train_dataset, num_workers=16, resumable_with_seed=None):
    return _orig_train(self, train_dataset, num_workers=1, resumable_with_seed=resumable_with_seed)
_tm.Trainer.train = _train_lowworkers

INIT = r"C:/Projects/nexttts/tts-server/.venv-f5/Lib/ckpts/ayol_init.pt"
ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "ayol_raw",
    "--tokenizer", "char",
    "--finetune",
    "--pretrain", INIT,
    "--learning_rate", "7e-6",        # kichik dataset — ehtiyotkor LR
    "--batch_size_per_gpu", "3200",
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    "--epochs", "30",                  # ~109 upd/epoch -> ~3270 upd (~3.4h)
    "--num_warmup_updates", "300",
    "--save_per_updates", "2000",      # milestone 2000 + model_last(~3270) = taqqoslash uchun
    "--last_per_updates", "200",
    "--keep_last_n_checkpoints", "1",  # DISK: 23GB bo'sh — 1 milestone + last + pretrained
    "--bnb_optimizer",
    "--logger", "tensorboard",
]
if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print("F5 AYOL XOM (1571110404, kh'siz) fine-tune:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
