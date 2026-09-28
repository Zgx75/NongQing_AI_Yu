import { fetchPublicPage, isWithinSource } from "./url-policy";
import { bestExcerpts, parseHtmlDocument, queryTerms, relevanceScore } from "./html-search";
import { isNegatedMention, sourceSearchEntryUrls, sourceSearchKeywords, sourceSpecificResultUrls } from "./source-search";
import { officialPageUrlsForQuestion } from "./official-pages";
import { officialPdfCandidates, officialPdfEvidence } from "./official-pdf-search";
import { archiveUrlForSource, officialArchiveEvidence } from "./official-archive";
import officialSnapshots from "./official-snapshots.json";

export type TrustedSourceInput = { id: string; name: string; url: string; domain: string; description: string; searchScope: string };
export type EvidenceSearchResult = { sourceId: string; sourceName: string; title: string; url: string; excerpt: string; relevanceScore: number; provider: string; retrievedAt?: string; archiveUrl?: string };
export type SourceSearchDiagnostic = { sourceId: string; sourceName: string; status: "results" | "no_results" | "partial" | "failed"; candidateCount: number; warningCount: number };
export type EvidenceSearchOutput = { provider: string; results: EvidenceSearchResult[]; warnings: string[]; sourceDiagnostics: SourceSearchDiagnostic[] };

const snapshotsByUrl = new Map(officialSnapshots.map(snapshot => [snapshot.url, snapshot]));
const liveFailureUntil = new Map<string, number>();

function cropMention(question: string, text: string) {
  if (/高山茶|茶樹|茶園|茶葉|茶小綠葉蟬/u.test(question)) return /高山茶|(?<!油)茶樹|(?<!油)茶園|茶葉|茶菁|茶區|茶農|(?<!油)茶餅病|茶小綠葉蟬/u.test(text);
  if (/地瓜|甘藷|番薯/u.test(question)) return /地瓜|甘藷|番薯/u.test(text);
  if (question.includes("香菇")) return /香菇|椎茸/u.test(text);
  if (/香蕉|蕉園|蕉株|蕉苗|蕉果/u.test(question)) return /香蕉|蕉園|蕉株|蕉苗|蕉果/u.test(text);
  return true;
}

function namedProblem(question: string) {
  const names = ["茶餅病", "小綠葉蟬", "莖線蟲病", "蟻象", "綠黴病", "木黴菌", "黃葉病", "鐮刀菌枯萎病", "黑星病", "葉斑病"]
    .filter(name => question.includes(name) && !isNegatedMention(question, name));
  if (question.includes("綠黴病") || question.includes("木黴菌")) names.push("綠黴", "木黴");
  return names;
}

function relevantPage(question: string, title: string, excerpt: string) {
  const text = `${title} ${excerpt}`;
  if (!cropMention(question, text)) return false;
  const problems = namedProblem(question);
  if (problems.length && !problems.some(problem => text.includes(problem))) return false;
  // A concise official instruction can be useful evidence (e.g. a 40-character harvest step).
  if (excerpt.length < 25 || title.includes(excerpt.trim())) return false;
  return true;
}

function rankedScore(question: string, title: string, excerpt: string) {
  const keywords = sourceSearchKeywords(question);
  const text = `${title} ${excerpt}`;
  const specificKeywords = keywords.filter(keyword => !/^(?:高山茶|茶樹|甘藷|地瓜|香菇|香蕉)$/u.test(keyword));
  const keywordBonus = specificKeywords.reduce((best, keyword) => Math.max(best, title.includes(keyword) ? 0.32 : text.includes(keyword) ? 0.2 : 0), 0);
  const problemBonus = namedProblem(question).some(problem => title.includes(problem)) ? 0.2 : 0;
  const referencePenalty = /參考文獻|隱私權|資訊安全政策|全站搜尋/u.test(title) ? 0.4 : 0;
  return relevanceScore(text, queryTerms(question)) * 0.4 + keywordBonus + problemBonus - referencePenalty;
}

