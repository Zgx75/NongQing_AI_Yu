import { AppError } from "@/lib/api";
import type { TranscriptionProvider } from "./provider";
export class ExternalTranscriptionProvider implements TranscriptionProvider {
  providerName = "external";
  async transcribe(file: File) {
    const url = process.env.TRANSCRIPTION_API_URL; if (!url) throw new AppError("TRANSCRIPTION_NOT_CONFIGURED", "語音辨識服務尚未設定。", 503);
    const form = new FormData(); form.append("file", file);
    const response = await fetch(url, { method: "POST", headers: process.env.TRANSCRIPTION_API_KEY ? { authorization: `Bearer ${process.env.TRANSCRIPTION_API_KEY}` } : {}, body: form });
    if (!response.ok) throw new AppError("TRANSCRIPTION_FAILED", "語音辨識暫時無法使用。", 502);
    const data = await response.json() as { text?: string }; if (!data.text) throw new AppError("TRANSCRIPTION_INVALID", "語音辨識沒有回傳文字。", 502);
    return { text: data.text, rawText: data.text, provider: this.providerName, corrections: [] };
  }
}
