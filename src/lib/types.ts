export interface Sentence {
  id: string;
  text: string;
  createdAt: string;
  recordedAt: string | null;
  audioPath: string | null;
  duration: number | null;
  sampleRate: number | null;
  notes: string | null;
}

export interface DatasetStats {
  total: number;
  recorded: number;
  pending: number;
  totalDurationSec: number;
  avgDurationSec: number;
}
