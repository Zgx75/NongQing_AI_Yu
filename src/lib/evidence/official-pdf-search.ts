import { createHash } from "node:crypto";
import { cached } from "@/lib/open-data/cache";
import { bestExcerpts, queryTerms, relevanceScore } from "./html-search";
import { fetchPublicPdf, isWithinSource } from "./url-policy";
import index from "./official-pdf-index.json";
import type { EvidenceSearchResult, TrustedSourceInput } from "./search-agent";

type IndexedPdf = (typeof index.documents)[number];

function questionCrop(question: string) {
  if (/高山茶|茶樹|茶園|茶葉|茶苗|茶菁/u.test(question)) return "tea";
  if (/甘藷|地瓜|番薯/u.test(question)) return "sweet_potato";
  if (/香蕉|蕉園|蕉株|蕉苗|蕉果/u.test(question)) return "banana";
  return "";
}

export function officialPdfCandidates(question: string, source: Pick<TrustedSourceInput, "url" | "domain" | "searchScope">): IndexedPdf[] {
  if (source.searchScope !== "SITE") return [];
  const crop = questionCrop(question);
  return index.documents.filter(document => document.crop === crop && document.topics.some(topic => question.includes(topic)) && isWithinSource(document.url, source));
}

async function currentPdfMatchesIndex(document: IndexedPdf, domain: string) {
  const verification = await cached(`official-pdf-hash:${document.url}:${document.sha256}`, 60 * 60_000, async () => {
    const response = await fetchPublicPdf(document.url, domain);
    return createHash("sha256").update(response.bytes).digest("hex") === document.sha256;
  });
  return verification.data;
}

export async function officialPdfEvidence(question: string, source: TrustedSourceInput) {
  const results: EvidenceSearchResult[] = [];
  const warnings: string[] = [];
  for (const document of officialPdfCandidates(question, source).slice(0, 2)) {
    try {
      if (!await currentPdfMatchesIndex(document, source.domain)) {
        warnings.push(`${source.name}: indexed PDF changed; citation withheld (${document.url})`);
        continue;
      }
      const terms = queryTerms(question);
      const candidates = document.pages.flatMap(page => bestExcerpts(page.chunks, question, 2).map(item => {
        const topicHits = document.topics.filter(topic => question.includes(topic) && item.text.includes(topic)).length;
        const score = relevanceScore(item.text, terms) * 0.55 + Math.min(topicHits, 3) * 0.12;
        return { page: page.number, text: item.text, score };
      })).filter(item => item.score >= 0.12)
        // These older manuals may contain superseded pesticide rates and residue limits.
        .filter(item => !/農藥|藥劑|殺菌劑|殺蟲劑|除草劑|煤油|殘留量|稀釋\s*[\d,]+|\d+\s*倍/u.test(item.text))
        .sort((a, b) => b.score - a.score).slice(0, 3);
      for (const item of candidates) {
        results.push({
          sourceId: source.id,
          sourceName: source.name,
          title: `${document.title}（PDF 第 ${item.page} 頁）`,
          url: `${document.url}#page=${item.page}`,
          excerpt: item.text.slice(0, 900),
          relevanceScore: item.score,
          provider: "trusted-pdf-verified",
        });
      }
    } catch (error) {
      warnings.push(`${source.name}: official PDF unavailable (${document.url}: ${error instanceof Error ? error.message : "unknown error"})`);
    }
  }
  return { results, warnings };
}
