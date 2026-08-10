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
    const english = /[a-z]/i.test(text);
    const hasTea = /茶園|茶樹|茶|tea/i.test(text);
    const hasWater = /澆水|灌溉|watered|watering|irrigat/i.test(text);
    const duration = text.match(/(?:大約|約)?([一二三四五六七八九十\d]+)\s*小時/i) || text.match(/(?:about\s+)?([a-z\d]+)\s*hours?/i);
    const date = /今天|today/i.test(text) ? (input.today ?? new Date().toISOString().slice(0, 10)) : null;
    const result = {
      recordDate: f(date, date ? "USER_INPUT" : "UNKNOWN", date ? .95 : 0),
      recordTime: f(/早上|上午|morning/i.test(text) ? (english ? "Morning" : "早上") : /下午|afternoon/i.test(text) ? (english ? "Afternoon" : "下午") : null, /早上|上午|下午|morning|afternoon/i.test(text) ? "USER_INPUT" : "UNKNOWN", .9),
      farmId: f(input.farmId ?? null, input.farmId ? "USER_PROFILE" : "UNKNOWN", input.farmId ? 1 : 0),
      plotId: f(input.plotId ?? null, input.plotId ? "USER_PROFILE" : "UNKNOWN", input.plotId ? 1 : 0),
      crop: f(hasTea ? (english ? "Tea" : "茶") : null, hasTea ? "USER_INPUT" : "UNKNOWN", hasTea ? .95 : 0), variety: f(null, "UNKNOWN", 0),
      actionType: f(hasWater ? (english ? "Watering" : "澆水") : null, hasWater ? "USER_INPUT" : "UNKNOWN", hasWater ? .98 : 0),
      purpose: f(null, "UNKNOWN", 0), materialName: f(null, "UNKNOWN", 0), amount: f(null, "UNKNOWN", 0), unit: f(null, "UNKNOWN", 0),
      dilutionRatio: f(null, "UNKNOWN", 0), weather: f(null, "UNKNOWN", 0),
      duration: f(duration ? (english ? `About ${duration[1]} hour(s)` : `約${duration[1]}小時`) : null, duration ? "USER_INPUT" : "UNKNOWN", duration ? .95 : 0),
      notes: f(text || null, text ? "USER_INPUT" : "UNKNOWN", text ? 1 : 0),
      missingFields: [!input.plotId && (english ? "Plot" : "田區"), !hasWater && (english ? "Farm activity" : "農務動作"), english ? "Weather" : "天氣", english ? "Operator" : "操作者"].filter(Boolean) as string[],
      warnings: [english ? "The system did not infer water amount, equipment, or agronomic outcomes. Please review the record." : "系統未推測水量、設備或農學效果；請由使用者確認。"],
    } as const;
    this.raw = JSON.stringify(result);
    return extractedFarmRecordSchema.parse(result);
  }

  async generateFarmJournal(input: GenerateFarmJournalInput) {
    const facts = values(input.confirmedData);
    const weather = input.weather || "Weather data is not available.";
    const result = { title: "Farm Log Draft", body: `${facts.join("; ")}. ${weather}`, pendingItems: input.weather ? [] : ["Weather"], usedFacts: facts, disclaimer: "This content was organized with AI assistance and requires human review." };
    this.raw = JSON.stringify(result); return generatedDocumentSchema.parse(result);
  }
  async generateTraceabilityDraft(input: GenerateTraceabilityInput) {
    const facts = values(input.confirmedData);
    const result = { title: "Traceability Submission Draft", body: facts.join("; "), pendingItems: [], usedFacts: facts, disclaimer: "This content was organized with AI assistance and must be reviewed by the farmer or an authorized person. It is not a guarantee of regulatory compliance." };
    this.raw = JSON.stringify(result); return generatedDocumentSchema.parse(result);
  }
  async generateBrandCopy(input: GenerateBrandCopyInput) {
    const facts = [...values(input.profile), ...(input.confirmedStyleElements || [])];
    const brand = String(input.profile.brandName || "Farm Goods");
    const result = { title: `${brand}: bringing the care of the land to your home`, body: `${facts.join(", ")}. Every story begins with facts confirmed by the farmer.`, callToAction: "Contact us to learn about this season's products.", hashtags: ["TaiwanAgriculture", "FarmStory", brand.replace(/\s/g, "")], pendingItems: [], usedFacts: facts, disclaimer: "This content was organized with AI assistance and requires human review." };
    const invalid = validateBrandClaims(`${result.title}${result.body}`, facts); if (invalid.length) throw new Error(`Unsupported claims are not allowed: ${invalid.join(", ")}`);
    this.raw = JSON.stringify(result); return generatedBrandCopySchema.parse(result);
  }
}