async function searchPage(url: string, source: TrustedSourceInput, question: string) {
  const snapshot = source.domain === "kmweb.moa.gov.tw" ? snapshotsByUrl.get(url) : undefined;
  const fromSnapshot = () => {
    if (!snapshot) throw new Error("No verified official page snapshot is available.");
    const response = { url, html: "", contentType: "text/plain" };
    const document = { title: snapshot.title, blocks: snapshot.blocks, links: [] as Array<{ url: string; label: string }> };
    return { response, document, excerpts: bestExcerpts(document.blocks, question), provider: "trusted-web-snapshot", snapshotDate: snapshot.retrieved_at };
  };
  if (snapshot && (liveFailureUntil.get(url) ?? 0) > Date.now()) return fromSnapshot();
  try {
    const response = await fetchPublicPage(url, source.domain);
    const requested = new URL(url);
    if (requested.hostname === "kmweb.moa.gov.tw" && requested.searchParams.has("id") && new URL(response.url).searchParams.get("id") !== requested.searchParams.get("id")) {
      throw new Error("The official article redirected to a different page.");
    }
    const document = parseHtmlDocument(response.html, response.url);
    return { response, document, excerpts: bestExcerpts(document.blocks, question), provider: "trusted-web-direct", snapshotDate: "" };
  } catch (error) {
    if (!snapshot) throw error;
    liveFailureUntil.set(url, Date.now() + 5 * 60_000);
    return fromSnapshot();
  }
}

function canonicalArticleUrl(input: string) {
  const url = new URL(input);
  if (url.hostname === "kmweb.moa.gov.tw" && url.pathname.endsWith("/knowledgebase.php") && url.searchParams.has("id")) {
    const id = url.searchParams.get("id")!;
    url.search = "";
    url.searchParams.set("id", id);
  }
  return url.toString();
}

