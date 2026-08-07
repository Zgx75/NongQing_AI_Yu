import { AppError } from "@/lib/api";
import type { TranscriptionProvider } from "./provider";

const MIME_TYPE_MAP: Record<string, string> = {
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/mpeg": "audio/mp3",
  "audio/mp3": "audio/mp3",
  "audio/aiff": "audio/aiff",
  "audio/aac": "audio/aac",
  "audio/ogg": "audio/ogg",
  "audio/flac": "audio/flac",
};

function transcriptText(body: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }) {
  const value = body.candidates?.[0]?.content?.parts?.map(part => part.text ?? "").join("").trim() ?? "";
  return value.replace(/^```(?:text)?\s*/i, "").replace(/\s*```$/, "").replace(/^逐字稿[：:]\s*/u, "").trim();
}

export class GeminiTranscriptionProvider implements TranscriptionProvider {
  providerName = "gemini";

  async transcribe(file: File) {
    const key = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_TRANSCRIPTION_MODEL || process.env.GEMINI_MODEL;
    if (!key || !model) throw new AppError("TRANSCRIPTION_NOT_CONFIGURED", "Gemini transcription is not configured.", 503);
    const mimeType = MIME_TYPE_MAP[file.type.toLowerCase()];
    if (!mimeType) throw new AppError("UNSUPPORTED_AUDIO_TYPE", "Transcription supports WAV, MP3, AIFF, AAC, OGG, or FLAC audio only.", 415);

    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    let response: Response;
    try {
      response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        signal: AbortSignal.timeout(50_000),
        headers: { "content-type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [
            { text: "逐字轉錄此錄音中的人聲，並使用說話者原本的語言與文字系統。保留農作物、品種、病蟲害、肥料、農藥、數量與單位等農業詞彙；不要摘要、改寫或補充未說出的內容。無法辨識處以原語言標示為聽不清。只輸出逐字稿純文字。" },
            { inlineData: { mimeType, data } },
          ] }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 },
        }),
      });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === "TimeoutError" || /timeout|aborted/i.test(error.message));
      throw new AppError(timedOut ? "TRANSCRIPTION_TIMEOUT" : "TRANSCRIPTION_FAILED", timedOut ? "Transcription took too long. Shorten the recording and try again." : "Transcription is temporarily unavailable.", 502);
    }
    if (!response.ok) throw new AppError("TRANSCRIPTION_FAILED", `Gemini transcription returned HTTP ${response.status}. Please try again later.`, 502);
    const body = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
    const text = transcriptText(body);
    if (!text) throw new AppError("TRANSCRIPTION_INVALID", "No usable speech was recognized in the recording.", 422);
    return { text, rawText: text, provider: this.providerName, corrections: [] };
  }
}
