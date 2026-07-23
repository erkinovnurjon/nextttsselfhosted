"""F5 audio trimming — boshidagi sukunat / onset blip / ref-echo leak / karrier so'z kesish.

Bu funksiyalar F5 sintezining BOSHIDAGI beqaror artefaktlarni (mikro-pauza, etalon
"gapirib yuborishi", karrier so'z) kesib tashlaydi. Algoritm konservativ — HAQIQIY
birinchi so'zni hech qachon kesmaydi.
"""

import numpy as np


def _voiced_runs(a, sr):
    """(starts, ends, amp, peak) — 50ms dan katta gap bilan ajralgan voiced run'lar."""
    amp = np.abs(a)
    peak = float(amp.max())
    if peak <= 0:
        return None, None, amp, peak
    idx = np.flatnonzero(amp > peak * 0.02)
    if idx.size == 0:
        return None, None, amp, peak
    g = np.flatnonzero(np.diff(idx) > int(sr * 0.05))
    starts = idx[np.concatenate(([0], g + 1))]
    ends = idx[np.concatenate((g, [idx.size - 1]))] + 1
    return starts, ends, amp, peak


def _trim_lead_silence(w, sr, pad_ms=30):
    """Boshidagi sukunat + onset blip(lar) + REF-ECHO LEAK ni kesadi. KONSERVATIV:
    HAQIQIY birinchi so'zni (eng baland run) HECH QACHON kesmaydi. Skip qilinadigan:
      (a) BLIP: QISQA(<80ms) YOKI SOKIN(<12% peak) run = onset-pad ', ' artefakti;
      (b) LEAK: birinchi so'zdan keyin KATTA pauza (>=300ms) — F5 qisqa matnda etalon
         oxirini "gapirib" yuboradi, u katta pauza bilan ajraladi (repro: 'Salom' ->
         [qizildi 516ms][437ms PAUZA][salom]). Eng baland run leak deb kesilmaydi."""
    a = np.asarray(w, dtype="float32")
    if a.size == 0:
        return a
    starts, ends, amp, peak = _voiced_runs(a, sr)
    if starts is None:
        return a
    n = len(starts)
    i = 0
    while i + 1 < n:
        rlen = int(ends[i]) - int(starts[i])
        rpk = float(amp[starts[i]:ends[i]].max())
        gap = int(starts[i + 1]) - int(ends[i])
        is_blip = rlen < int(sr * 0.08) or rpk < peak * 0.12
        is_leak = gap >= int(sr * 0.30) and rpk < peak * 0.98   # katta pauza + eng baland EMAS
        if is_blip or is_leak:
            i += 1
        else:
            break                                               # haqiqiy uzluksiz so'z -> to'xta
    start = max(0, int(starts[i]) - int(sr * pad_ms / 1000))
    return a[start:]


def _trim_tail_silence(w, sr, pad_ms=60):
    """OXIRIDAGI sukunat + dum-blip (nafas/shishirish) + tail ref-leak'ni kesadi.
    _trim_lead_silence'ning oynadagi aksi, lekin KONSERVATIVROQ chegaralar bilan:
    jumla ichidagi vergul-pauzadan keyingi HAQIQIY oxirgi so'z kesilmasligi uchun
    leak faqat JUDA katta pauza (>=450ms) + sezilarli past (<50% peak) bo'lsa kesiladi.
      (a) BLIP: juda qisqa(<60ms) YOKI juda sokin(<8% peak) dum run = nafas/artefakt;
      (b) LEAK: >=450ms pauzadan keyingi past run — F5 oxirida etalon aks-sadosi."""
    a = np.asarray(w, dtype="float32")
    if a.size == 0:
        return a
    starts, ends, amp, peak = _voiced_runs(a, sr)
    if starts is None:
        return a
    j = len(starts) - 1
    while j > 0:
        rlen = int(ends[j]) - int(starts[j])
        rpk = float(amp[starts[j]:ends[j]].max())
        gap = int(starts[j]) - int(ends[j - 1])
        is_blip = rlen < int(sr * 0.06) or rpk < peak * 0.08
        is_leak = gap >= int(sr * 0.45) and rpk < peak * 0.5
        if is_blip or is_leak:
            j -= 1
        else:
            break                                   # haqiqiy oxirgi so'z -> to'xta
    end = min(a.size, int(ends[j]) + int(sr * pad_ms / 1000))
    return a[:end]


def _trim_carrier(w, sr, pad_ms=30, pause_ms=80):
    """Karrier-so'z onset uchun: [karrier 'Eshiting,'][UZUN pauza][haqiqiy matn]. Birinchi
    UZUN pauzagacha (>=pause_ms) bo'lgan hammasini (karrier) kesib, matndan boshlaymiz.
    Uzun pauza topilmasa (karrier matn bilan suvalgan) -> oddiy konservativ trim."""
    a = np.asarray(w, dtype="float32")
    if a.size == 0:
        return a
    amp = np.abs(a)
    peak = float(amp.max())
    if peak <= 0:
        return a
    idx = np.flatnonzero(amp > peak * 0.02)
    if idx.size == 0:
        return a
    big = np.flatnonzero(np.diff(idx) > int(sr * pause_ms / 1000))
    if big.size:
        s_word = int(idx[int(big[0]) + 1])
        return a[max(0, s_word - int(sr * pad_ms / 1000)):]
    return _trim_lead_silence(a, sr, pad_ms)