export function evidenceCandidateUrls(question: string, source: TrustedSourceInput, indexedUrls: string[], landings: Array<{ response: { url: string; html: string }; document: { links: Array<{ url: string; label: string }> } }>) {
  const specificUrls = landings.flatMap(landing => sourceSpecificResultUrls(source, question, landing.response.html));
  const landingUrls = new Set(landings.map(landing => landing.response.url));
  const terms = queryTerms(question);
  const discovered = specificUrls.length ? specificUrls : landings.flatMap(landing => {
    const query = new URL(landing.response.url).searchParams.get("keyword") || "";
    return landing.document.links
      .filter(link => isWithinSource(link.url, source) && !landingUrls.has(link.url))
      .filter(link => source.domain !== "kmweb.moa.gov.tw" || (/\/(?:knowledgebase|theme_data|subject|knowledge_view)\.php$/u.test(new URL(link.url).pathname) && new URL(link.url).searchParams.has("id")))
      .map(link => ({ url: canonicalArticleUrl(link.url), score: rankedScore(question, link.label, "") + relevanceScore(link.label, terms) * 0.15 + (query.length > 3 ? 0.08 : 0) }))
      .filter(link => link.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map(link => link.url);
  });
  return [...new Set([...indexedUrls.slice(0, 6).map(canonicalArticleUrl), ...[...new Set(discovered)].slice(0, 18)])].slice(0, 24);
}

async function directSearchSource(source: TrustedSourceInput, question: string) {
  const warnings: string[] = [];
  const results: EvidenceSearchResult[] = [];
  let htmlAttempted = false;
  let htmlSucceeded = false;
  let htmlFailed = false;
  try {
    const readPages = async (urls: string[], label: string) => {
      htmlAttempted ||= urls.length > 0;
      const settled = await Promise.allSettled(urls.map(url => searchPage(url, source, question)));
      const found: Awaited<ReturnType<typeof searchPage>>[] = [];
      for (const [index, result] of settled.entries()) {
        if (result.status === "fulfilled") {
          htmlSucceeded = true;
          found.push(result.value);
          if (result.value.snapshotDate) warnings.push(`${source.name}: using dated official archive captured ${result.value.snapshotDate} after live fetch failed (${result.value.response.url})`);
        } else {
          htmlFailed = true;
          warnings.push(`${source.name}: ${label} failed (${urls[index]}: ${result.reason instanceof Error ? result.reason.message : "unknown error"})`);
        }
      }
      return found;
    };
    // Read a few curated article URLs before making broad site-search requests.
    const indexedUrls = officialPageUrlsForQuestion(question, source.domain).filter(url => isWithinSource(url, source)).slice(0, 4);
    const indexedSet = new Set<string>(indexedUrls);
    const indexedPages = await readPages(indexedUrls, "official page fetch");
    const indexedPassages = indexedPages.flatMap(page => page.excerpts.filter(excerpt => relevantPage(question, page.document.title, excerpt.text)));
    const needsDiscovery = indexedPassages.length < 2;
    const entryUrls = needsDiscovery ? sourceSearchEntryUrls(source, question).slice(0, 2) : [];
    const landings = await readPages(entryUrls, "site-search entry");
    if (entryUrls.length && !landings.length && !indexedPages.length) warnings.push(`${source.name}: all site-search entry pages failed`);
    const pages = [...indexedPages, ...(source.searchScope === "SITE" ? [] : landings)];
    if (source.searchScope === "SITE" && needsDiscovery) {
      const candidates = evidenceCandidateUrls(question, source, indexedUrls, landings)
        .filter(url => !indexedSet.has(url)).slice(0, 6);
      pages.push(...await readPages(candidates, "official page fetch"));
    }
    results.push(...pages.flatMap(page => page.excerpts
      .filter(excerpt => relevantPage(question, page.document.title, excerpt.text))
      .map(excerpt => ({
      sourceId: source.id,
      sourceName: source.name,
      title: page.document.title,
      url: page.response.url,
      excerpt: excerpt.text.slice(0, 900),
      relevanceScore: rankedScore(question, page.document.title, excerpt.text),
      provider: page.provider,
      ...(page.snapshotDate ? { retrievedAt: page.snapshotDate, archiveUrl: archiveUrlForSource(page.response.url) } : {}),
    }))).filter(result => result.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .filter((result, index, list) => list.slice(0, index).filter(other => other.url === result.url).length < 2));
  } catch (error) {
    htmlFailed = true;
    warnings.push(`${source.name}: official webpage search failed (${error instanceof Error ? error.message : "Unable to read source"})`);
  }
  let pdfAttempted = false;
  let pdfFailed = false;
  try {
    pdfAttempted = officialPdfCandidates(question, source).length > 0;
    const pdf = await officialPdfEvidence(question, source);
    results.push(...pdf.results);
    warnings.push(...pdf.warnings);
    pdfFailed = pdf.warnings.length > 0 && pdf.results.length === 0;
  } catch (error) {
    pdfFailed = true;
    warnings.push(`${source.name}: official PDF search failed (${error instanceof Error ? error.message : "Unable to read source"})`);
  }
  const combined = results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  const htmlUnavailable = htmlAttempted && htmlFailed && !htmlSucceeded;
  const allSearchesFailed = htmlUnavailable && (!pdfAttempted || pdfFailed);
  const status = combined.length ? (warnings.length ? "partial" as const : "results" as const) : (allSearchesFailed ? "failed" as const : (htmlFailed || pdfFailed ? "partial" as const : "no_results" as const));
  return { results: combined, warnings, diagnostic: { sourceId: source.id, sourceName: source.name, status, candidateCount: combined.length, warningCount: warnings.length } };
}

async function searchWithTavily(question: string, sources: TrustedSourceInput[]): Promise<EvidenceSearchOutput> {
  const key = process.env.TAVILY_API_KEY;
  if (!key) throw new Error("TAVILY_API_KEY is not configured");
  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    signal: AbortSignal.timeout(12_000),
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ api_key: key, query: question, search_depth: "advanced", max_results: 10, include_domains: [...new Set(sources.map(source => source.domain))], include_answer: false, include_raw_content: false }),
  });
  if (!response.ok) throw new Error(`Search service returned HTTP ${response.status}`);
  const payload = await response.json() as { results?: Array<{ title?: string; url?: string; content?: string; score?: number }> };
  const results = (payload.results ?? []).flatMap(item => {
    if (!item.url) return [];
    const source = sources.find(candidate => isWithinSource(item.url!, candidate));
    if (!source) return [];
    return [{ sourceId: source.id, sourceName: source.name, title: item.title || source.name, url: item.url, excerpt: (item.content || "").slice(0, 900), relevanceScore: Math.max(0, Math.min(1, item.score ?? 0)), provider: "tavily" }];
  });
  // Run the local official-page and PDF path too; external search alone bypasses curated URLs and indexed PDFs.
  const direct = await directSearch(question, sources);
  const fused = new Map<string, { result: EvidenceSearchResult; rankScore: number }>();
  for (const list of [results, direct.results]) {
    const ranked = [...list].sort((left, right) => right.relevanceScore - left.relevanceScore);
    ranked.forEach((result, index) => {
      const key = `${result.sourceId}\u0000${result.url}\u0000${result.excerpt}`;
      const previous = fused.get(key);
      const rankScore = (previous?.rankScore ?? 0) + 1 / (60 + index + 1);
      const preferred = previous?.result.provider === "tavily" && result.provider !== "tavily" ? result : previous?.result ?? result;
      fused.set(key, { result: preferred, rankScore });
    });
  }
  // Provider scores use different scales, so combine ranks rather than comparing raw scores.
  const combined = [...fused.values()].sort((left, right) => right.rankScore - left.rankScore).slice(0, 10).map(item => item.result);
  const warnings = direct.warnings;
  const sourceDiagnostics = sources.map(source => {
    const sourceResultCount = combined.filter(result => result.sourceId === source.id).length;
    const directDiagnostic = direct.sourceDiagnostics.find(diagnostic => diagnostic.sourceId === source.id);
    const sourceWarningCount = directDiagnostic?.warningCount ?? 0;
    const status = sourceResultCount ? (sourceWarningCount ? "partial" as const : "results" as const) : directDiagnostic?.status ?? "no_results" as const;
    return { sourceId: source.id, sourceName: source.name, status, candidateCount: sourceResultCount, warningCount: sourceWarningCount };
  });
  return { provider: `tavily+${direct.provider}`, results: combined, warnings, sourceDiagnostics };
}

