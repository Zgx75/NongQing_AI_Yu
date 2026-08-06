import type { TranscriptionProvider } from "./provider";
export class MockTranscriptionProvider implements TranscriptionProvider {
  providerName = "mock";
  async transcribe() { return { text: "今天早上幫茶園澆水，大約一小時。", rawText: "今天早上幫茶園澆水，大約一小時。", provider: this.providerName, corrections: [] }; }
}
