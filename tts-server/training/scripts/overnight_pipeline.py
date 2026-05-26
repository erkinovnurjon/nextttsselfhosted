"""
overnight_pipeline.py
=====================

Tunda avtomatik ishga tushadigan pipeline:
1. extend_dataset_phonetic.py tugashini kutish (extend_log.txt da "✅ Tugadi")
2. Eng so'nggi best_model.pth ni topish
3. finetune_xtts.py ni --resume-from bilan ishga tushirish
4. Jarayonni train_log.txt ga yozish

Foydalanish:
    python training/scripts/overnight_pipeline.py
    python training/scripts/overnight_pipeline.py --epochs 1 --lr 2e-6
"""

import argparse
import os
import subprocess
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUNBUFFERED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRAIN_DIR = PROJECT_ROOT / "tts-server" / "training"
DATA_DIR = TRAIN_DIR / "data"
CHECKPOINTS_DIR = TRAIN_DIR / "checkpoints" / "xtts_v2_uzbek"
EXTEND_LOG = DATA_DIR / "extend_log.txt"
TRAIN_LOG = DATA_DIR / "train_log.txt"
PYTHON = PROJECT_ROOT / "tts-server" / ".venv" / "Scripts" / "python.exe"
FINETUNE_SCRIPT = TRAIN_DIR / "scripts" / "finetune_xtts.py"


def pr(*args, **kwargs):
    kwargs.setdefault("flush", True)
    print(*args, **kwargs)


def wait_for_extract(timeout_min: int = 240) -> bool:
    """extend_log.txt da '✅ Tugadi' yozuvi paydo bo'lishini kutish."""
    pr(f"⏳ Ekstraktsiya tugashini kutmoqda ({EXTEND_LOG})...")
    deadline = time.time() + timeout_min * 60
    while time.time() < deadline:
        if EXTEND_LOG.exists():
            try:
                content = EXTEND_LOG.read_text(encoding="utf-8", errors="ignore")
                if "✅ Tugadi" in content:
                    pr("✅ Ekstraktsiya tugadi")
                    return True
                if "Traceback" in content or "❌" in content:
                    # Fatal xato bo'lishi mumkin — lekin '❌' ba'zan yo'l yo'q haqida
                    if "Tugadi" not in content and "Traceback" in content:
                        pr("⚠️  Ekstraktsiyada xato:")
                        pr(content[-2000:])
                        return False
            except Exception as e:
                pr(f"   log o'qib bo'lmadi: {e}")
        time.sleep(60)
    pr("⏰ Timeout — ekstraktsiya tugamadi")
    return False


def find_latest_best_model() -> Path | None:
    """Eng so'nggi best_model.pth ni topish (mtime bo'yicha)."""
    candidates = list(CHECKPOINTS_DIR.rglob("best_model.pth"))
    if not candidates:
        return None
    return max(candidates, key=lambda p: p.stat().st_mtime)


def run_training(resume_from: Path, epochs: int, lr: float, batch: int, grad_accum: int) -> int:
    """Trainings'ni subprocess sifatida ishga tushirish, output train_log.txt ga."""
    cmd = [
        str(PYTHON),
        str(FINETUNE_SCRIPT),
        "--resume-from", str(resume_from),
        "--epochs", str(epochs),
        "--lr", str(lr),
        "--batch", str(batch),
        "--grad-accum", str(grad_accum),
    ]
    pr(f"\n🚀 Training komandasi:")
    pr(f"   {' '.join(cmd)}")
    pr(f"   Log: {TRAIN_LOG}\n")

    with open(TRAIN_LOG, "w", encoding="utf-8") as log_f:
        log_f.write(f"# Training boshlandi: {time.strftime('%Y-%m-%d %H:%M:%S')}\n")
        log_f.write(f"# Resume from: {resume_from}\n")
        log_f.write(f"# Command: {' '.join(cmd)}\n\n")
        log_f.flush()
        proc = subprocess.Popen(
            cmd,
            stdout=log_f,
            stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"},
            cwd=str(PROJECT_ROOT),
        )
        pr(f"   Training PID: {proc.pid}")
        rc = proc.wait()
        pr(f"\n   Training tugadi, exit_code={rc}")
        return rc


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--epochs", type=int, default=1,
                        help="Resume qilingach yana nechta epoch o'qitish")
    parser.add_argument("--lr", type=float, default=2e-6,
                        help="Learning rate (past — past LR diminishing returns paytida xavfsizroq)")
    parser.add_argument("--batch", type=int, default=2)
    parser.add_argument("--grad-accum", type=int, default=42)
    parser.add_argument("--wait-timeout-min", type=int, default=240,
                        help="Ekstraktsiyani kutish vaqti (daqiqa)")
    parser.add_argument("--skip-wait", action="store_true",
                        help="Ekstraktsiyani kutmasdan darhol training boshlash")
    args = parser.parse_args()

    pr("=" * 70)
    pr("NextTTS overnight pipeline: extract → train")
    pr("=" * 70)
    pr(f"Boshlandi: {time.strftime('%Y-%m-%d %H:%M:%S')}")

    if not args.skip_wait:
        if not wait_for_extract(args.wait_timeout_min):
            sys.exit("❌ Ekstraktsiya tugamadi yoki xato")

    best = find_latest_best_model()
    if not best:
        sys.exit("❌ Hech qanday best_model.pth topilmadi")
    pr(f"\n📍 Resume nuqtasi: {best}")
    pr(f"   Razmer: {best.stat().st_size/1e9:.2f} GB")
    pr(f"   Modify time: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(best.stat().st_mtime))}")

    rc = run_training(best, args.epochs, args.lr, args.batch, args.grad_accum)
    if rc == 0:
        pr("\n✅ Pipeline muvaffaqiyatli tugadi")
    else:
        pr(f"\n⚠️  Training xato bilan tugadi (exit={rc}). Log: {TRAIN_LOG}")


if __name__ == "__main__":
    main()
