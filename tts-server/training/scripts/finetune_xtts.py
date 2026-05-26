"""
XTTS v2 fine-tuning — Coqui rasmiy demo (TTS.demos.xtts_ft_demo.utils.gpt_train) asosida.

O'rgatadi: GPT layer (decoder/DVAE qotirilgan).
Til kodi: tr (turk tokenizer ishlatamiz, chunki o'zbek tokeni yo'q).
Matn fonetik normalizatsiya qilingan bo'lishi kerak (extract_and_prep.py qiladi).

Hardware (RTX 3060 12GB):
- batch_size: 2 (xavfsiz), grad_accum_steps: 42 → effective 84
- 1 epoch on ~5000 samples (~10 soat audio): 4-6 soat

Foydalanish:
    python training/scripts/finetune_xtts.py
    python training/scripts/finetune_xtts.py --epochs 2 --batch 2
"""

import argparse
import gc
import os
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["COQUI_TOS_AGREED"] = "1"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
sys.path.insert(0, str(PROJECT_ROOT / "tts-server"))

TRAIN_DIR = PROJECT_ROOT / "tts-server" / "training"
DATA_DIR = TRAIN_DIR / "data"
METADATA_PATH = DATA_DIR / "metadata.csv"
CHECKPOINTS_DIR = TRAIN_DIR / "checkpoints"

# XTTS v2 model cache
XTTS_CACHE = Path.home() / "AppData" / "Local" / "tts" / "tts_models--multilingual--multi-dataset--xtts_v2"

# DVAE va mel_stats URL
DVAE_URL = "https://huggingface.co/coqui/XTTS-v2/resolve/main/dvae.pth"
MEL_NORM_URL = "https://huggingface.co/coqui/XTTS-v2/resolve/main/mel_stats.pth"


