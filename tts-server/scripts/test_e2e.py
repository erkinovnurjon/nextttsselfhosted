"""
End-to-end test: FastAPI server orqali voice cloning.

Bu skript ishlatishdan oldin server ishga tushgan bo'lishi kerak:
    .\.venv\Scripts\python.exe -m uvicorn server.main:app --port 8000

Foydalanish:
    python scripts/test_e2e.py
"""

import os
import sys
import time
from pathlib import Path

os.environ["PYTHONIOENCODING"] = "utf-8"

import urllib.request
import urllib.error
import json

BASE_URL = "http://127.0.0.1:8000"
PROJECT_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_DIR = PROJECT_ROOT / "tts-server" / "output"

TEST_TEXTS = [
    ("E2E test 1 — qisqa", "Salom, bu mening ovozim."),
    ("E2E test 2 — o'rta", "Bugun havo juda yaxshi va men dasturlash bilan shug'ullanyapman."),
    ("E2E test 3 — uzun", "O'zbekiston Markaziy Osiyoda joylashgan go'zal mamlakat. Bizning xalqimiz mehmondo'st va mehnatsevar."),
]


def http_get(url: str, timeout: int = 5) -> dict:
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read().decode("utf-8"))


def http_post_json(url: str, body: dict, timeout: int = 120) -> tuple[bytes, dict]:
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, headers={"Content-Type": "application/json"}
    )
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read(), dict(r.headers)


def wait_for_backend(max_wait_sec: int = 120) -> bool:
    print(f"⏳ Backend kutilmoqda ({BASE_URL})...")
    t0 = time.time()
    while time.time() - t0 < max_wait_sec:
        try:
            data = http_get(f"{BASE_URL}/health", timeout=2)
            if data.get("model_loaded"):
                print(f"✅ Backend tayyor ({time.time() - t0:.1f}s)")
                print(f"   Device: {data.get('device')}")
                if data.get('gpu_name'):
                    print(f"   GPU: {data.get('gpu_name')} ({data.get('vram_total_gb')} GB)")
                return True
            print(f"   Server javob bermoqda, lekin model hali yuklanmagan...")
            time.sleep(3)
        except Exception:
            time.sleep(2)
    print(f"❌ {max_wait_sec}s ichida backend tayyor bo'lmadi")
    return False


def test_voices():
    print("\n📁 Voices test:")
    data = http_get(f"{BASE_URL}/voices")
    for v in data.get("voices", []):
        print(f"   ✓ {v['name']}: {v['duration_sec']}s @ {v['sample_rate']}Hz")
    if not data.get("voices"):
        print("   ⚠️  Hech qanday voice topilmadi")


def test_languages():
    print("\n🌐 Languages test:")
    data = http_get(f"{BASE_URL}/languages")
    print(f"   {len(data.get('languages', []))} ta til mavjud")


def test_synthesis():
    print(f"\n🎤 Sintez testlari (output: {OUTPUT_DIR.relative_to(PROJECT_ROOT)}):\n")
    results = []
    for label, text in TEST_TEXTS:
        print(f"   ▶ {label}: {text[:50]}{'...' if len(text) > 50 else ''}")
        t0 = time.time()
        try:
            audio_bytes, headers = http_post_json(
                f"{BASE_URL}/synthesize",
                {"text": text, "language": "tr", "voice": "main"},
            )
            elapsed = time.time() - t0
            synth_time = headers.get("X-Synthesis-Time-Sec", "?")
            output_path = OUTPUT_DIR / f"e2e_{int(time.time())}_{label.split()[1]}.wav"
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_bytes(audio_bytes)
            size_kb = len(audio_bytes) / 1024
            print(f"     ✓ Saqlandi: {output_path.name} ({size_kb:.0f} KB)")
            print(f"       Server sintez: {synth_time}s, jami HTTP: {elapsed:.2f}s")
            results.append({"ok": True, "label": label, "path": output_path})
        except urllib.error.HTTPError as e:
            err_body = e.read().decode("utf-8", errors="replace")
            print(f"     ❌ HTTP {e.code}: {err_body[:200]}")
            results.append({"ok": False, "label": label, "error": str(e)})
        except Exception as e:
            print(f"     ❌ Xato: {e}")
            results.append({"ok": False, "label": label, "error": str(e)})
    return results


def main():
    print("=" * 70)
    print("NextTTS — End-to-End Test")
    print("=" * 70)

    if not wait_for_backend():
        sys.exit(1)

    test_voices()
    test_languages()
    results = test_synthesis()

    print("\n" + "=" * 70)
    ok = sum(1 for r in results if r["ok"])
    print(f"Natija: {ok}/{len(results)} test muvaffaqiyatli")
    print("=" * 70)
    if ok < len(results):
        sys.exit(1)


if __name__ == "__main__":
    main()
