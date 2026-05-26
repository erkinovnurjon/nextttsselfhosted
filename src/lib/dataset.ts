import { promises as fs } from "fs";
import path from "path";
import type { Sentence, DatasetStats } from "./types";

const DATASET_DIR = path.join(process.cwd(), "dataset");
const SENTENCES_FILE = path.join(DATASET_DIR, "sentences.json");
const SEED_FILE = path.join(DATASET_DIR, "sentences.txt");
const WAVS_DIR = path.join(DATASET_DIR, "wavs");

async function ensureDirs() {
  await fs.mkdir(DATASET_DIR, { recursive: true });
  await fs.mkdir(WAVS_DIR, { recursive: true });
}

async function seedFromTxt(): Promise<Sentence[]> {
  try {
    const raw = await fs.readFile(SEED_FILE, "utf8");
    const now = new Date().toISOString();
    const sentences: Sentence[] = [];
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const m = trimmed.match(/^(\d+)\|(.+)$/);
      if (!m) continue;
      const id = m[1].padStart(3, "0");
      sentences.push({
        id,
        text: m[2].trim(),
        createdAt: now,
        recordedAt: null,
        audioPath: null,
        duration: null,
        sampleRate: null,
        notes: null,
      });
    }
    return sentences;
  } catch {
    return [];
  }
}

export async function loadSentences(): Promise<Sentence[]> {
  await ensureDirs();
  try {
    const raw = await fs.readFile(SENTENCES_FILE, "utf8");
    return JSON.parse(raw) as Sentence[];
  } catch {
    const seeded = await seedFromTxt();
    await saveSentences(seeded);
    return seeded;
  }
}

export async function saveSentences(sentences: Sentence[]): Promise<void> {
  await ensureDirs();
  await fs.writeFile(
    SENTENCES_FILE,
    JSON.stringify(sentences, null, 2),
    "utf8"
  );
}

export async function addSentence(text: string): Promise<Sentence> {
  const list = await loadSentences();
  const ids = list.map((s) => s.id);
  const nextNum = ids
    .map((id) => parseInt(id, 10))
    .filter((n) => !Number.isNaN(n))
    .reduce((max, n) => (n > max ? n : max), 0);
  const id = String(nextNum + 1).padStart(3, "0");
  const sentence: Sentence = {
    id,
    text: text.trim(),
    createdAt: new Date().toISOString(),
    recordedAt: null,
    audioPath: null,
    duration: null,
    sampleRate: null,
    notes: null,
  };
  list.push(sentence);
  await saveSentences(list);
  return sentence;
}

export async function updateSentence(
  id: string,
  patch: Partial<Sentence>
): Promise<Sentence | null> {
  const list = await loadSentences();
  const idx = list.findIndex((s) => s.id === id);
  if (idx === -1) return null;
  list[idx] = { ...list[idx], ...patch, id: list[idx].id };
  await saveSentences(list);
  return list[idx];
}

export async function deleteSentence(id: string): Promise<boolean> {
  const list = await loadSentences();
  const sentence = list.find((s) => s.id === id);
  if (!sentence) return false;
  if (sentence.audioPath) {
    const fullPath = path.join(process.cwd(), sentence.audioPath);
    await fs.unlink(fullPath).catch(() => undefined);
  }
  const filtered = list.filter((s) => s.id !== id);
  await saveSentences(filtered);
  return true;
}

export async function saveRecording(
  id: string,
  buffer: Buffer,
  meta: { duration: number; sampleRate: number }
): Promise<Sentence | null> {
  await ensureDirs();
  const filename = `${id}.wav`;
  const fullPath = path.join(WAVS_DIR, filename);
  await fs.writeFile(fullPath, buffer);
  return updateSentence(id, {
    audioPath: `dataset/wavs/${filename}`,
    recordedAt: new Date().toISOString(),
    duration: meta.duration,
    sampleRate: meta.sampleRate,
  });
}

export async function deleteRecording(id: string): Promise<Sentence | null> {
  const list = await loadSentences();
  const sentence = list.find((s) => s.id === id);
  if (!sentence) return null;
  if (sentence.audioPath) {
    const fullPath = path.join(process.cwd(), sentence.audioPath);
    await fs.unlink(fullPath).catch(() => undefined);
  }
  return updateSentence(id, {
    audioPath: null,
    recordedAt: null,
    duration: null,
    sampleRate: null,
  });
}

export async function getStats(): Promise<DatasetStats> {
  const list = await loadSentences();
  const recorded = list.filter((s) => s.audioPath != null);
  const totalDuration = recorded.reduce(
    (sum, s) => sum + (s.duration ?? 0),
    0
  );
  return {
    total: list.length,
    recorded: recorded.length,
    pending: list.length - recorded.length,
    totalDurationSec: totalDuration,
    avgDurationSec:
      recorded.length > 0 ? totalDuration / recorded.length : 0,
  };
}

export async function exportLJSpeech(): Promise<string> {
  const list = await loadSentences();
  const lines = list
    .filter((s) => s.audioPath != null)
    .map((s) => `wavs/${s.id}.wav|${s.text}|main`);
  return lines.join("\n") + "\n";
}

export function getAudioFullPath(audioPath: string): string {
  return path.join(process.cwd(), audioPath);
}
