# DEDICATED single-speaker F5 fine-tune QAYTA: 1571110404 (777 klip, 0.95h),
# endi uzbek100 (to'liq ISSAI, WER 8%) bazasidan. Maqsad: yangi bazaning aniq
# o'qishi + dedicated ovoz mustahkamligi. ~12k update'da TO'XTAYDI — birinchi
# ayol runda 9-12k sweet-spot, 26k overfit ekani isbotlangan.
#   cd tts-server
#   KMP_DUPLICATE_LIB_OK=TRUE PYTHONUTF8=1 .venv-f5/Scripts/python.exe training/scripts/train_ayol2.py
# PAUZA: to'xtat; DAVOM: qayta ishga tushir (ckpts/ayol2/model_last'dan avto).
import pyarrow.dataset  # noqa: F401
import datasets  # noqa: F401
import json, sys, multiprocessing
from importlib.resources import files
from pathlib import Path
from f5_tts.train import finetune_cli

# Windows pagefile himoyasi: trainer default num_workers=16 -> WinError 1455.
from f5_tts.model import trainer as _tm
_orig_train = _tm.Trainer.train
def _train_lowworkers(self, train_dataset, num_workers=16, resumable_with_seed=None):
    return _orig_train(self, train_dataset, num_workers=2, resumable_with_seed=resumable_with_seed)
_tm.Trainer.train = _train_lowworkers

INIT = r"C:/Projects/nexttts/tts-server/.venv-f5/Lib/ckpts/ayol2_init.pt"

# ~12k update nishon (birinchi ayol runda 9-12k sweet-spot, 26k overfit). Dataset endi
# vaznli (oversample+replay) — epoch sonini umumiy davomiylikdan hisoblaymiz:
# batch 3200 frame ~ 34s audio -> upd/epoch ~ total_sec/34.
_DUR = Path(str(files("f5_tts").joinpath("../../data/ayol2_char/duration.json"))).resolve()
_total_sec = sum(json.loads(_DUR.read_text(encoding="utf-8"))["duration"])
_upd_per_epoch = max(1, int(_total_sec / 34))
EPOCHS = max(8, min(300, round(12000 / _upd_per_epoch)))

ARGS = [
    "finetune_cli",
    "--exp_name", "F5TTS_v1_Base",
    "--dataset_name", "ayol2",
    "--tokenizer", "char",
    "--finetune",
    "--pretrain", INIT,
    "--learning_rate", "7e-6",        # kichik dataset — ehtiyotkor LR
    "--batch_size_per_gpu", "3200",
    "--batch_size_type", "frame",
    "--max_samples", "64",
    "--grad_accumulation_steps", "1",
    "--epochs", str(EPOCHS),           # dinamik: ~12k update nishon (26k overfit edi)
    "--num_warmup_updates", "300",
    "--save_per_updates", "3000",      # 3k/6k/9k/12k + last — sweet-spot oralig'ini qamraydi
    "--last_per_updates", "200",
    "--keep_last_n_checkpoints", "10",
    "--bnb_optimizer",
    "--logger", "tensorboard",
]
if __name__ == "__main__":
    multiprocessing.freeze_support()
    sys.argv = ARGS
    print(f"dataset: {_total_sec/3600:.2f} soat, ~{_upd_per_epoch} upd/epoch, epochs={EPOCHS} "
          f"(~{_upd_per_epoch*EPOCHS} update)", flush=True)
    print("F5 AYOL2 (1571110404, uzbek100 bazadan) fine-tune:", " ".join(ARGS[1:]), flush=True)
    finetune_cli.main()
