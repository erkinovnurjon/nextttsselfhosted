"""Training holati endpointi — train_log.txt oxirini parse qiladi.

GET /training/status → epoch/step/loss progress + log tail.
Frontend Status sahifasi va uy noutbukidan kuzatish uchun ishlatiladi.
"""

import re
import time
from pathlib import Path

from fastapi import APIRouter

from server.config import TRAIN_LOG, PIPELINE_LOG, EXTEND_LOG

router = APIRouter()


@router.get("/training/status")
def training_status():
    """Hozirgi training jarayoni holati — train_log.txt oxirini parse qilib.

    Frontend Status sahifasi har 10 sekundda so'rab progress ko'rsatadi.
    Uy noutbukidan ham GitHub'dagi STATUS.md (auto-publish) o'rniga shu API ishlatish mumkin.
    """
    def _last_lines(path: Path, n: int = 200) -> list[str]:
        if not path.exists():
            return []
        try:
            with open(path, "rb") as f:
                f.seek(0, 2)
                size = f.tell()
                # 64 KB oxiri yetadi
                f.seek(max(0, size - 65536))
                data = f.read().decode("utf-8", errors="ignore")
                return data.splitlines()[-n:]
        except Exception:
            return []

    train_lines = _last_lines(TRAIN_LOG, 400)
    pipeline_lines = _last_lines(PIPELINE_LOG, 80)
    extend_lines = _last_lines(EXTEND_LOG, 40)

    # Step va loss'ni parse qilish (oxirgi qayd)
    step_pattern = re.compile(r"STEP:\s*(\d+)/(\d+).*GLOBAL_STEP:\s*(\d+)")
    mel_ce_pattern = re.compile(r"loss_mel_ce:\s*([\d.]+)\s*\(([\d.]+)\)")
    loss_pattern = re.compile(r"\| > loss:\s*([\d.]+)\s*\(([\d.]+)\)")
    eval_pattern = re.compile(r"avg_loss_mel_ce:\s*([\d.]+)", re.IGNORECASE)
    epoch_pattern = re.compile(r"EPOCH:\s*(\d+)/(\d+)")
    time_pattern = re.compile(r"TIME:\s*(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})")

    step = step_max = global_step = None
    epoch = epoch_max = None
    last_loss = last_loss_avg = None
    last_mel_ce = last_mel_ce_avg = None
    last_eval_loss = None
    last_step_time = None

    for line in train_lines:
        m = step_pattern.search(line)
        if m:
            step, step_max, global_step = int(m.group(1)), int(m.group(2)), int(m.group(3))
        m = mel_ce_pattern.search(line)
        if m:
            last_mel_ce, last_mel_ce_avg = float(m.group(1)), float(m.group(2))
        m = loss_pattern.search(line)
        if m:
            last_loss, last_loss_avg = float(m.group(1)), float(m.group(2))
        m = epoch_pattern.search(line)
        if m:
            epoch, epoch_max = int(m.group(1)), int(m.group(2))
        m = time_pattern.search(line)
        if m:
            last_step_time = m.group(1)
        m = eval_pattern.search(line)
        if m:
            last_eval_loss = float(m.group(1))

    # Training jarayoni hali ishlamoqda?
    train_running = False
    if train_lines:
        # Oxirgi STEP yozuvi yaqinda bo'lsa, ishlamoqda deb hisoblaymiz
        train_running = any("STEP:" in ln for ln in train_lines[-30:])

    return {
        "extract": {
            "log_tail": extend_lines[-15:] if extend_lines else [],
            "finished": any("✅ Tugadi" in ln for ln in extend_lines),
        },
        "training": {
            "running": train_running,
            "epoch": epoch,
            "epoch_max": epoch_max,
            "step": step,
            "step_max": step_max,
            "global_step": global_step,
            "progress_pct": round(100 * step / step_max, 1) if step and step_max else None,
            "last_loss": last_loss,
            "last_loss_avg": last_loss_avg,
            "last_mel_ce": last_mel_ce,
            "last_mel_ce_avg": last_mel_ce_avg,
            "last_eval_loss": last_eval_loss,
            "last_step_time": last_step_time,
            "log_tail": train_lines[-25:],
        },
        "pipeline_tail": pipeline_lines[-15:],
        "now": time.strftime("%Y-%m-%d %H:%M:%S"),
    }
