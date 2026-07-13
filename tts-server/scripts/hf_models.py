"""
NextTTS model fayllarini Hugging Face Hub'ga yuklash / undan yuklab olish.

Nega: model og'irliklari (F5 3.2GB, Piper 61MB) git'ga sig'maydi (GitHub 100MB
limit; repo ataylab tozalangan). Yangi developer repo'ni clone qilgach shu skript
bilan modellarni bir buyruqda oladi.

Foydalanish (tts-server papkasidan):
    # 1) Bir marta (model egasi): HF token bilan yuklash
    #    huggingface-cli login   (yoki $env:HF_TOKEN)
    .venv-f5\\Scripts\\python.exe scripts\\hf_models.py upload --repo <user>/nexttts-models

    # 2) Har yangi mashinada: yuklab olish
    .venv-f5\\Scripts\\python.exe scripts\\hf_models.py download --repo <user>/nexttts-models

Repo PRIVATE yaratiladi (litsenziya: trening ma'lumotlari notijoriy — ochiq
tarqatishdan oldin [[project_tts_model_options]] ko'rilsin). Private repo uchun
download'da ham token kerak (o'qish huquqi yetadi).
"""

import argparse
import os
import sys
from pathlib import Path

TTS_SERVER = Path(__file__).resolve().parents[1]

# repo_ichidagi_yo'l -> lokal yo'l (tts-server'ga nisbatan)
# MUHIM: f5/* fayllari .venv-f5 ichiga tushadi — avval venv o'rnatilgan bo'lishi kerak.
FILES: dict[str, str] = {
    # Piper — DEFAULT ovoz (CPU, majburiy)
    "piper/uz_feruza_deploy.onnx": "training/data/piper_uz/uz_feruza_deploy.onnx",
    "piper/uz_feruza_deploy.onnx.json": "training/data/piper_uz/uz_feruza_deploy.onnx.json",
    # F5 — tabiiy ovozlar + "Mening ovozim" klon (GPU)
    "f5/uzbek100/model_last.pt": ".venv-f5/Lib/ckpts/uzbek100/model_last.pt",
    # DATA_ROOT = site-packages/f5_tts/../../data = .venv-f5/Lib/data (f5_server.py)
    "f5/feruza_char/vocab.txt": ".venv-f5/Lib/data/feruza_char/vocab.txt",
    # F5 o'rnatilgan ovozlarning reference kliplari
    "voices/f5_ref_main.wav": "voices/f5_ref_main.wav",
    "voices/f5_ref_main.txt": "voices/f5_ref_main.txt",
    "voices/f5_ref_jonli.wav": "voices/f5_ref_jonli.wav",
    "voices/f5_ref_jonli.txt": "voices/f5_ref_jonli.txt",
    "voices/f5_ref_ayol.wav": "voices/f5_ref_ayol.wav",
    "voices/f5_ref_ayol.txt": "voices/f5_ref_ayol.txt",
    # carleone — mediadan klonlangan erkak ovoz (o'rnatilgan ovozga ko'tarilgan)
    "voices/f5_ref_carleone.wav": "voices/f5_ref_carleone.wav",
    "voices/f5_ref_carleone.txt": "voices/f5_ref_carleone.txt",
}


def _local(rel: str) -> Path:
    return (TTS_SERVER / rel).resolve()


def upload(repo: str) -> None:
    from huggingface_hub import HfApi

    api = HfApi()
    api.create_repo(repo, repo_type="model", private=True, exist_ok=True)
    ok = missing = 0
    for repo_path, rel in FILES.items():
        p = _local(rel)
        if not p.is_file():
            print(f"⚠️  yo'q, o'tkazildi: {rel}")
            missing += 1
            continue
        print(f"⬆️  {rel}  ({p.stat().st_size / 1e6:.1f} MB) -> {repo}/{repo_path}")
        api.upload_file(path_or_fileobj=str(p), path_in_repo=repo_path, repo_id=repo)
        ok += 1
    print(f"\n✅ {ok} fayl yuklandi" + (f", {missing} topilmadi" if missing else ""))
    print(f"   https://huggingface.co/{repo}")


def download(repo: str) -> None:
    from huggingface_hub import hf_hub_download

    have_f5_venv = (TTS_SERVER / ".venv-f5").is_dir()
    ok = skipped = 0
    for repo_path, rel in FILES.items():
        p = _local(rel)
        if repo_path.startswith("f5/") and not have_f5_venv:
            print(f"⚠️  .venv-f5 yo'q — o'tkazildi: {repo_path} (F5'siz Piper baribir ishlaydi)")
            skipped += 1
            continue
        if p.is_file():
            print(f"✔️  bor: {rel}")
            ok += 1
            continue
        p.parent.mkdir(parents=True, exist_ok=True)
        print(f"⬇️  {repo}/{repo_path} -> {rel}")
        got = hf_hub_download(repo_id=repo, filename=repo_path)
        # hf keshidan kerakli joyga nusxa (symlink Windows'da muammoli)
        import shutil
        shutil.copy2(got, p)
        ok += 1
    print(f"\n✅ {ok} fayl tayyor" + (f", {skipped} o'tkazildi" if skipped else ""))


def main() -> None:
    ap = argparse.ArgumentParser(description="NextTTS modellarini HF Hub'ga/dan ko'chirish")
    ap.add_argument("action", choices=["upload", "download"])
    ap.add_argument(
        "--repo",
        default=os.environ.get("NEXTTTS_HF_REPO", ""),
        help="HF repo id, masalan: username/nexttts-models (yoki NEXTTTS_HF_REPO env)",
    )
    args = ap.parse_args()
    if not args.repo:
        print("XATO: --repo username/nexttts-models kerak (yoki NEXTTTS_HF_REPO env).")
        sys.exit(2)
    if args.action == "upload":
        upload(args.repo)
    else:
        download(args.repo)


if __name__ == "__main__":
    main()
