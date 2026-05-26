"""
publish_status.py
=================

Training jarayoni STATUS.md ni yangilab GitHub'ga push qiladi.
Foydalanuvchi uyidagi noutbukdan https://github.com/<user>/nexttts/blob/main/STATUS.md
ni ochib live progress'ni ko'rishi mumkin.

Foydalanish:
    # Bir martalik (qo'lda push)
    python training/scripts/publish_status.py --once

    # Avtomatik (har 10 daqiqada git commit + push)
    python training/scripts/publish_status.py --loop --interval 600
"""

import argparse
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TRAIN_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "train_log.txt"
PIPELINE_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "pipeline_log.txt"
EXTEND_LOG = PROJECT_ROOT / "tts-server" / "training" / "data" / "extend_log.txt"
STATUS_MD = PROJECT_ROOT / "STATUS.md"
CHECKPOINTS_DIR = PROJECT_ROOT / "tts-server" / "training" / "checkpoints" / "xtts_v2_uzbek"


def pr(*args, **kwargs):
    kwargs.setdefault("flush", True)
    print(*args, **kwargs)


def tail_lines(path: Path, n: int = 60) -> list[str]:
    if not path.exists():
        return []
    try:
        with open(path, "rb") as f:
            f.seek(0, 2)
            size = f.tell()
            f.seek(max(0, size - 200_000))
            data = f.read().decode("utf-8", errors="ignore")
            return data.splitlines()[-n:]
    except Exception:
        return []


def parse_training(lines: list[str]) -> dict:
    step_pat = re.compile(r"STEP:\s*(\d+)/(\d+).*GLOBAL_STEP:\s*(\d+)")
    mel_pat = re.compile(r"loss_mel_ce:\s*([\d.]+)\s*\(([\d.]+)\)")
    loss_pat = re.compile(r"\| > loss:\s*([\d.]+)\s*\(([\d.]+)\)")
    epoch_pat = re.compile(r"EPOCH:\s*(\d+)/(\d+)")
    time_pat = re.compile(r"TIME:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")
    eval_pat = re.compile(r"avg_loss_mel_ce:\s*([\d.]+)", re.IGNORECASE)

    out: dict = {
        "step": None, "step_max": None, "global_step": None,
        "epoch": None, "epoch_max": None,
        "loss": None, "loss_avg": None,
        "mel_ce": None, "mel_ce_avg": None,
        "eval": None, "last_time": None,
    }
    for ln in lines:
        if (m := step_pat.search(ln)):
            out["step"], out["step_max"], out["global_step"] = (
                int(m.group(1)), int(m.group(2)), int(m.group(3)))
        if (m := mel_pat.search(ln)):
            out["mel_ce"], out["mel_ce_avg"] = float(m.group(1)), float(m.group(2))
        if (m := loss_pat.search(ln)):
            out["loss"], out["loss_avg"] = float(m.group(1)), float(m.group(2))
        if (m := epoch_pat.search(ln)):
            out["epoch"], out["epoch_max"] = int(m.group(1)), int(m.group(2))
        if (m := time_pat.search(ln)):
            out["last_time"] = m.group(1)
        if (m := eval_pat.search(ln)):
            out["eval"] = float(m.group(1))
    return out


def latest_checkpoints() -> list[dict]:
    if not CHECKPOINTS_DIR.exists():
        return []
    items = []
    for p in CHECKPOINTS_DIR.rglob("best_model.pth"):
        items.append({
            "path": str(p.relative_to(PROJECT_ROOT)),
            "size_gb": round(p.stat().st_size / 1e9, 2),
            "mtime": p.stat().st_mtime,
        })
    items.sort(key=lambda x: -x["mtime"])
    return items[:5]


