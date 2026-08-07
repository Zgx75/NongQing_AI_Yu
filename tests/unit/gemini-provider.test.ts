import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GeminiAIProvider } from "@/lib/ai/gemini-provider";

const validRecord = {
  recordDate: { value: "2026-08-07", source: "USER_INPUT", confidence: 0.98 },
  recordTime: { value: "morning", source: "USER_INPUT", confidence: 0.95 },
  farmId: { value: null, source: "UNKNOWN", confidence: 0 },
  plotId: { value: null, source: "UNKNOWN", confidence: 0 },
  crop: { value: "tea", source: "USER_INPUT", confidence: 0.98 },
  variety: { value: null, source: "UNKNOWN", confidence: 0 },
  actionType: { value: "watering", source: "USER_INPUT", confidence: 0.99 },
  purpose: { value: null, source: "UNKNOWN", confidence: 0 },
  materialName: { value: null, source: "UNKNOWN", confidence: 0 },
  amount: { value: null, source: "UNKNOWN", confidence: 0 },
  unit: { value: null, source: "UNKNOWN", confidence: 0 },
  dilutionRatio: { value: null, source: "UNKNOWN", confidence: 0 },
  weather: { value: null, source: "UNKNOWN", confidence: 0 },
  duration: { value: "about one hour", source: "USER_INPUT", confidence: 0.98 },
  notes: { value: "Watered the tea field this morning for about one hour.", source: "USER_INPUT", confidence: 1 },
  missingFields: ["plotId", "variety", "purpose", "materialName", "amount", "unit", "dilutionRatio", "weather"],
  warnings: [],
};

function geminiResponse(value: unknown) {
  return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: typeof value === "string" ? value : JSON.stringify(value) }] } }] }), { status: 200, headers: { "content-type": "application/json" } });
}

describe("Gemini farm-record extraction", () => {
  beforeEach(() => { process.env.GEMINI_API_KEY = "test-key"; process.env.GEMINI_MODEL = "test-model"; });
  afterEach(() => { vi.unstubAllGlobals(); delete process.env.GEMINI_API_KEY; delete process.env.GEMINI_MODEL; });

  it("repairs a response that invented different field names", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(geminiResponse({ date: "2026-08-07", time_of_day: "morning", activity: "watering" }))
      .mockResolvedValueOnce(geminiResponse(validRecord));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GeminiAIProvider().extractFarmRecord({ text: "Watered the tea field this morning for about one hour.", today: "2026-08-07" });

    expect(result.actionType.value).toBe("watering");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const repairBody = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(repairBody.contents[0].parts[0].text).toContain("ORIGINAL TASK");
    expect(repairBody.contents[0].parts[0].text).toContain('"recordDate"');
  });

  it("accepts a valid object returned as a JSON-encoded string", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(geminiResponse(JSON.stringify(validRecord)));
    vi.stubGlobal("fetch", fetchMock);

    const result = await new GeminiAIProvider().extractFarmRecord({ text: "Watered the tea field this morning for about one hour.", today: "2026-08-07" });

    expect(result.crop.value).toBe("tea");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
