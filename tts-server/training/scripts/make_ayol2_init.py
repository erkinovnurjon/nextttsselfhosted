# uzbek100/model_last.pt (to'liq ISSAI bazasi, WER 8%)'dan FAQAT ema og'irliklarini
# ajratib ayol2_init.pt yaratadi — ayol (1571110404) dedicated fine-tune QAYTA, yangi bazadan.
# Sabab: to'liq checkpoint'da update/optimizer/scheduler bor -> trainer eski LR ni tiklaydi.
# Faqat ema_model_state_dict bo'lsa trainer else-branch -> update=0, YANGI LR jadvali.
import torch
from importlib.resources import files
from pathlib import Path

CK = Path(str(files("f5_tts").joinpath("../../ckpts"))).resolve()
SRC = CK / "uzbek100" / "model_last.pt"
DST = CK / "ayol2_init.pt"

ckpt = torch.load(str(SRC), map_location="cpu", weights_only=True)
assert "ema_model_state_dict" in ckpt, f"ema yo'q! kalitlar: {list(ckpt)}"
torch.save({"ema_model_state_dict": ckpt["ema_model_state_dict"]}, str(DST))
print(f"OK: {DST}  ({DST.stat().st_size/1e9:.2f} GB)  <- uzbek100/{SRC.name}")
