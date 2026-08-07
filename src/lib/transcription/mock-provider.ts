import type { TranscriptionProvider } from "./provider";
export class MockTranscriptionProvider implements TranscriptionProvider {
  providerName = "mock";
  async transcribe() { return { text: "Watered the tea field this morning for about one hour.", rawText: "Watered the tea field this morning for about one hour.", provider: this.providerName, corrections: [] }; }
}
