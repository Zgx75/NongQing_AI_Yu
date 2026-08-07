import { describe, expect, it } from "vitest";
import { answerAgriculturalQuestion } from "@/lib/ai/agricultural-qa";
import type { EvidenceSearchResult } from "@/lib/evidence/search-agent";

const result = (url = "https://kmweb.moa.gov.tw/article/1"): EvidenceSearchResult => ({
  sourceId: "source-1", sourceName: "農業知識入口網", title: "番茄肥培管理", url,
  excerpt: "番茄結果期應依土壤分析與植株生長狀況調整肥培，並避免過量施用。", relevanceScore: 0.88, provider: "trusted-web-direct",
});

describe("農業問答安全規則", () => {
  it("沒有來源時拒絕猜測", async () => {
    const answer = await answerAgriculturalQuestion("番茄怎麼施肥？", []);
    expect(answer.mode).toBe("insufficient-evidence");
    expect(answer.citations).toHaveLength(0);
  });

  it("一般問題使用來源段落並附引用", async () => {
    const answer = await answerAgriculturalQuestion("番茄結果期肥培要注意什麼？", [result()]);
    expect(answer.mode).toBe("grounded-extractive");
    expect(answer.answer).toContain("[1]");
    expect(answer.citations[0].url).toContain("kmweb.moa.gov.tw");
  });

  it("高風險用藥問題沒有主管機關來源時不提供操作結論", async () => {
    const answer = await answerAgriculturalQuestion("農藥要稀釋幾倍？", [result()]);
    expect(answer.mode).toBe("safety-blocked");
    expect(answer.answer).toContain("will not provide a definitive dosage");
  });
});
