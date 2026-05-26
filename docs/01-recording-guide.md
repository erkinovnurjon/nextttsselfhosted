# Audio Yozish Qoʻllanmasi (Recording Guide)

Bu qoʻllanma sizga toza, sifatli audio dataset tayyorlashda yordam beradi. Yomon yozilgan ovoz = yomon TTS model. Hech qanday kod buni tuzata olmaydi.

---

## 1. Texnik talablar (MAJBURIY)

| Parametr | Qiymat | Sabab |
|---|---|---|
| **Sampling rate** | 22050 Hz yoki 24000 Hz | XTTS v2 uchun standart |
| **Bit depth** | 16-bit | Sifat + hajm balansi |
| **Kanal** | Mono (1 kanal) | TTS modellar mono kutadi |
| **Format** | WAV (siqilmagan) | MP3 sifatni buzadi |
| **Davomiylik** | 3-15 soniya jumla uchun | Juda uzun = trainingda muammo |
| **Tinchlik** | Jumla boshi: 0.3 sek, oxiri: 0.5 sek | Trim qilish oson |
| **Volume** | Eng baland nuqta: -3 dB to -6 dB | Clipping yoʻq, lekin baland |
| **Background noise** | -60 dB dan past | Toza ovoz |

---

## 2. Jihozlar tayyorlash

### Mikrofon
- **Bor boʻlsa:** USB mikrofon (Maono PD400X, Audio-Technica AT2020 USB)
- **Yoʻq boʻlsa:** Sotib oling — telefon mikrofoni YARAMAYDI
- **Hech narsa yoʻq boʻlsa:** Yaxshi sifatli garniturada vaqtinchalik sinash mumkin, lekin natija past boʻladi