def download_if_missing(url: str, dest: Path):
    if dest.exists() and dest.stat().st_size > 1000:
        return
    print(f"   ⏳ Yuklab olish: {dest.name}")
    import urllib.request
    dest.parent.mkdir(parents=True, exist_ok=True)
    urllib.request.urlretrieve(url, dest)
    print(f"   ✅ {dest.name} ({dest.stat().st_size/1e6:.1f} MB)")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=1)
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--grad-accum", type=int, default=42)
    parser.add_argument("--lr", type=float, default=5e-6)
    parser.add_argument("--language", default="tr")
    parser.add_argument("--num-workers", type=int, default=2)
    parser.add_argument("--resume-from", default=None,
                        help="Saqlangan best_model.pth dan davom etish")
    args = parser.parse_args()

    if not METADATA_PATH.exists():
        sys.exit(f"❌ Metadata yo'q: {METADATA_PATH}\n   Avval: python training/scripts/extract_and_prep.py")

    print("=" * 70)
    print("XTTS v2 fine-tuning — O'zbek + sizning ovoz")
    print("=" * 70)

    # 1. Trener fayllarini tayyorlash
    print("\n📦 Trainer fayllar:")
    download_if_missing(DVAE_URL, XTTS_CACHE / "dvae.pth")
    download_if_missing(MEL_NORM_URL, XTTS_CACHE / "mel_stats.pth")

    # 2. Importlar
    import torch
    from trainer import Trainer, TrainerArgs
    from TTS.config.shared_configs import BaseDatasetConfig
    from TTS.tts.datasets import load_tts_samples
    from TTS.tts.layers.xtts.trainer.gpt_trainer import GPTArgs, GPTTrainer, GPTTrainerConfig
    from TTS.tts.models.xtts import XttsAudioConfig

    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"\n🖥️  Device: {device}")
    if device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
        vram = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"   GPU: {gpu_name} ({vram:.1f} GB VRAM)")

    # 3. Dataset config
    output_path = CHECKPOINTS_DIR / "xtts_v2_uzbek"
    output_path.mkdir(parents=True, exist_ok=True)

    dataset_config = BaseDatasetConfig(
        formatter="coqui",
        dataset_name="nexttts_uzbek",
        path=str(DATA_DIR),
        meta_file_train=METADATA_PATH.name,  # nisbiy
        language=args.language,
    )

    # 4. Model + audio configs
    # Agar --resume-from berilgan bo'lsa, undan davom etamiz
    xtts_checkpoint = args.resume_from if args.resume_from else str(XTTS_CACHE / "model.pth")
    if args.resume_from:
        print(f"\n🔄 Davom etish: {args.resume_from}")

    model_args = GPTArgs(
        max_conditioning_length=132300,
        min_conditioning_length=66150,
        debug_loading_failures=False,
        max_wav_length=255995,
        max_text_length=200,
        mel_norm_file=str(XTTS_CACHE / "mel_stats.pth"),
        dvae_checkpoint=str(XTTS_CACHE / "dvae.pth"),
        xtts_checkpoint=xtts_checkpoint,
        tokenizer_file=str(XTTS_CACHE / "vocab.json"),
        gpt_num_audio_tokens=1026,
        gpt_start_audio_token=1024,
        gpt_stop_audio_token=1025,
        gpt_use_masking_gt_prompt_approach=True,
        gpt_use_perceiver_resampler=True,
    )

    audio_config = XttsAudioConfig(
        sample_rate=22050,
        dvae_sample_rate=22050,
        output_sample_rate=24000,
    )

    # 5. Trainer config
    config = GPTTrainerConfig(
        epochs=args.epochs,
        output_path=str(output_path),
        model_args=model_args,
        run_name="xtts_v2_uzbek",
        project_name="NextTTS",
        run_description="XTTS v2 fine-tuning for Uzbek + user voice",
        dashboard_logger="tensorboard",
        logger_uri=None,
        audio=audio_config,
        batch_size=args.batch,
        batch_group_size=48,
        eval_batch_size=args.batch,
        num_loader_workers=args.num_workers,
        eval_split_max_size=256,
        print_step=50,
        plot_step=100,
        log_model_step=1000,
        save_step=1000,
        save_n_checkpoints=2,
        save_checkpoints=True,
        print_eval=True,
        optimizer="AdamW",
        optimizer_wd_only_on_weights=True,
        optimizer_params={"betas": [0.9, 0.96], "eps": 1e-8, "weight_decay": 1e-2},
        lr=args.lr,
        lr_scheduler="MultiStepLR",
        lr_scheduler_params={"milestones": [50000 * 18, 150000 * 18, 300000 * 18], "gamma": 0.5, "last_epoch": -1},
        test_sentences=[],
        grad_clip=1.0,
        # MUHIM: fp16 XTTS v2 uchun loss NaN beradi. fp32 ishlatiladi (xavfsizroq).
        # RTX 3060 12GB da batch_size=2 bilan fp32 sig'adi.
    )

    print(f"\n⚙️  Config:")
    print(f"   Epochs:           {args.epochs}")
    print(f"   Batch size:       {args.batch}")
    print(f"   Grad accum:       {args.grad_accum}")
    print(f"   Effective batch:  {args.batch * args.grad_accum}")
    print(f"   Learning rate:    {args.lr}")
    print(f"   Output:           {output_path}")

    # 6. Samples yuklash
    print(f"\n📋 Samples yuklanmoqda...")
    train_samples, eval_samples = load_tts_samples(
        [dataset_config],
        eval_split=True,
        eval_split_max_size=config.eval_split_max_size,
        eval_split_size=0.02,
    )
    print(f"   Train: {len(train_samples)} | Eval: {len(eval_samples)}")

    # 7. Trainer
    print(f"\n🧠 Model initializatsiyasi...")
    model = GPTTrainer.init_from_config(config)

    trainer = Trainer(
        TrainerArgs(
            restore_path=None,
            skip_train_epoch=False,
            start_with_eval=False,
            grad_accum_steps=args.grad_accum,
        ),
        config,
        output_path=str(output_path),
        model=model,
        train_samples=train_samples,
        eval_samples=eval_samples,
    )

    print(f"\n🚀 Trening boshlanmoqda...")
    print(f"   Tensorboard: tensorboard --logdir={output_path}")
    print()

    trainer.fit()

    print(f"\n✅ Trening tugadi")
    print(f"   Checkpointlar: {output_path}")

    # Memory tozalash
    del model, trainer, train_samples, eval_samples
    gc.collect()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


if __name__ == "__main__":
    main()