export async function searchTrustedWeb(question: string, sources: TrustedSourceInput[]): Promise<EvidenceSearchOutput> {
  const useTavily = process.env.WEB_SEARCH_PROVIDER === "tavily" || (process.env.WEB_SEARCH_PROVIDER === "auto" && Boolean(process.env.TAVILY_API_KEY));
  if (useTavily) {
    try { return await searchWithTavily(question, sources); }
    catch (error) {
      const fallback = await directSearch(question, sources);
      fallback.warnings.unshift(`The search service is temporarily unavailable, so approved pages were searched directly: ${error instanceof Error ? error.message : "Unknown error"}`);
      return fallback;
    }
  }
  return directSearch(question, sources);
}

async function directSearch(question: string, sources: TrustedSourceInput[]): Promise<EvidenceSearchOutput> {
  const usePesticideRegistry = /農藥|藥劑|用藥|稀釋|安全採收|停藥|殘留|合法|許可證/u.test(question);
  const archived = usePesticideRegistry ? [] : officialArchiveEvidence(question, sources);
  const archiveSource = sources.find(source => source.domain === "kmweb.moa.gov.tw" && source.searchScope === "SITE");
  if (archiveSource && archived.length >= 2 && archived[0].relevanceScore >= 0.65) {
    const warning = `${archiveSource.name}: answering from a dated, inspectable official archive captured ${archived[0].retrievedAt}; current webpage content was not checked in this request.`;
    return { provider: "trusted-official-archive", results: archived.slice(0, 10), warnings: [warning], sourceDiagnostics: [{ sourceId: archiveSource.id, sourceName: archiveSource.name, status: "partial", candidateCount: archived.length, warningCount: 1 }] };
  }
  const selectedSources = sources.filter(source => {
    if (source.domain === "pesticide.aphia.gov.tw") return usePesticideRegistry;
    if (source.domain === "www.afa.gov.tw") return /肥|土壤|石灰|養分|地力/u.test(question);
    if (source.domain === "www.aphia.gov.tw") return /病|蟲|害|防治|診斷|檢疫/u.test(question);
    return true;
  });
  if (usePesticideRegistry) selectedSources.sort((left, right) => Number(right.domain === "pesticide.aphia.gov.tw") - Number(left.domain === "pesticide.aphia.gov.tw"));
  const settled = await Promise.all(selectedSources.slice(0, 10).map(source => directSearchSource(source, question)));
  const ranked = [...settled.flatMap(item => item.results), ...archived]
    .sort((a, b) => b.relevanceScore - a.relevanceScore || Number(a.provider === "trusted-web-snapshot") - Number(b.provider === "trusted-web-snapshot"));
  const seen = new Set<string>();
  const perUrl = new Map<string, number>();
  const results = ranked.filter(item => {
    const key = `${item.url}\u0000${item.excerpt.replace(/\s+/gu, "").slice(0, 160)}`;
    if (seen.has(key) || (perUrl.get(item.url) || 0) >= 2) return false;
    seen.add(key);
    perUrl.set(item.url, (perUrl.get(item.url) || 0) + 1);
    return true;
  }).slice(0, 10);
  const archiveUsed = results.some(item => item.provider === "trusted-web-snapshot");
  const warnings = settled.flatMap(item => item.warnings);
  if (archiveUsed) warnings.push("Dated official archive passages were used where current approved pages were unavailable; open the saved copy and confirm current recommendations.");
  const sourceDiagnostics = settled.map(item => {
    const count = results.filter(result => result.sourceId === item.diagnostic.sourceId).length;
    return { ...item.diagnostic, candidateCount: count, status: count && (item.warnings.length || archiveUsed && item.diagnostic.sourceId === archiveSource?.id) ? "partial" as const : count ? "results" as const : item.diagnostic.status };
  });
  return { provider: archiveUsed ? "trusted-web-direct+archive" : "trusted-web-direct", results, warnings, sourceDiagnostics };
}
