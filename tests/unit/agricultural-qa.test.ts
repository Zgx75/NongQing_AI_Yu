import { afterEach, describe, expect, it, vi } from "vitest";
import { answerAgriculturalQuestion } from "@/lib/ai/agricultural-qa";
import type { EvidenceSearchResult } from "@/lib/evidence/search-agent";
import { archiveUrlForSource, officialArchiveByUrl } from "@/lib/evidence/official-archive";

const result = (url = "https://kmweb.moa.gov.tw/article/1"): EvidenceSearchResult => ({
  sourceId: "source-1", sourceName: "農業知識入口網", title: "番茄肥培管理", url,
  excerpt: "番茄結果期應依土壤分析與植株生長狀況調整肥培，並避免過量施用。", relevanceScore: 0.88, provider: "trusted-web-direct",
});

describe("農業問答安全規則", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
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

  it("不把原網址已失效的官方快照當成可查證引用", async () => {
    const snapshot = { ...result(), provider: "trusted-web-snapshot" };
    const answer = await answerAgriculturalQuestion("番茄結果期肥培要注意什麼？", [snapshot]);
    expect(answer.mode).toBe("insufficient-evidence");
    expect(answer.citations).toHaveLength(0);
  });

  it("僅接受能檢視封存全文並核對擷取日期的官方快照作為引用", async () => {
    const url = "https://kmweb.moa.gov.tw/subject/subject.php?id=19322";
    const snapshot = officialArchiveByUrl(url)!;
    const evidence: EvidenceSearchResult = {
      sourceId: "sweet-potato", sourceName: "農業知識入口網", title: snapshot.title, url,
      excerpt: snapshot.blocks.find(block => block.includes("癒傷"))!, relevanceScore: 0.9,
      provider: "trusted-web-snapshot", retrievedAt: snapshot.retrieved_at, archiveUrl: archiveUrlForSource(url),
    };
    const answer = await answerAgriculturalQuestion("甘藷塊根採後為何要做癒傷處理？", [evidence]);
    expect(answer.mode).toBe("grounded-extractive");
    expect(answer.citations[0].archiveUrl).toBe(archiveUrlForSource(url));
    const forged = await answerAgriculturalQuestion("甘藷塊根採後為何要做癒傷處理？", [{ ...evidence, retrievedAt: "2025-01-01T00:00:00Z" }]);
    expect(forged.mode).toBe("insufficient-evidence");
  });

  it("高風險用藥問題沒有主管機關來源時不提供操作結論", async () => {
    const answer = await answerAgriculturalQuestion("農藥要稀釋幾倍？", [result()]);
    expect(answer.mode).toBe("safety-blocked");
    expect(answer.answer).toContain("will not provide a definitive dosage");
  });

  it("肥料施用量不會被誤判為農藥用量", async () => {
    const evidence: EvidenceSearchResult = {
      sourceId: "tea", sourceName: "農業知識入口網", title: "茶樹肥培管理",
      url: "https://kmweb.moa.gov.tw/subject/subject.php?id=7155",
      excerpt: "茶園施肥量應依土壤檢測及茶樹生長狀態調整有機質肥料的施用量。",
      relevanceScore: 0.9, provider: "trusted-web-direct",
    };
    const answer = await answerAgriculturalQuestion("茶園有機質肥料施用量如何決定？", [evidence]);
    expect(answer.mode).toBe("grounded-extractive");
    expect(answer.citations).toHaveLength(1);
  });

  it("非農藥資材問題不被農藥規則誤擋", async () => {
    const evidence: EvidenceSearchResult = {
      sourceId: "tea", sourceName: "農業知識入口網", title: "茶小綠葉蟬非農藥防治資材",
      url: "https://kmweb.moa.gov.tw/subject/subject.php?id=7156",
      excerpt: "茶小綠葉蟬可查詢已刊載的非農藥資材資訊。",
      relevanceScore: 0.9, provider: "trusted-web-direct",
    };
    const answer = await answerAgriculturalQuestion("防治茶小綠葉蟬時，有哪些已刊載的非農藥資材可供查詢？", [evidence]);
    expect(answer.mode).toBe("grounded-extractive");
    expect(answer.citations).toHaveLength(1);
  });

  it("有官方出處的菇舍清潔稀釋資訊不被誤判為農藥處方", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_MODEL", "test-model");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        answerable: true,
        answer: "栽培前可按原文以漂白水稀釋 10 倍清潔菇舍，感染太空包應移出菇舍。[1]",
        citationNumbers: [1], relatedCitationNumbers: [],
      }) }] } }],
    }), { status: 200 })));
    const evidence: EvidenceSearchResult = {
      sourceId: "mushroom", sourceName: "農業知識入口網", title: "菇類栽培技術－香菇",
      url: "https://kmweb.moa.gov.tw/theme_data.php?id=54519",
      excerpt: "香菇栽培前建議漂白水稀釋10倍清潔菇舍，發現綠黴感染應將感病太空包移出菇舍。",
      relevanceScore: 0.9, provider: "trusted-web-direct",
    };
    const answer = await answerAgriculturalQuestion("香菇栽培場木黴菌感染如何處理？", [evidence]);
    expect(answer.mode).toBe("grounded-ai");
    expect(answer.citations).toHaveLength(1);
  });

  it("引用中繼資料涵蓋答案正文的所有來源編號", async () => {
    vi.stubEnv("AI_PROVIDER", "gemini");
    vi.stubEnv("GEMINI_MODEL", "test-model");
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      candidates: [{ content: { parts: [{ text: JSON.stringify({
        answerable: true,
        answer: "甘藷施肥應考慮土壤及生長狀態 [1, 2]。",
        citationNumbers: [1, 2], relatedCitationNumbers: [],
      }) }] } }],
    }), { status: 200 })));
    const answer = await answerAgriculturalQuestion("甘藷如何施肥？", [result(), result()]);
    expect(answer.mode).toBe("grounded-ai");
    expect(answer.citations.map(citation => citation.index)).toEqual([1, 2]);
  });
});
