"""
long_run_orchestrator.py
========================

Avtonom rejimda v4 dan keyin bir necha training round'larni chain qiladi:
    v5 (continue convergence, lr=2e-6)
        → samples
    v6 (finer LR, lr=1e-6)
        → samples
    v7 (super-fine, lr=5e-7) — faqat v6 ham yaxshilash bersa
        → samples
    final: barcha checkpoint'lar uchun sample audio'lar generatsiya

Foydalanuvchi uzoq vaqtga ketganda ishga tushiriladi. STATUS.md auto-publisher
har bosqichni GitHub'da ko'rsatadi.

Foydalanish:
    python training/scripts/long_run_orchestrator.py
    python training/scripts/long_run_orchestrator.py --skip-wait
    python training/scripts/long_run_orchestrator.py --skip v7
"""

import argparse
import os
import re
import shutil
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUNBUFFERED"] = "1"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRAIN_DIR = PROJECT_ROOT / "tts-server" / "training"
DATA_DIR = TRAIN_DIR / "data"
CHECKPOINTS_DIR = TRAIN_DIR / "checkpoints" / "xtts_v2_uzbek"
PYTHON = PROJECT_ROOT / "tts-server" / ".venv" / "Scripts" / "python.exe"
FINETUNE_SCRIPT = TRAIN_DIR / "scripts" / "finetune_xtts.py"
SAMPLES_SCRIPT = TRAIN_DIR / "scripts" / "generate_samples.py"
PUBLISH_SCRIPT = TRAIN_DIR / "scripts" / "publish_status.py"

ORCH_LOG = DATA_DIR / "orchestrator.log"


