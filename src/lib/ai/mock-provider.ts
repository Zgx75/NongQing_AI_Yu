import type { AIProvider } from "./provider";
import { extractedFarmRecordSchema, generatedBrandCopySchema, generatedDocumentSchema, type ExtractFarmRecordInput, type GenerateBrandCopyInput, type GenerateFarmJournalInput, type GenerateTraceabilityInput } from "./schemas";
import { validateBrandClaims } from "./safety-validator";

const f = <T>(value: T | null, source: "USER_INPUT" | "USER_PROFILE" | "AI_INFERENCE" | "UNKNOWN", confidence: number) => ({ value, source, confidence });
const values = (data: Record<string, unknown>) => Object.values(data).map(v => typeof v === "object" && v && "value" in v ? String((v as {value: unknown}).value ?? "") : String(v ?? "")).filter(Boolean);

export class MockAIProvider implements AIProvider {
  providerName = "mock";
  modelName = "deterministic-mock-v1";
  private raw = "";
  getLastRawResponse() { return this.raw; }

  async extractFarmRecord(input: ExtractFarmRecordInput) {
    const text = input.text.trim();
    const hasTea = /茶園|茶樹|茶/.test(text);
    const hasWater = /澆水|灌溉/.test(text);
    const duration = text.match(/(?:大約|約)?([一二三四五六七八九十\d]+)\s*小時/);
    const date = /今天/.test(text) ? (input.today ?? new Date().toISOString().slice(0, 10)) : null;
    const result = {
      recordDate: f(date, date ? "USER_INPUT" : "UNKNOWN", date ? .95 : 0),
      recordTime: f(/早上|上午/.test(text) ? "早上" : /下午/.test(text) ? "下午" : null, /早上|上午|下午/.test(text) ? "USER_INPUT" : "UNKNOWN", .9),
      farmId: f(input.farmId ?? null, input.farmId ? "USER_PROFILE" : "UNKNOWN", input.farmId ? 1 : 0),
      plotId: f(input.plotId ?? null, input.plotId ? "USER_PROFILE" : "UNKNOWN", input.plotId ? 1 : 0),
      crop: f(hasTea ? "茶" : null, hasTea ? "USER_INPUT" : "UNKNOWN", hasTea ? .95 : 0), variety: f(null, "UNKNOWN", 0),
      actionType: f(hasWater ? "澆水" : null, hasWater ? "USER_INPUT" : "UNKNOWN", hasWater ? .98 : 0),
      purpose: f(null, "UNKNOWN", 0), materialName: f(null, "UNKNOWN", 0), amount: f(null, "UNKNOWN", 0), unit: f(null, "UNKNOWN", 0),
      dilutionRatio: f(null, "UNKNOWN", 0), weather: f(null, "UNKNOWN", 0),
      duration: f(duration ? `約${duration[1]}小時` : null, duration ? "USER_INPUT" : "UNKNOWN", duration ? .95 : 0),
      notes: f(text || null, text ? "USER_INPUT" : "UNKNOWN", text ? 1 : 0),
      missingFields: [!input.plotId && "田區", !hasWater && "農務動作", "天氣", "操作者"].filter(Boolean) as string[],
      warnings: ["系統未推測水量、設備或農學效果；請由使用者確認。"],
    } as const;
    this.raw = JSON.stringify(result);
    return extractedFarmRecordSchema.parse(result);
  }

  async generateFarmJournal(input: GenerateFarmJournalInput) {
    const facts = values(input.confirmedData);
    const weather = input.weather || "天氣資料尚未取得。";
    const result = { title: "農場日誌草稿", body: `${facts.join("；")}。${weather}`, pendingItems: input.weather ? [] : ["天氣"], usedFacts: facts, disclaimer: "本內容由 AI 協助整理，需人工確認。" };
    this.raw = JSON.stringify(result); return generatedDocumentSchema.parse(result);
  }
  async generateTraceabilityDraft(input: GenerateTraceabilityInput) {
    const facts = values(input.confirmedData);
    const result = { title: "產銷履歷申報草稿", body: facts.join("；"), pendingItems: [], usedFacts: facts, disclaimer: "本內容由 AI 協助整理，必須由農民或授權人員確認後使用；不構成法規合規保證。" };
    this.raw = JSON.stringify(result); return generatedDocumentSchema.parse(result);
  }
  async generateBrandCopy(input: GenerateBrandCopyInput) {
    const facts = values(input.profile);
    const brand = String(input.profile.brandName || "農場好物");
    const result = { title: `${brand}，把土地的心意送到你家`, body: `${facts.join("，")}。每一段分享，都從農友親自確認的故事開始。`, callToAction: "歡迎與我們聯絡，了解這一季的產品。", hashtags: ["臺灣農產", "產地故事", brand.replace(/\s/g, "")], pendingItems: [], usedFacts: facts, disclaimer: "本內容由 AI 協助整理，需人工確認。" };
    const invalid = validateBrandClaims(`${result.title}${result.body}`, facts); if (invalid.length) throw new Error(`不允許的未驗證宣稱：${invalid.join("、")}`);
    this.raw = JSON.stringify(result); return generatedBrandCopySchema.parse(result);
  }
}