def render_status() -> str:
    train_lines = tail_lines(TRAIN_LOG, 80)
    extend_lines = tail_lines(EXTEND_LOG, 20)
    pipeline_lines = tail_lines(PIPELINE_LOG, 30)
    t = parse_training(train_lines)
    cps = latest_checkpoints()

    progress_pct = (
        round(100 * t["step"] / t["step_max"], 1)
        if t["step"] and t["step_max"] else None
    )
    extract_done = any("✅ Tugadi" in ln for ln in extend_lines)
    train_running = any("STEP:" in ln for ln in train_lines[-30:])

    md = []
    md.append("# NextTTS — Training Status")
    md.append("")
    md.append(f"_Avtomatik yangilandi: **{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}**_")
    md.append("")
    md.append("> Bu fayl `publish_status.py` tomonidan har 10 daqiqada GitHub'ga push qilinadi.")
    md.append("> Uy noutbukdan jarayonni shu yerda kuzatish mumkin.")
    md.append("")

    md.append("## Hozirgi holat")
    md.append("")
    md.append("| Bosqich | Holat |")
    md.append("|---|---|")
    md.append(f"| Ekstraktsiya | {'✅ TUGADI' if extract_done else '⏳ ishlamoqda yoki yo\\'q'} |")
    md.append(f"| Training | {'🟢 ISHLAMOQDA' if train_running else '⚫ to\\'xtagan / tugagan'} |")
    if progress_pct is not None:
        md.append(f"| Epoch progress | **{progress_pct}%** (step {t['step']:,}/{t['step_max']:,}) |")
    if t["last_time"]:
        md.append(f"| So'nggi step vaqti | {t['last_time']} |")
    md.append("")

    if any(v is not None for v in [t["loss_avg"], t["mel_ce_avg"], t["eval"]]):
        md.append("## Loss")
        md.append("")
        md.append("| Metric | Qiymat | Eslatma |")
        md.append("|---|---|---|")
        if t["loss"] is not None:
            md.append(f"| `loss` (instant) | {t['loss']:.4f} | so'nggi batch |")
        if t["loss_avg"] is not None:
            md.append(f"| `loss` (running avg) | **{t['loss_avg']:.4f}** | train avg |")
        if t["mel_ce"] is not None:
            md.append(f"| `loss_mel_ce` (instant) | {t['mel_ce']:.3f} | mel cross-entropy |")
        if t["mel_ce_avg"] is not None:
            md.append(f"| `loss_mel_ce` (running avg) | **{t['mel_ce_avg']:.3f}** | mel running avg |")
        if t["eval"] is not None:
            md.append(f"| `eval avg_loss_mel_ce` | **{t['eval']:.3f}** | eval split (v3 = 3.16) |")
        md.append("")

    if progress_pct is not None:
        bar_len = 40
        filled = int(progress_pct / 100 * bar_len)
        bar = "█" * filled + "░" * (bar_len - filled)
        md.append("## Progress bar")
        md.append("")
        md.append("```")
        md.append(f"[{bar}] {progress_pct}%")
        md.append("```")
        md.append("")

    if cps:
        md.append("## Eng so'nggi checkpoint'lar")
        md.append("")
        md.append("| Yo'l | Hajm | O'zgarish |")
        md.append("|---|---|---|")
        for c in cps:
            ts = datetime.fromtimestamp(c["mtime"]).strftime("%Y-%m-%d %H:%M:%S")
            md.append(f"| `{c['path']}` | {c['size_gb']} GB | {ts} |")
        md.append("")

    if train_lines:
        md.append("## Training log (so'nggi 25 qator)")
        md.append("")
        md.append("```")
        md.extend(train_lines[-25:])
        md.append("```")
        md.append("")

    if pipeline_lines:
        md.append("## Pipeline log")
        md.append("")
        md.append("```")
        md.extend(pipeline_lines[-15:])
        md.append("```")
        md.append("")

    if extend_lines:
        md.append("## Ekstraktsiya log (oxiri)")
        md.append("")
        md.append("```")
        md.extend(extend_lines[-15:])
        md.append("```")

    return "\n".join(md) + "\n"


def git_commit_push(message: str) -> tuple[bool, str]:
    """STATUS.md ni commit qilib push qilish."""
    try:
        # Faqat STATUS.md ni stage qilamiz (boshqa fayllarni emas)
        subprocess.run(
            ["git", "add", str(STATUS_MD.relative_to(PROJECT_ROOT))],
            cwd=str(PROJECT_ROOT), check=True, capture_output=True,
        )
        # Hech qanday o'zgarish bo'lmasa, commit'ni o'tkazib yuboramiz
        diff = subprocess.run(
            ["git", "diff", "--cached", "--name-only"],
            cwd=str(PROJECT_ROOT), check=True, capture_output=True, text=True,
        )
        if not diff.stdout.strip():
            return True, "(no changes)"
        subprocess.run(
            ["git", "commit", "-m", message],
            cwd=str(PROJECT_ROOT), check=True, capture_output=True,
        )
        push = subprocess.run(
            ["git", "push"],
            cwd=str(PROJECT_ROOT), capture_output=True, text=True,
        )
        if push.returncode != 0:
            return False, push.stderr or push.stdout
        return True, "pushed"
    except subprocess.CalledProcessError as e:
        return False, (e.stderr or e.stdout or str(e)).strip() if hasattr(e, "stderr") else str(e)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--once", action="store_true", help="Bir marta yangilab chiq")
    parser.add_argument("--loop", action="store_true", help="Avtomatik tsiklda ishlash")
    parser.add_argument("--interval", type=int, default=600, help="Tsikl oraliq (sek)")
    parser.add_argument("--no-push", action="store_true", help="Faqat yozish, push qilma")
    args = parser.parse_args()

    if not args.once and not args.loop:
        args.once = True  # default

    def update_and_push():
        STATUS_MD.write_text(render_status(), encoding="utf-8")
        pr(f"📝 STATUS.md yangilandi ({STATUS_MD})")
        if args.no_push:
            return
        ok, msg = git_commit_push(f"chore(status): {datetime.now().strftime('%H:%M')} auto-update")
        pr(f"   git: {'✅' if ok else '⚠️'} {msg}")

    if args.once:
        update_and_push()
        return

    pr(f"🔄 Loop: har {args.interval} sek (Ctrl+C — to'xtatish)")
    while True:
        try:
            update_and_push()
        except Exception as e:
            pr(f"⚠️  Xato: {e}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