def pr(*args, **kwargs):
    kwargs.setdefault("flush", True)
    timestamp = datetime.now().strftime("%H:%M:%S")
    print(f"[{timestamp}]", *args, **kwargs)
    try:
        with open(ORCH_LOG, "a", encoding="utf-8") as f:
            f.write(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {' '.join(str(a) for a in args)}\n")
    except Exception:
        pass


def find_latest_best_model() -> Path | None:
    if not CHECKPOINTS_DIR.exists():
        return None
    cps = list(CHECKPOINTS_DIR.rglob("best_model.pth"))
    if not cps:
        return None
    return max(cps, key=lambda p: p.stat().st_mtime)


def wait_for_training_idle(check_log: Path, idle_seconds: int = 90, max_wait_h: float = 36.0) -> bool:
    """train_log.txt yangilanmay qolsa, training tugagan deb hisoblaymiz.

    `idle_seconds` davomida log fayl o'zgarmasa — tugadi.
    """
    pr(f"⏳ Training tugashini kutmoqda ({check_log})...")
    deadline = time.time() + max_wait_h * 3600
    last_mtime = check_log.stat().st_mtime if check_log.exists() else 0
    last_size = check_log.stat().st_size if check_log.exists() else 0
    last_change = time.time()

    while time.time() < deadline:
        time.sleep(30)
        if not check_log.exists():
            continue
        m = check_log.stat().st_mtime
        s = check_log.stat().st_size
        if m != last_mtime or s != last_size:
            last_mtime, last_size = m, s
            last_change = time.time()
        elif time.time() - last_change >= idle_seconds:
            pr(f"   ✅ Log {idle_seconds}s davomida o'zgarmadi — tugadi deb hisoblanadi")
            return True
    pr(f"   ⏰ {max_wait_h}h timeout — yana ham kutmaymiz")
    return False


def wait_for_pipeline_completion(pipeline_log: Path, max_wait_h: float = 24.0) -> bool:
    """overnight_pipeline.py yoki shu o'xshash skript log'ida tugatish belgisini kutish."""
    pr(f"⏳ Pipeline tugashini kutmoqda ({pipeline_log})...")
    deadline = time.time() + max_wait_h * 3600
    while time.time() < deadline:
        if pipeline_log.exists():
            try:
                content = pipeline_log.read_text(encoding="utf-8", errors="ignore")
                if "Pipeline muvaffaqiyatli tugadi" in content:
                    pr("   ✅ Pipeline tugagan deb belgilangan")
                    return True
                if "Training xato bilan tugadi" in content or "exit_code=" in content[-2000:]:
                    pr("   ⚠️  Training tugadi (xato bo'lishi mumkin)")
                    return True
            except Exception:
                pass
        time.sleep(60)
    return False


def run_subprocess(cmd: list[str], log_path: Path) -> int:
    """Subprocess'ni log fayliga yozib ishga tushirish."""
    pr(f"▶️  Ishga tushirish: {' '.join(cmd)}")
    pr(f"   Log: {log_path}")
    with open(log_path, "w", encoding="utf-8") as log_f:
        log_f.write(f"# Boshlandi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        log_f.write(f"# Cmd: {' '.join(cmd)}\n\n")
        log_f.flush()
        proc = subprocess.Popen(
            cmd,
            stdout=log_f,
            stderr=subprocess.STDOUT,
            env={**os.environ, "PYTHONIOENCODING": "utf-8", "PYTHONUNBUFFERED": "1"},
            cwd=str(PROJECT_ROOT),
        )
        rc = proc.wait()
        log_f.write(f"\n# Tugadi: exit_code={rc}\n")
    pr(f"   ✅ Tugadi exit_code={rc}")
    return rc


def run_training_round(name: str, epochs: int, lr: float, resume_from: Path) -> tuple[bool, Path | None]:
    """Bitta training round'ni o'tkazish."""
    pr(f"\n{'='*68}")
    pr(f"🎯 ROUND {name.upper()} — epochs={epochs}, lr={lr}")
    pr(f"   Resume from: {resume_from}")
    pr(f"{'='*68}")

    log_path = DATA_DIR / f"train_log_{name}.txt"
    cmd = [
        str(PYTHON), str(FINETUNE_SCRIPT),
        "--resume-from", str(resume_from),
        "--epochs", str(epochs),
        "--lr", str(lr),
        "--batch", "2",
        "--grad-accum", "42",
    ]
    rc = run_subprocess(cmd, log_path)
    if rc != 0:
        pr(f"❌ {name} xato bilan tugadi (exit={rc})")
        return False, None

    # Yangi best_model topish
    new_best = find_latest_best_model()
    if new_best and new_best != resume_from:
        pr(f"✅ Yangi best_model: {new_best}")
        return True, new_best
    pr(f"⚠️  Yangi best_model topilmadi (avvalgini ishlatamiz)")
    return True, resume_from


def generate_samples_for(checkpoint: Path) -> bool:
    """Berilgan checkpoint uchun test sentences'larni ovozli WAV qilish."""
    pr(f"\n🎤 Sample generatsiya: {checkpoint.parent.name}")
    log_path = DATA_DIR / f"samples_{checkpoint.parent.name}.log"
    cmd = [
        str(PYTHON), str(SAMPLES_SCRIPT),
        "--checkpoint", str(checkpoint),
    ]
    rc = run_subprocess(cmd, log_path)
    return rc == 0


def trigger_status_publish():
    """STATUS.md ni darhol yangilab push qilish."""
    try:
        cmd = [str(PYTHON), str(PUBLISH_SCRIPT), "--once"]
        subprocess.run(
            cmd, cwd=str(PROJECT_ROOT),
            env={**os.environ, "PYTHONIOENCODING": "utf-8"},
            capture_output=True, timeout=120,
        )
        pr("   📤 STATUS.md push qilindi")
    except Exception as e:
        pr(f"   ⚠️  STATUS publish xato: {e}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-wait", action="store_true",
                        help="Joriy v4 training tugashini kutmaslik")
    parser.add_argument("--skip", action="append", default=[],
                        help="O'tkazib yuborish kerak bo'lgan round nomlari (v5, v6, v7)")
    parser.add_argument("--rounds", default="v5,v6,v7",
                        help="Bajariladigan round'lar (vergul bilan ajratib)")
    args = parser.parse_args()

    pr("="*68)
    pr("NextTTS LONG-RUN ORCHESTRATOR")
    pr("="*68)
    pr(f"Boshlandi: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    pr(f"Skip: {args.skip}")
    pr(f"Rounds: {args.rounds}")

    # 1. Hozirgi v4 training tugashini kutish
    pipeline_log = DATA_DIR / "pipeline_log.txt"
    train_log_v4 = DATA_DIR / "train_log.txt"

    if not args.skip_wait:
        # Avval pipeline log'da "Pipeline muvaffaqiyatli tugadi" yoki shunga o'xshash belgi
        # bo'lmasa, train_log.txt idle bo'lishini kutamiz (training tugagan bo'ladi).
        ok = wait_for_pipeline_completion(pipeline_log, max_wait_h=2.0)
        if not ok:
            pr("   pipeline_log tugatish belgisi topilmadi — train_log.txt idle bo'lishini kutamiz")
            wait_for_training_idle(train_log_v4, idle_seconds=120, max_wait_h=24.0)

    # 2. v4 dan keyin samples generatsiya
    latest = find_latest_best_model()
    if latest:
        pr(f"\n📍 v4 yakuniy best_model: {latest}")
        # Sample generation v4 uchun
        generate_samples_for(latest)
        trigger_status_publish()
    else:
        pr("⚠️  v4 best_model topilmadi — ehtimol training tugamagan")
        return

    # 3. Round schedule
    schedule = {
        "v5": {"epochs": 1, "lr": 2e-6, "description": "Continue convergence (same LR)"},
        "v6": {"epochs": 1, "lr": 1e-6, "description": "Finer adjustment (0.5x LR)"},
        "v7": {"epochs": 1, "lr": 5e-7, "description": "Super-fine (0.25x LR)"},
    }
    rounds = [r.strip() for r in args.rounds.split(",") if r.strip()]
    rounds = [r for r in rounds if r in schedule and r not in args.skip]

    pr(f"\n🗓  Bajariladigan round'lar: {rounds}")

    current = latest
    for name in rounds:
        cfg = schedule[name]
        pr(f"\n>>> Round {name}: {cfg['description']}")
        ok, new_ckpt = run_training_round(name, cfg["epochs"], cfg["lr"], current)
        trigger_status_publish()
        if not ok:
            pr(f"⚠️  {name} muvaffaqiyatsiz — keyingi round'lar to'xtatildi")
            break
        if new_ckpt:
            current = new_ckpt
            generate_samples_for(new_ckpt)
            trigger_status_publish()
        else:
            pr(f"⚠️  {name} dan keyin yangi checkpoint yo'q — round'lar to'xtatildi")
            break

    # 4. Final: barcha checkpoint'lar uchun sample (agar boshqalari yo'q bo'lsa)
    pr(f"\n🎁 Barcha checkpoint'lar uchun sample'larni to'liq generatsiya...")
    log_path = DATA_DIR / "samples_all.log"
    run_subprocess(
        [str(PYTHON), str(SAMPLES_SCRIPT), "--all-checkpoints"],
        log_path,
    )

    pr(f"\n✅ ORCHESTRATOR TUGADI: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    trigger_status_publish()


if __name__ == "__main__":
    main()
