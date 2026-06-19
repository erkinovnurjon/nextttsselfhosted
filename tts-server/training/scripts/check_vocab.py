# Datasetdagi belgilarni base F5 vocab bilan solishtirish (normalizatsiyadan keyin).
from cached_path import cached_path
from collections import Counter

vp = str(cached_path("hf://SWivid/F5-TTS/F5TTS_v1_Base/vocab.txt"))
vocab = set(l.rstrip("\n") for l in open(vp, encoding="utf-8"))

NORM = [("‘","'"),("’","'"),("ʻ","'"),("ʼ","'"),("“",'"'),("”",'"'),
        ("—","-"),("–","-"),("…","..."),("«",'"'),("»",'"'),(" "," ")]
def norm(t):
    for a,b in NORM:
        t = t.replace(a,b)
    return t

base = r"C:/Projects/nexttts/tts-server/training/data/feruza_f5/metadata.csv"
texts = [l.split("|",1)[1] for l in open(base, encoding="utf-8").read().splitlines()]

miss = Counter()
for t in texts:
    for ch in norm(t):
        if ch not in vocab:
            miss[ch] += 1

print("MISSING chars:", len(miss))
for ch, c in miss.most_common(60):
    print(f"  U+{ord(ch):04X} {ch!r} x{c}")
