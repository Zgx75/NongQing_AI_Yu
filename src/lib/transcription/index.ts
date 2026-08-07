import { ExternalTranscriptionProvider } from "./external-provider";
import { GeminiTranscriptionProvider } from "./gemini-provider";
import { MockTranscriptionProvider } from "./mock-provider";
export const getTranscriptionProvider = () => process.env.TRANSCRIPTION_PROVIDER === "gemini"
  ? new GeminiTranscriptionProvider()
  : process.env.TRANSCRIPTION_PROVIDER === "external"
    ? new ExternalTranscriptionProvider()
    : new MockTranscriptionProvider();

export function applyTermCorrections(text: string, terms: { incorrectTerm: string; correctedTerm: string }[]) {
  let corrected = text; const changes: { from: string; to: string }[] = [];
  for (const term of terms) if (corrected.includes(term.incorrectTerm)) { corrected = corrected.split(term.incorrectTerm).join(term.correctedTerm); changes.push({ from: term.incorrectTerm, to: term.correctedTerm }); }
  return { rawText: text, correctedText: corrected, changes };
}
