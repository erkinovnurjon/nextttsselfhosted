"""
promote_mms_checkpoint.py
=========================

run_vits_finetuning.py oraliq checkpoint'lari (accelerate save_state) to'g'ridan-to'g'ri
yuklanmaydi: checkpoint-N/model.safetensors = VitsModelForPreTraining (generator) state,
model_1.safetensors = discriminator.

Bu skript training'dagi AYNAN o'sha klassni (VitsModelForPreTraining) yuklab, checkpoint
state'ini strict yuklaydi, keyin save_pretrained qiladi — bu inference VitsModel formatini
beradi (training oxiridagi save bilan bir xil). Natijada mms_engine darhol yuklay oladi.

CPU'da ishlaydi (training GPU'ni band qiladi).

Foydalanish:
    python training/scripts/promote_mms_checkpoint.py \
        --train-dir training/checkpoints/mms_uzb_ft \
        --base training/finetune-hf-vits/mms-uzb-cyr-train \
        --out training/checkpoints/mms_uzb_ft_live
"""

import argparse
import os
import shutil
import sys
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["CUDA_VISIBLE_DEVICES"] = ""  # CPU — training GPU'ga tegmaslik
sys.stdout.reconfigure(encoding="utf-8")

PROJECT_ROOT = Path(__file__).resolve().parents[3]
TTS_SERVER = PROJECT_ROOT / "tts-server"
FT_REPO = TTS_SERVER / "training" / "finetune-hf-vits"
sys.path.insert(0, str(TTS_SERVER))
sys.path.insert(0, str(FT_REPO))

TOKENIZER_FILES = [
    "vocab.json", "tokenizer_config.json", "special_tokens_map.json",
    "added_tokens.json", "preprocessor_config.json", "config.json",
]


def pr(*a, **k):
    k.setdefault("flush", True)
    print(*a, **k)


def latest_checkpoint(train_dir: Path):
    cps = [d.name for d in train_dir.iterdir() if d.is_dir() and d.name.startswith("checkpoint-")]
    if not cps:
        return None
    cps.sort(key=lambda x: int(x.split("-")[1]))
    return cps[-1]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--train-dir", required=True)
    ap.add_argument("--base", required=True, help="VitsModelForPreTraining base (mms-uzb-cyr-train)")
    ap.add_argument("--checkpoint", default="", help="checkpoint-N (bo'sh = eng yangi)")
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    import torch
    from safetensors.torch import load_file
    from transformers import VitsModel, AutoTokenizer
    from utils import VitsModelForPreTraining

    train_dir = Path(args.train_dir).resolve()
    ckpt_name = args.checkpoint or latest_checkpoint(train_dir)
    if not ckpt_name:
        sys.exit("❌ checkpoint-N topilmadi")
    gen_path = train_dir / ckpt_name / "model.safetensors"
    if not gen_path.exists():
        sys.exit(f"❌ {gen_path} yo'q")

    pr(f"📦 Promote: {ckpt_name}")
    model = VitsModelForPreTraining.from_pretrained(args.base)
    # Training AYNAN shu qatlamlarga weight_norm qo'yadi (run_vits_finetuning.py:836-841).
    # Checkpoint weight_g/weight_v formatida — xuddi shunday qo'yib yuklaymiz, keyin merge.
    model.decoder.apply_weight_norm()
    for flow in model.flow.flows:
        torch.nn.utils.weight_norm(flow.conv_pre)
        torch.nn.utils.weight_norm(flow.conv_post)

    sd = load_file(str(gen_path))
    missing, unexpected = model.load_state_dict(sd, strict=False)
    gen_missing = [k for k in missing if not k.startswith("discriminator")]
    pr(f"   load — generator yetishmaydi: {len(gen_missing)}, ortiqcha: {len(unexpected)}")
    if gen_missing[:1]:
        pr(f"   ⚠️ namuna yetishmaydigan: {gen_missing[:5]}")

    # weight_norm'ni olib tashlash (merge) — run_vits_finetuning.py:1495-1499 bilan bir xil
    model.decoder.remove_weight_norm()
    for flow in model.flow.flows:
        torch.nn.utils.remove_weight_norm(flow.conv_pre)
        torch.nn.utils.remove_weight_norm(flow.conv_post)

    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    model.save_pretrained(str(out))
    for fn in TOKENIZER_FILES:
        src = train_dir / fn
        if src.exists():
            shutil.copy2(str(src), str(out / fn))
    pr(f"✅ Saqlandi: {out}")

    # Inference klassi bilan sinov (CPU)
    import soundfile as sf
    from server.mms_engine import latin_to_cyrillic
    tok = AutoTokenizer.from_pretrained(str(out))
    m = VitsModel.from_pretrained(str(out)).eval()
    cyr = latin_to_cyrillic("salom, bugun havo juda yaxshi, qishloqda gʻalla pishdi")
    inp = tok(cyr, return_tensors="pt")
    with torch.no_grad():
        w = m(**inp).waveform[0].numpy()
    test_wav = out / "_promote_test.wav"
    sf.write(str(test_wav), w, m.config.sampling_rate, subtype="PCM_16")
    pr(f"🔊 Sinov OK: {test_wav} ({len(w)/m.config.sampling_rate:.1f}s) | {cyr[:40]}")


if __name__ == "__main__":
    main()
