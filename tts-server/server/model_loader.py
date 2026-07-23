"""XTTS v2 checkpoint topish/yuklash va model boshqaruvi.

Bu yerda fine-tuned checkpoint'larni topish (`list_all_checkpoints`,
`find_latest_finetuned_checkpoint`, `resolve_checkpoint`), ularni RAM/VRAM'ga
yuklash (`load_checkpoint_into_cache`) va startda modelni tanlash (`load_model`)
mantiqi joylashgan. Holat `server.state.state` singleton'ida saqlanadi.
"""

import os
import re
import time
from pathlib import Path
from typing import Optional

from server.config import CHECKPOINTS_DIR, XTTS_CACHE
from server.state import state


def checkpoint_id_from_path(path: Path) -> str:
    """`xtts_v2_uzbek-May-26-2026_09+53PM-0000000/best_model.pth`
       → `May-26-2026_09+53PM`."""
    parent = path.parent.name
    m = re.search(r"-([A-Z][a-z]+-\d{2}-\d{4}_\d{2}\+\d{2}[AP]M)", parent)
    return m.group(1) if m else parent


def list_all_checkpoints() -> list[dict]:
    """Barcha mavjud fine-tuned checkpoint'larni katalog bilan birga qaytaradi.

    Har bir element: {"id", "name", "path", "size_gb", "mtime", "kind"}
    `kind` = "best" yoki "step" (best_model.pth vs checkpoint_NNNN.pth)
    """
    if not CHECKPOINTS_DIR.exists():
        return []
    items: list[dict] = []
    for path in CHECKPOINTS_DIR.rglob("best_model.pth"):
        items.append({
            "id": checkpoint_id_from_path(path),
            "name": f"{path.parent.name} / {path.name}",
            "path": str(path),
            "size_gb": round(path.stat().st_size / 1e9, 2),
            "mtime": path.stat().st_mtime,
            "kind": "best",
        })
    # Step checkpoint'lar (oraliq holatlar) — alohida, lekin har papka uchun
    # faqat eng yangisini olamiz (juda ko'p bo'lishi mumkin).
    for sub in CHECKPOINTS_DIR.iterdir():
        if not sub.is_dir():
            continue
        steps = list(sub.glob("checkpoint_*.pth"))
        if steps:
            latest = max(steps, key=lambda p: p.stat().st_mtime)
            items.append({
                "id": checkpoint_id_from_path(latest) + "-step",
                "name": f"{latest.parent.name} / {latest.name}",
                "path": str(latest),
                "size_gb": round(latest.stat().st_size / 1e9, 2),
                "mtime": latest.stat().st_mtime,
                "kind": "step",
            })
    # mtime kamayish bo'yicha — eng yangisi tepada
    items.sort(key=lambda x: -x["mtime"])
    return items


def find_latest_finetuned_checkpoint() -> Path | None:
    """Eng so'nggi fine-tuned checkpoint'ni topish.

    Override: NEXTTTS_FINETUNED_CHECKPOINT env var
    """
    env_path = os.environ.get("NEXTTTS_FINETUNED_CHECKPOINT")
    if env_path:
        p = Path(env_path)
        return p if p.exists() else None
    items = list_all_checkpoints()
    if not items:
        return None
    return Path(items[0]["path"])


def resolve_checkpoint(checkpoint_id: Optional[str]) -> Optional[Path]:
    """Berilgan checkpoint_id bo'yicha aniq fayl yo'lini topish.

    Agar id berilmagan bo'lsa, eng yangisini qaytaradi.
    """
    if not checkpoint_id:
        return find_latest_finetuned_checkpoint()
    items = list_all_checkpoints()
    for it in items:
        if it["id"] == checkpoint_id:
            return Path(it["path"])
    return None


def load_checkpoint_into_cache(ckpt_path: Path) -> None:
    """Berilgan checkpoint'ni RAM/VRAM'ga yuklash. Eski model tushiriladi.

    state["loaded_checkpoint"] ni yangilaydi.
    """
    import gc
    import torch
    from TTS.tts.configs.xtts_config import XttsConfig
    from TTS.tts.models.xtts import Xtts

    # Eski modelni tushirish — VRAM bo'shatish
    if state["loaded_checkpoint"]:
        old = state["loaded_checkpoint"]
        try:
            old["model"].to("cpu")
            del old["model"]
            del old["config"]
        except Exception:
            pass
        state["loaded_checkpoint"] = None
        gc.collect()
        if torch.cuda.is_available():
            torch.cuda.empty_cache()

    config = XttsConfig()
    config.load_json(str(XTTS_CACHE / "config.json"))
    model = Xtts.init_from_config(config)
    model.load_checkpoint(
        config,
        checkpoint_path=str(ckpt_path),
        vocab_path=str(XTTS_CACHE / "vocab.json"),
        use_deepspeed=False,
    )
    model.to(state["device"])

    state["loaded_checkpoint"] = {
        "id": checkpoint_id_from_path(ckpt_path),
        "path": ckpt_path,
        "model": model,
        "config": config,
    }
    state["model_kind"] = "finetuned"


def load_model():
    """Modelni yuklash: agar fine-tuned checkpoint bo'lsa, uni; aks holda base model.

    NEXTTTS_MMS_ONLY=1 bo'lsa — XTTS yuklanmaydi (yengil rejim, faqat MMS engine).
    Bu training GPU'ni band qilganda MMS'ni CPU'da sinash uchun ishlatiladi.
    """
    t0 = time.time()
    import torch

    device = "cuda" if torch.cuda.is_available() else "cpu"
    state["device"] = device

    if os.environ.get("NEXTTTS_MMS_ONLY", "").strip() in ("1", "true", "True"):
        state["model_kind"] = "mms-only"
        state["model_load_time"] = time.time() - t0
        print("⚡ MMS-only rejim — XTTS yuklanmadi (yengil). Faqat /synthesize/mms ishlaydi.")
        return

    ft_path = find_latest_finetuned_checkpoint()
    if ft_path:
        print(f"⏳ Fine-tuned XTTS v2 yuklanmoqda: {ft_path.name}")
        load_checkpoint_into_cache(ft_path)
        print(f"✅ Fine-tuned model yuklandi ({device.upper()})")
    else:
        print("⏳ XTTS v2 base model yuklanmoqda...")
        from TTS.api import TTS
        tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)
        state["tts"] = tts
        state["model_kind"] = "base"
        print(f"✅ Base model yuklandi ({device.upper()})")

    state["model_load_time"] = time.time() - t0
