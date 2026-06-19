# DEDICATED single-speaker F5 fine-tune: 1571110404 (tanlangan AYOL, ~1400 klip ~3h).
# Warm-start uzbek70/model_last (eng yaxshi WER) og'irligidan, YANGI LR jadvali.
# Maqsad: F5 ohangi + shu ovozda mustahkam/bexato talaffuz (zich bitta-speaker signal).
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/train_ayol.py
# PAUZA: to'xtat; DAVOM: qayta ishga tushir (ckpts/ayol/model_last'dan avto).
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import sys, multiprocessing
from f5_tts.train import finetune_cli

# Windows pagefile himoyasi: trainer default num_workers=16 -> 17 python jarayon torch DLL
# yuklab WinError 1455 (pagefile yetmadi) beradi. 2 worker yetarli (training GPU-bound).
from f5_tts.model import trainer as _tm
_orig_train = _tm.Trainer.train
def _train_lowworkers(self, train_dataset, num_workers=16, resumable_with_seed=None):
    # num_workers=1: F5 persistent_workers=True talab qiladi (>0 shart). 1 worker = 2 torch
    # jarayon (2 worker'dan kam pagefile). 0 worker ValueError berardi.
    return _orig_train(self, train_dataset, num_workers=1, resumable_with_seed=resumable_with_seed)
_tm.Trainer.train = _train_lowworkers

INIT = r"C:/Projects/nexttts/tts-server/.venv-f5/Lib/ckpts/ayol_init.pt"
ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "ayol",
    "--tokenizer", "char",
    "--finetune",
    "--pretrain", INIT,
    "--learning_rate", "7e-6",        # kichik dataset — ehtiyotkor LR (katastrofik unutishdan)
    "--batch_size_per_gpu", "3200",
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    # FAQAT ~0.95h data (777 klip) -> uzun trening OVERFIT qiladi. ~109 upd/epoch.
    # epochs 30 ~= 3270 update (~3h). Warm-start bor — tembr+x→kh shunda o'rganiladi.
    "--epochs", "30",
    "--num_warmup_updates", "300",
    "--save_per_updates", "2000",      # milestone 2000 + model_last(~3270) = 2 nuqta tanlash uchun
    "--last_per_updates", "200",
    "--keep_last_n_checkpoints", "1",  # DISK: pagefile+ckpt ~3.3GB; 1 milestone + model_last + pretrained
    "--bnb_optimizer",
    "--logger", "tensorboard",
]
if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print("F5 AYOL (1571110404) dedicated fine-tune:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
