import { fetchPublicPage, isWithinSource } from "./url-policy";
import { bestExcerpts, parseHtmlDocument, queryTerms, relevanceScore } from "./html-search";
import { sourceSearchEntryUrl } from "./source-search";

export type TrustedSourceInput = { id: string; name: string; url: string; domain: string; description: string; searchScope: string };
export type EvidenceSearchResult = { sourceId: string; sourceName: string; title: string; url: string; excerpt: string; relevanceScore: number; provider: string };
export type EvidenceSearchOutput = { provider: string; results: EvidenceSearchResult[]; warnings: string[] };

async function searchPage(url: string, source: TrustedSourceInput, question: string) {
  const response = await fetchPublicPage(url, source.domain);
  const document = parseHtmlDocument(response.html, response.url);
  return { response, document, excerpts: bestExcerpts(document.blocks, question) };
}

async function directSearchSource(source: TrustedSourceInput, question: string) {
  const warnings: string[] = [];
  try {
    const landing = await searchPage(sourceSearchEntryUrl(source, question), source, question);
    const pages = [landing];
    if (source.searchScope === "SITE") {
      const terms = queryTerms(question);
      const candidates = landing.document.links
        .filter(link => isWithinSource(link.url, source) && link.url !== landing.response.url)
        .map(link => ({ ...link, score: relevanceScore(`${link.label} ${link.url}`, terms) }))
        .filter(link => link.score > 0)
        .sort((a, b) => b.score - a.score)
        .filter((link, index, list) => list.findIndex(other => other.url === link.url) === index)
        .slice(0, 4);
      const settled = await Promise.allSettled(candidates.map(link => searchPage(link.url, source, question)));
      for (const result of settled) if (result.status === "fulfilled") pages.push(result.value);
    }
    const results = pages.flatMap(page => page.excerpts.map(excerpt => ({
      sourceId: source.id,
      sourceName: source.name,
      title: page.document.title,
      url: page.response.url,
      excerpt: excerpt.text.slice(0, 900),
      relevanceScore: excerpt.score,
      provider: "trusted-web-direct",
    })));
    return { results, warnings };
  } catch (error) {
    warnings.push(`${source.name}：${error instanceof Error ? error.message : "讀取失敗"}`);
    return { results: [] as EvidenceSearchResult[], warnings };
  }
}

async function searchWithTavily(question: string, sources: TrustedSourceInput[]): Promise<EvidenceSearchOutput> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY 尚未設定");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, query: question, search_depth: "advanced", max_results: 10, include_domains: [...new Set(sources.map(source => source.domain))], include_answer: false, include_raw_content: false }),
  });
  if (!response.ok) throw new Error(`搜尋服務回應 ${response.status}`);
  const payload = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; score?: number }> };
  const results = (payload.results ?? []).flatMap(item => {
    if (!item.url) return [];
    const source = sources.find(candidate => isWithinSource(item.url!, candidate));
    if (!source) return [];
    return [{ sourceId: source.id, sourceName: source.name, title: item.title || source.name, url: item.url, excerpt: (item.content || "").slice(0, 900), relevanceScore: Math.max(0, Math.min(1, item.score ?? 0)), provider: "tavily" }];
  });
  return { provider: "tavily", results, warnings: [] };
}

export async function searchTrustedWeb(question: string, sources: TrustedSourceInput[]): Promise<EvidenceSearchOutput> {
  const useTavily = process.env.WEB_SEARCH_PROVIDER === "tavily" || (process.env.WEB_SEARCH_PROVIDER === "auto" && Boolean(process.env.TAVILY_API_KEY));
  if (useTavily) {
    try { return await searchWithTavily(question, sources); }
    catch (error) {
      const fallback = await directSearch(question, sources);
      fallback.warnings.unshift(`搜尋服務暫時無法使用，已改為直接搜尋核准頁面：${error instanceof Error ? error.message : "未知錯誤"}`);
      return fallback;
    }
  }
  return directSearch(question, sources);
}

async function directSearch(question: string, sources: TrustedSourceInput[]): Promise<EvidenceSearchOutput> {
  const settled = await Promise.all(sources.slice(0, 10).map(source => directSearchSource(source, question)));
  const results = settled.flatMap(item => item.results).sort((a, b) => b.relevanceScore - a.relevanceScore).slice(0, 10);
  return { provider: "trusted-web-direct", results, warnings: settled.flatMap(item => item.warnings) };
}
