"""So'rov sxemalari (Pydantic) — barcha /synthesize* va /reference endpointlari uchun."""

from typing import Optional

from pydantic import BaseModel, Field


class SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    language: str = Field(default="tr", description="Til kodi (tr — o'zbek uchun)")
    voice: str = Field(default="main", description="Reference voice nomi")
    speed: float = Field(default=1.0, ge=0.5, le=2.0)
    normalize: bool = Field(
        default=True,
        description="O'zbek matnni turk fonetikasiga moslashtirish (sifat uchun tavsiya)",
    )
    temperature: float = Field(default=0.65, ge=0.1, le=1.5, description="Past = aniqroq, baland = ijodiyroq")
    repetition_penalty: float = Field(default=5.0, ge=1.0, le=20.0)
    top_k: int = Field(default=50, ge=1, le=200)
    top_p: float = Field(default=0.85, ge=0.1, le=1.0)
    checkpoint_id: Optional[str] = Field(
        default=None,
        description="Maxsus checkpoint id (masalan 'May-26-2026_09+53PM'). Bo'sh — eng yangisi",
    )


class BuildReferenceRequest(BaseModel):
    voice: str = Field(default="main")
    top: int = Field(default=3, ge=1, le=10)


class MMSSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    voice: Optional[str] = Field(default=None, description="base | erkak | ayol")
    normalize: bool = Field(
        default=True,
        description="O'zbek linguistik normalizatsiya (sonlar, qisqartmalar)",
    )
    speaking_rate: Optional[float] = Field(
        default=None, ge=0.3, le=1.5,
        description="PAST = sekinroq (0.5 ~ tabiiy). Bo'sh — server default.",
    )
    noise_scale_duration: Optional[float] = Field(
        default=None, ge=0.0, le=1.0,
        description="PAST = barqarorroq ritm. Bo'sh — server default.",
    )


class F5SynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speed: float = Field(default=1.0, ge=0.3, le=2.0)
    # nfe=24: TEZLIK uchun (foydalanuvchi tanladi) — 5.9s->3.1s (~1.9x), sifat deyarli
    # o'sha. nfe=48 sifatliroq lekin sekin; nfe=16 tezroq lekin pastroq. So'rovda almashtirsa
    # bo'ladi. (Eski default 48 — ASR-sweep 28%->18% WER, lekin tezlik muhimroq.)
    nfe_step: int = Field(default=24, ge=8, le=64)
    # F5 reference tanlovi: feruza (#1, tabiiy) | jonli (05, ifodali). f5_server'ga uzatiladi.
    voice: str = Field(default="feruza")
    # Per-user zero-shot klon (Next.js DB'dan beradi): foydalanuvchi reference klipi + matni.
    ref_wav: str | None = Field(default=None)
    ref_text: str | None = Field(default=None)
    seed: int | None = Field(default=None)


class PiperSynthesizeRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    length_scale: float = Field(default=1.0, ge=0.5, le=2.0)
    normalize: bool = Field(
        default=True,
        description="O'zbek linguistik normalizatsiya (sonlar, sana, qisqartmalar)",
    )
