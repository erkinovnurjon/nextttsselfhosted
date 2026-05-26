// Brauzerda MediaRecorder Blob (webm/opus) → 22050 Hz mono 16-bit WAV
// XTTS v2 va aksariyat TTS modellar shu format kutadi.

export const TARGET_SAMPLE_RATE = 22050;

export async function blobToWav(
  blob: Blob,
  targetSampleRate: number = TARGET_SAMPLE_RATE
): Promise<{ wav: Blob; duration: number; sampleRate: number }> {
  const arrayBuffer = await blob.arrayBuffer();
  const audioCtx = new (window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext })
      .webkitAudioContext)();
  const decoded = await audioCtx.decodeAudioData(arrayBuffer.slice(0));

  const monoBuffer = downmixToMono(decoded);
  const resampled = await resample(monoBuffer, decoded.sampleRate, targetSampleRate);
  const wavBuffer = encodeWav(resampled, targetSampleRate);

  await audioCtx.close().catch(() => undefined);

  return {
    wav: new Blob([wavBuffer], { type: "audio/wav" }),
    duration: resampled.length / targetSampleRate,
    sampleRate: targetSampleRate,
  };
}

function downmixToMono(buffer: AudioBuffer): Float32Array {
  const channels = buffer.numberOfChannels;
  const length = buffer.length;
  if (channels === 1) return buffer.getChannelData(0).slice();
  const mono = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = buffer.getChannelData(ch);
    for (let i = 0; i < length; i++) {
      mono[i] += data[i] / channels;
    }
  }
  return mono;
}

async function resample(
  samples: Float32Array,
  fromRate: number,
  toRate: number
): Promise<Float32Array> {
  if (fromRate === toRate) return samples;
  const offlineCtx = new OfflineAudioContext(
    1,
    Math.ceil((samples.length * toRate) / fromRate),
    toRate
  );
  const buffer = offlineCtx.createBuffer(1, samples.length, fromRate);
  buffer.copyToChannel(samples, 0, 0);
  const source = offlineCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(offlineCtx.destination);
  source.start(0);
  const rendered = await offlineCtx.startRendering();
  return rendered.getChannelData(0).slice();
}

function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const bytesPerSample = 2;
  const numChannels = 1;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }
  return buffer;
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i++) {
    view.setUint8(offset + i, str.charCodeAt(i));
  }
}

export function trimSilence(samples: Float32Array, threshold = 0.01): Float32Array {
  let start = 0;
  let end = samples.length - 1;
  while (start < samples.length && Math.abs(samples[start]) < threshold) start++;
  while (end > start && Math.abs(samples[end]) < threshold) end--;
  return samples.slice(start, end + 1);
}
