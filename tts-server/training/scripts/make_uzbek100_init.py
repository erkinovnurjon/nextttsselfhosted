# uzbek70/model_last.pt'dan FAQAT ema og'irliklarini ajratib uzbek100_init.pt yaratadi.
# Sabab: to'liq checkpoint'da update/optimizer/scheduler bor -> trainer eski LR'ni tiklaydi.
# Faqat ema_model_state_dict bo'lsa trainer else-branch -> update=0, YANGI LR jadvali.
import torch
from importlib.resources import files
from pathlib import Path

CK = Path(str(files("f5_tts").joinpath("../../ckpts"))).resolve()
SRC = CK / "uzbek70" / "model_last.pt"
DST = CK / "uzbek100_init.pt"

ckpt = torch.load(str(SRC), map_location="cpu", weights_only=True)
assert "ema_model_state_dict" in ckpt, f"ema yo'q! kalitlar: {list(ckpt)}"
torch.save({"ema_model_state_dict": ckpt["ema_model_state_dict"]}, str(DST))
print(f"OK: {DST}  ({DST.stat().st_size/1e9:.2f} GB)  <- {SRC.name}")
