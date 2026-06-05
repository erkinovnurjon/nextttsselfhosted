# MMS pivot — "ovozim shart emas, ravon o'zbek muhim"

_2026-05-29 kechasi, avtonom sessiya natijasi_

## Qaror

XTTS fine-tuning (v3→v7) loss'i `~3.07`da **qotib qoldi** — har bir yangi versiya
deyarli bir xil chiqdi. Sabab: XTTS o'zbekni bilmaydi, turk (`tr`) fonemalari orqali
ishlaydi, shuning uchun `q / x / oʻ / gʻ` hech qachon to'liq to'g'ri chiqmaydi.
Qancha fine-tune qilinmasin, shu shift o'zgarmaydi.

Insight: **ovoz kimniki ekani muhim emas, ravonlik muhim** → XTTS arxitekturasidan
chiqib, o'zbekni **tug'ma** biladigan modelga o'tamiz.

## Bugun bajarildi (ishlaydi, sinaб ko'rilgan)

### 1. Meta MMS o'zbek TTS ulandi
- Model: `facebook/mms-tts-uzb-script_cyrillic` (lotin versiyasi MAVJUD EMAS — faqat kirill).
- Lotin matn ichida **avtomatik Latin→Cyrillic** transliteratsiya qilinadi
  (`tts-server/server/mms_engine.py`). `q→қ, x→х, oʻ→ў, gʻ→ғ, tutuq '→ъ` to'g'ri.
- Fonetik jihatdan **to'liq o'zbek**, sintez **juda tez** (~0.2s/jumla GPU'da).

### 2. Qayerda sinash mumkin
- **`/compare`** — 10 ta test jumla `mms_uzb_cyrillic` papkasida tayyor,
  7 ta XTTS versiya bilan **yonma-yon** eshitiladi. (Bu asosiy A/B taqqoslash.)
- **`/voice-lab`** — checkpoint ro'yxati tepasida **"MMS — tug'ma o'zbek (ayol ovozi)"**.
  Tanlаб, istalgan matningizni yozib eshitasiz. Birinchi sintez ~25s (model yuklanadi),
  keyin tez.

### 3. Qo'shilgan fayllar
- `tts-server/server/mms_engine.py` — engine + transliteratsiya
- `tts-server/scripts/mms_synthesize.py` — namuna generatsiya (--inspect ham bor)
- `tts-server/server/main.py` — yangi `POST /synthesize/mms` endpoint
- `src/app/api/tts/route.ts` — `checkpoint_id:"mms"` bo'lsa MMS'ga yo'naltiradi
- `src/app/voice-lab/page.tsx` — MMS sun'iy checkpoint sifatida

## Keyingi qadam — Piper/VITS (sizdan 1 ta narsa kerak)

MMS ravon, lekin ohangi biroz "robot"roq. Undan **tabiiyroq** ovoz uchun eng yaxshi
yo'l: **FeruzaSpeech** (60 soat, bitta toshkentlik ayol, studiya sifati,
lotin+kirill transkript) datasetida VITS/Piper o'rgatish yoki MMS'ni fine-tune qilish.

⚠️ FeruzaSpeech **gated** — faqat siz ocha olasiz:
1. <https://huggingface.co/datasets/k2speech/FeruzaSpeech> — login → **"Agree and access"**
2. Token: <https://huggingface.co/settings/tokens> (read yetarli)
3. Login:
   ```powershell
   cd C:\Projects\nexttts\tts-server
   .\.venv\Scripts\python.exe -m huggingface_hub.commands.huggingface_cli login
   ```
4. Yuklash:
   ```powershell
   .\.venv\Scripts\python.exe training\scripts\download_feruzaspeech.py --inspect   # ko'rish
   .\.venv\Scripts\python.exe training\scripts\download_feruzaspeech.py             # yuklash
   ```

Token bergach, men prep + training pipeline'ni quraman.

## Tavsiya
Avval `/compare`'da MMS'ni XTTS bilan eshiting. Agar MMS yetarlicha yaxshi bo'lsa —
butun og'ir trening mehnatini tashlab, MMS'ni production engine qilib olamiz
(+ keyin FeruzaSpeech bilan tabiiylikni oshiramiz).

---

## YANGILANISH — MMS fine-tuning boshlandi (2026-05-29 ~19:42)

Foydalanuvchi: "MMS yaxshi, shuni o'qitamiz, monoton/jonsiz". Qaror: MMS'ni jonli
spiker datasetida fine-tune qilib ohang/tabiiylikni oshirish.

**Dataset:** FeruzaSpeech (eng yaxshi) HF'da gated — muallif **qo'lda tasdig'i kutilmoqda**
(403). Shuning uchun **diskда tayyor ISSAI USC**'dan eng yirik spiker (1459541555,
~5.2h, badiiy roman o'qilgan) ajratildi → kirillga o'girilib HF dataset qilindi.

**Toolchain (ishlaydi):** `ylacombe/finetune-hf-vits`.
- monotonic_align: Windows'da MSVC yo'qligi uchun **numba** drop-in yozildi (`monotonic_align/__init__.py`).
- discriminator: `convert_original_discriminator_checkpoint.py --language_code uzb-script_cyrillic`
  → `finetune-hf-vits/mms-uzb-cyr-train`.
- matplotlib `tostring_rgb` → `buffer_rgba` patch (`utils/plot.py`).
- local dataset: `run_vits_finetuning.py` load_from_disk patch.

**Run:** `config_uzb.json` — 3 epoch, batch 8, audio ≤10s, ~1824 qadam, ~17s/qadam,
ETA ~8.7h. Checkpoint: `training/checkpoints/mms_uzb_ft`, har 300 qadamda saqlanadi.

**Server holati:** training GPU'ni to'liq band qilgani uchun TTS server **vaqtincha o'chirilgan**.
Training tugagach: `server/mms_engine.py` avtomatik fine-tuned checkpoint'ni yuklaydi
(`MMS_FT_DIR` yoki default papka), server qayta yoqiladi, /sinov va /compare'da sinaladi.

**Tayyorlangan skriptlar:**
- `training/scripts/prepare_mms_dataset.py` — USC spikerdan single-speaker dataset
- `training/scripts/build_mms_hf_dataset.py` — HF DatasetDict (save_to_disk)
- `training/scripts/download_feruzaspeech.py` — tasdiq kelgach FeruzaSpeech yuklash

**Keyingi (FeruzaSpeech ochilsa):** xuddi shu pipeline'ni 60h ifodali ovozda qayta
ishga tushirish → yanada jonliroq natija.
