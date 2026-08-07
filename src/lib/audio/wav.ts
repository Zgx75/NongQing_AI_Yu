const TARGET_SAMPLE_RATE = 16_000;

function writeAscii(view: DataView, offset: number, value: string) {
  for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index));
}

export function encodeMonoPcm16Wav(channels: Float32Array[], inputSampleRate: number, outputSampleRate = TARGET_SAMPLE_RATE) {
  if (!channels.length || !channels[0]?.length || inputSampleRate <= 0 || outputSampleRate <= 0) throw new Error("錄音內容是空的。");
  const sourceLength = Math.min(...channels.map(channel => channel.length));
  const sampleCount = Math.max(1, Math.floor(sourceLength * outputSampleRate / inputSampleRate));
  const buffer = new ArrayBuffer(44 + sampleCount * 2);
  const view = new DataView(buffer);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, outputSampleRate, true);
  view.setUint32(28, outputSampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount * 2, true);

  const ratio = inputSampleRate / outputSampleRate;
  for (let index = 0; index < sampleCount; index += 1) {
    const start = Math.floor(index * ratio);
    const end = Math.max(start + 1, Math.min(sourceLength, Math.floor((index + 1) * ratio)));
    let sum = 0;
    let count = 0;
    for (let sourceIndex = start; sourceIndex < end; sourceIndex += 1) {
      for (const channel of channels) { sum += channel[sourceIndex] ?? 0; count += 1; }
    }
    const sample = Math.max(-1, Math.min(1, count ? sum / count : 0));
    view.setInt16(44 + index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
  }
  return new Blob([buffer], { type: "audio/wav" });
}

export async function recordedAudioToWav(recording: Blob) {
  const AudioContextClass = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) throw new Error("此瀏覽器無法轉換錄音格式。");
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await recording.arrayBuffer());
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    return encodeMonoPcm16Wav(channels, decoded.sampleRate);
  } finally {
    await context.close();
  }
}
