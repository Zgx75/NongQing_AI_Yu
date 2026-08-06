export type TranscriptionResult = { text: string; rawText: string; provider: string; corrections: { from: string; to: string }[] };
export interface TranscriptionProvider { providerName: string; transcribe(file: File): Promise<TranscriptionResult>; }
