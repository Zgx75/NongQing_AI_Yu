import { AppError } from "@/lib/api";
import type { AIProvider } from "./provider";
import { extractedFarmRecordSchema, generatedBrandCopySchema, generatedDocumentSchema, type ExtractFarmRecordInput, type GenerateBrandCopyInput, type GenerateFarmJournalInput, type GenerateTraceabilityInput } from "./schemas";
import { extractFarmRecordPrompt } from "./prompts/extract-farm-record";
import { generateFarmJournalPrompt } from "./prompts/generate-farm-journal";
import { generateTraceabilityPrompt } from "./prompts/generate-traceability-draft";
import { generateBrandCopyPrompt } from "./prompts/generate-brand-copy";

export class GeminiAIProvider implements AIProvider {
  providerName = "gemini";
  modelName = process.env.GEMINI_MODEL || "";
  private raw = "";
  getLastRawResponse() { return this.raw; }

  private async request(prompt: string, repair = false): Promise<unknown> {
    const key = process.env.GEMINI_API_KEY;
    if (!key || !this.modelName) throw new AppError("AI_NOT_CONFIGURED", "Gemini is not configured. Switch to mock mode or set the API key and model.", 503);
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.modelName)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: repair ? `修復為合法 JSON，僅輸出 JSON：${prompt}` : prompt }] }], generationConfig: { responseMimeType: "application/json", temperature: 0.1 } }),
    });
    if (!response.ok) throw new AppError("AI_PROVIDER_ERROR", "The AI service is temporarily unavailable. Please try again later.", 502);
    const body = await response.json() as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    this.raw = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    try { return JSON.parse(this.raw); } catch { if (!repair) return this.request(this.raw, true); throw new AppError("AI_INVALID_RESPONSE", "The AI response format could not be recognized. Please try again.", 502); }
  }
  private async validated<T>(prompt: string, schema: { safeParse(v: unknown): { success: boolean; data?: T } }) {
    let value = await this.request(prompt); let parsed = schema.safeParse(value); if (parsed.success) return parsed.data as T;
    value = await this.request(JSON.stringify(value), true); parsed = schema.safeParse(value); if (parsed.success) return parsed.data as T;
    throw new AppError("AI_SCHEMA_ERROR", "The AI response is missing required fields. Please try again.", 502);
  }
  extractFarmRecord(input: ExtractFarmRecordInput) { return this.validated(extractFarmRecordPrompt(input.text, input.today ?? new Date().toISOString().slice(0,10)), extractedFarmRecordSchema); }
  generateFarmJournal(input: GenerateFarmJournalInput) { return this.validated(generateFarmJournalPrompt(input), generatedDocumentSchema); }
  generateTraceabilityDraft(input: GenerateTraceabilityInput) { return this.validated(generateTraceabilityPrompt(input), generatedDocumentSchema); }
  generateBrandCopy(input: GenerateBrandCopyInput) { return this.validated(generateBrandCopyPrompt(input), generatedBrandCopySchema); }
}
