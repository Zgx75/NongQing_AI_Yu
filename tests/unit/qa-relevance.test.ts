import { afterEach, describe, expect, it, vi } from "vitest";
import { answerAgriculturalQuestion } from "@/lib/ai/agricultural-qa";
import { isRelevantEvidence, queryTerms } from "@/lib/evidence/html-search";
import type { EvidenceSearchResult } from "@/lib/evidence/search-agent";

function evidence(excerpt: string): EvidenceSearchResult {
  return {
    sourceId: "source-1",
    sourceName: "Approved agriculture source",
    title: "Tomato guidance",
    url: "https://kmweb.moa.gov.tw/article/1",
    excerpt,
    relevanceScore: 0.9,
    provider: "trusted-web-direct",
  };
}

describe("agricultural Q&A relevance guard", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

  it("removes generic question words from retrieval terms", () => {
    const terms = queryTerms("請問番茄如何防治蚜蟲");
    expect(terms).not.toContain("如何");
    expect(terms.some(term => term.includes("番茄"))).toBe(true);
    expect(terms.some(term => term.includes("蚜蟲"))).toBe(true);
  });

  it("rejects a passage that shares only the crop but answers a different topic", async () => {
    const question = "How can I prevent aphids on tomatoes?";
    const unrelated = evidence("Tomato fertilizer should be applied after soil testing to support fruit growth.");
    expect(isRelevantEvidence(`${unrelated.title} ${unrelated.excerpt}`, question)).toBe(false);
    const answer = await answerAgriculturalQuestion(question, [unrelated]);
    expect(answer.mode).toBe("insufficient-evidence");
    expect(answer.citations).toHaveLength(0);
  });

  it("keeps evidence that covers both the crop and the requested pest topic", async () => {
    const question = "How can I prevent aphids on tomatoes?";
    const related = evidence("To prevent aphids on tomato plants, inspect new leaves and manage aphid populations early.");
    expect(isRelevantEvidence(`${related.title} ${related.excerpt}`, question)).toBe(true);
    const answer = await answerAgriculturalQuestion(question, [related]);
    expect(answer.mode).toBe("grounded-extractive");
    expect(answer.citations).toHaveLength(1);
  });

  it("lets Gemini recognize relevant evidence expressed with different terminology", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-3.8-flash");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({ answerable: true, answer: "Use early monitoring [1].", citationNumbers: [1] }) }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } })));
    const question = "How do I control green peach aphids on tomatoes?";
    const synonymEvidence = evidence("Early monitoring helps manage Myzus persicae infestations in solanaceous crops.");
    expect(isRelevantEvidence(`${synonymEvidence.title} ${synonymEvidence.excerpt}`, question)).toBe(false);
    const answer = await answerAgriculturalQuestion(question, [synonymEvidence]);
    expect(answer.mode).toBe("grounded-ai");
    expect(answer.citations).toHaveLength(1);
  });
});
