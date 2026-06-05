"""
overnight_feruza.py
===================

Tunги avtonom watcher: FeruzaSpeech (k2speech/FeruzaSpeech) HF tasdig'ini kutadi.
Ochilishi bilan AVTOMATIK:
  1. 60h datasetni yuklaydi
  2. TSV (kirill transkript) -> HF DatasetDict tayyorlaydi
  3. MMS'ni fine-tune qiladi (toza, professional ayol -> ravon/tiniq/shirali)
  4. Model: training/checkpoints/mms_uzb_ft_feruza
  5. Tugagach DONE log — keyin server MMS_AYOL_DIR bilan qayta yoqiladi.

Hammasi feruza_overnight.log ga yoziladi. Max ~11.5 soat, har 20 daqiqada tekshiradi.

GPU kerak (training paytida) — shu sababli tun davomida /sinov CPU rejimda ishlasin.
"""

import os, sys, time, json, subprocess, traceback
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["HF_HUB_DISABLE_SYMLINKS_WARNING"] = "1"
sys.stdout.reconfigure(encoding="utf-8")

REPO = "k2speech/FeruzaSpeech"
ROOT = Path(__file__).resolve().parents[2]          # tts-server
PROJ = ROOT.parent
DATA = ROOT / "training" / "data" / "feruza"
HF_OUT = ROOT / "training" / "data" / "feruza_hf"
CKPT = ROOT / "training" / "checkpoints" / "mms_uzb_ft_feruza"
FT_REPO = ROOT / "training" / "finetune-hf-vits"
CONFIG = FT_REPO / "config_feruza.json"
BASE_TRAIN = FT_REPO / "mms-uzb-cyr-train"
LOG = ROOT / "training" / "data" / "feruza_overnight.log"

CHECK_EVERY = 1200      # 20 daqiqa
MAX_HOURS = 11.5
MIN_SEC, MAX_SEC = 1.0, 12.0


def log(msg):
    line = f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line, flush=True)
    with open(LOG, "a", encoding="utf-8") as f:
        f.write(line + "\n")


def has_access() -> bool:
    from huggingface_hub import hf_hub_download
    try:
        hf_hub_download(REPO, "train.tsv", repo_type="dataset")
        return True
    except Exception as e:
        log(f"hali yopiq: {str(e)[:80]}")
        return False


def download():
    from huggingface_hub import snapshot_download
    DATA.mkdir(parents=True, exist_ok=True)
    log("⬇️  FeruzaSpeech yuklanmoqda (60h, bir necha GB)...")
    snapshot_download(REPO, repo_type="dataset", local_dir=str(DATA))
    log("✅ Yuklab bo'lindi")


def _find_col(header, *keys):
    for i, h in enumerate(header):
        hl = h.lower()
        if any(k in hl for k in keys):
            return i
    return None


def prepare():
    import csv
    from datasets import Dataset, DatasetDict, Audio

    audio_paths, texts = [], []
    for tsv_name in ["train.tsv", "dev.tsv"]:
        tsv = DATA / tsv_name
        if not tsv.exists():
            continue
        rows = list(csv.reader(open(tsv, encoding="utf-8"), delimiter="\t"))
        if not rows:
            continue
        header = rows[0]
        ai = _find_col(header, "audio", "path", "wav", "file")
        ci = _find_col(header, "cyr", "kiril", "кир")
        if ci is None:
            ci = _find_col(header, "text", "transcri", "sentence")
        log(f"{tsv_name}: header={header} | audio_col={ai} text_col={ci}")
        if ai is None or ci is None:
            continue
        for r in rows[1:]:
            if len(r) <= max(ai, ci):
                continue
            ap = (DATA / r[ai]).resolve()
            if not ap.exists():
                # ba'zan yo'l 'audio/..' yoki to'g'ridan-to'g'ri
                alt = list(DATA.rglob(Path(r[ai]).name))
                if alt:
                    ap = alt[0]
                else:
                    continue
            txt = r[ci].strip()
            if len(txt) < 3:
                continue
            audio_paths.append(str(ap))
            texts.append(txt)

    log(f"📊 {len(audio_paths)} ta yozuv tayyorlandi")
    if len(audio_paths) < 100:
        raise RuntimeError("Juda kam yozuv — TSV format mos kelmadi")
    ds = Dataset.from_dict({"audio": audio_paths, "text": texts})
    ds = ds.cast_column("audio", Audio(sampling_rate=16000))
    DatasetDict({"train": ds}).save_to_disk(str(HF_OUT))
    log(f"✅ HF dataset: {HF_OUT}")


def write_config():
    cfg = {
        "project_name": "mms_uzb_feruza", "push_to_hub": False, "overwrite_output_dir": True,
        "output_dir": str(CKPT).replace("\\", "/"),
        "dataset_name": str(HF_OUT).replace("\\", "/"),
        "audio_column_name": "audio", "text_column_name": "text",
        "train_split_name": "train", "eval_split_name": "train",
        "full_generation_sample_text": "янги очилган мактабда мингта ўқувчи илм олади",
        "max_duration_in_seconds": MAX_SEC, "min_duration_in_seconds": MIN_SEC,
        "max_tokens_length": 500,
        "model_name_or_path": str(BASE_TRAIN).replace("\\", "/"),
        "preprocessing_num_workers": 4, "dataloader_num_workers": 2,
        "do_train": True, "num_train_epochs": 4, "gradient_accumulation_steps": 1,
        "per_device_train_batch_size": 8, "learning_rate": 2e-5,
        "adam_beta1": 0.8, "adam_beta2": 0.99, "warmup_ratio": 0.02,
        "do_eval": True, "eval_steps": 1000, "per_device_eval_batch_size": 8,
        "max_eval_samples": 8, "do_step_schedule_per_epoch": True,
        "save_steps": 1000, "save_total_limit": 3, "logging_steps": 50,
        "weight_disc": 3, "weight_fmaps": 1, "weight_gen": 1, "weight_kl": 1.5,
        "weight_duration": 1, "weight_mel": 35, "fp16": True, "seed": 456,
    }
    CONFIG.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    log(f"✅ Config: {CONFIG}")


def train():
    py = str(ROOT / ".venv" / "Scripts" / "python.exe")
    log("🚀 Training boshlandi (bir necha soat)...")
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    r = subprocess.run([py, "run_vits_finetuning.py", CONFIG.name],
                       cwd=str(FT_REPO), env=env,
                       stdout=open(ROOT / "training" / "data" / "feruza_train.log", "w", encoding="utf-8"),
                       stderr=subprocess.STDOUT)
    if r.returncode == 0 and (CKPT / "model.safetensors").exists():
        log(f"✅✅ TRAINING TUGADI! Model: {CKPT}")
        log("➡️  Serverni MMS_AYOL_DIR bilan qayta yoqing — ayol = Feruza.")
        return True
    log(f"❌ Training xato (code {r.returncode})")
    return False


def main():
    log("=== Tunги FeruzaSpeech watcher boshlandi ===")
    t0 = time.time()
    while (time.time() - t0) < MAX_HOURS * 3600:
        if has_access():
            log("✅ FERUZASPEECH OCHILDI! Pipeline boshlanadi.")
            try:
                download(); prepare(); write_config()
                if train():
                    log("=== TAYYOR — ayol ovoz Feruza bilan ===")
                    return
            except Exception:
                log("❌ Pipeline xatosi:\n" + traceback.format_exc())
                return
        time.sleep(CHECK_EVERY)
    log("=== Watcher tugadi: FeruzaSpeech ochilmadi (tasdiq kelmadi) ===")


if __name__ == "__main__":
    main()