### Xona
- **Tinch xona** — gilam, parda, yumshoq mebellar bor joy (echo'ni yutadi)
- **Soat 23:00 - 06:00** — koʻchadan shovqin kam
- **Telefon, kondisioner, soat — hammasini OʻCHIRING**
- **Kompyuter ventilyatori** shovqinli boʻlsa, mikrofonni undan uzoq qoʻying

### Yozish dasturi (BEPUL)
1. **Audacity** — eng oson, yangi boshlovchilar uchun  
   https://www.audacityteam.org/
2. **Reaper** — professional, 60 kun bepul sinov  
   https://www.reaper.fm/

---

## 3. Audacity sozlamalari (sklikning birinchi marta)

```
Edit > Preferences > Audio Settings:
  - Project Sample Rate: 22050 Hz
  - Default Sample Format: 16-bit PCM
  - Recording Channels: 1 (Mono)
```

Yozishdan oldin har gal tekshiring:
- Yuqori chap burchakda: Recording Device — sizning mikrofon
- Yuqori oʻng burchakda: Project Rate (bottom-left) — **22050**

---

## 4. Yozish jarayoni

### Sozlash (har bir sessiya boshida)
1. Tinch oʻtiring, suv iching, tomoqni isiting
2. Mikrofonga 15-20 sm masofada turing
3. Test yozuv qiling — "Salom, bu test" — va volume tekshiring (-6 dB atrofida)
4. Audacity'da fon shovqin (background noise) yozuv qiling (5 soniya jim oʻtiring) — keyin "Noise Reduction" uchun kerak boʻladi

### Har bir jumla uchun

1. **`sentences.txt`** dan jumlani oʻqing — qoʻlda yozilgan kabi tabiiy oʻqing
2. **Recording (qizil tugma)** ni bosing
3. **0.3 soniya kuting** (jim)
4. Jumlani **tabiiy, sokin, oʻrtacha tezlikda** oʻqing
5. **0.5 soniya kuting** (jim)
6. **Stop (sariq tugma)** bosing
7. Qoniqarli boʻlsa — **Export Audio** > WAV (Microsoft) signed 16-bit PCM
8. Faylni saqlang: `001.wav`, `002.wav`, ... (jumla raqami bilan bir xil)

### Faylni qayerga saqlash

```
c:/Projects/nexttts/dataset/wavs/001.wav
c:/Projects/nexttts/dataset/wavs/002.wav
c:/Projects/nexttts/dataset/wavs/003.wav
...
```

---

## 5. Oʻqish qoidalari (MUHIM!)

✅ **QILING:**
- Tabiiy ohangda oʻqing — kundalik nutq kabi
- Bir xil tonal va tempda turing (sessiya davomida)
- Jumlaning ohangini matnga mos qiling (savol — koʻtariluvchi, undov — koʻtarilgan)
- Vergullarda kichik pauza qiling
- Toʻliq, aniq talaffuz qiling — lekin teatr emas

❌ **QILMANG:**
- Juda tez yoki juda sekin oʻqimang
- Ohangni oʻzgartirib yubormang (drama qilmang)
- Yoʻtal, qichqiriq, "uh", "mmm" qoʻshmang
- Nafas olishni mikrofon yoniga kelmasin (yon tomonga nafas oling)
- Mikrofonga "p" va "b" larda urinmang — pop filter kerak (yoki 30 sm masofa)
- Bir kunda 1 soatdan koʻp yozmang — ovoz charchaydi va oʻzgaradi

---

## 6. Sifat tekshiruvi (har 20 ta jumladan keyin)

Audio'ni eshiting va tekshiring:
- [ ] Fon shovqini yoʻqmi?
- [ ] Echo yoʻqmi?
- [ ] Volume yetarlimi (lekin clipping yoʻq)?
- [ ] Boshida va oxirida ortiqcha tinchlik bormi (trim qilish kerak)?
- [ ] Talaffuz aniqmi?
- [ ] Matn bilan audio mos keladimi?

Yomon yozuvni — qayta yozing. Compromise qilmang.

---

## 7. Rejim va dozalash

- **Bir sessiyada:** 30-50 ta jumla (45-60 daqiqa)
- **Ovoz charchasa:** dam oling, ertasiga davom ettiring
- **300 ta jumla:** odatda 7-10 sessiya (1-2 hafta)
- **Bir kunda 100+ jumla:** YOMON — ovoz oʻzgaradi, model "ikki xil ovoz" deb tushunadi

---

## 8. Tugaganidan keyin

300 ta WAV fayl tayyor boʻlganda, men sizga:
1. **Avtomatik trim** skripti (boshi/oxiri jimlikni kesish)
2. **Normalize** skripti (volume bir xillashtirish)
3. **Quality check** skripti (qaysi fayllar muammoli)
4. **metadata.csv** generatsiya qilish (LJSpeech formati)
5. **XTTS v2 fine-tuning** uchun trening skripti

— hammasini Python kodlarda tayyorlab beraman.

---

## 9. Tezkor savol-javob

**Savol:** Jumla noqulay oʻqildimi (xato qildim)?  
**Javob:** Stop bosing, ochiq fayldan oʻchiring, qaytadan yozing. WAV'ni qayta export qiling.

**Savol:** Ovozim biroz xirib qoldi, davom etayinmi?  
**Javob:** YOʻQ. Sessiyani toʻxtating. Ertasiga davom eting. Aks holda model nomuvofiq ovoz oʻrganadi.

**Savol:** 300 ta juda koʻp, kamroq mumkinmi?  
**Javob:** 
- **Minimum:** 100 ta jumla (~10 daqiqa) — XTTS v2 voice clone uchun yetadi
- **Tavsiya:** 300 ta (~30-40 daqiqa) — fine-tuning uchun yaxshi
- **Maksimum:** 1000+ — agar professional sifat kerak boʻlsa

**Savol:** Telefon yoki noutbuk mikrofoni yetarlimi?  
**Javob:** YOʻQ. Natija past chiqadi. $100-150 ga oddiy USB mikrofon eng arzon sarmoya.

**Savol:** Stress qilib, drama qilib oʻqishim kerakmi?  
**Javob:** YOʻQ. Tabiiy, kundalik suhbat ohangida oʻqing. Model sizning ovozingizning **tabiiy** tonini oʻrganishi kerak.
