const entityMap: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(value: string) {
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (_, entity: string) => {
    if (entity[0] === "#") {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : " ";
    }
    return entityMap[entity.toLowerCase()] ?? " ";
  });
}

function clean(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " ")).replace(/\s+/g, " ").trim();
}

function articleBodyBlocks(html: string) {
  const start = /<div\b[^>]*class=["'][^"']*\barticlepara\b[^"']*["'][^>]*>/i.exec(html);
  if (!start || start.index === undefined) return [];
  const from = start.index + start[0].length;
  let depth = 1;
  let end = html.length;
  for (const tag of html.slice(from).matchAll(/<\/?div\b[^>]*>/gi)) {
    depth += tag[0].startsWith("</") ? -1 : 1;
    if (depth === 0) { end = from + (tag.index ?? 0); break; }
  }
  return html.slice(from, end)
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(?:p|section|h[1-6])>/gi, "\n")
    .split(/\n+/)
    .map(clean)
    .flatMap(value => value.length <= 1_500 ? [value] : value.match(/.{1,1100}(?:[。；，,]|$)/gu) ?? [])
    .filter(value => value.length >= 30 && value.length <= 1_500);
}

export function parseHtmlDocument(html: string, pageUrl: string) {
  const withoutNoise = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const title = clean(withoutNoise.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || withoutNoise.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || new URL(pageUrl).hostname);
  const genericBlocks = [...withoutNoise.matchAll(/<(h[1-6]|p|li|tr|td|th|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/\1>/gi)]
    .map(match => clean(match[2]))
    .filter(value => value.length >= 18 && value.length <= 1_500);
  const articleBlocks = articleBodyBlocks(withoutNoise);
  const blocks = articleBlocks.length ? articleBlocks : genericBlocks;
  const links = [...withoutNoise.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(match => {
    try { return [{ url: new URL(match[1], pageUrl).toString(), label: clean(match[2]) }]; } catch { return []; }
  });
  return { title, blocks: [...new Set(blocks)], links };
}

export function queryTerms(question: string) {
  const chunks = question.toLowerCase().match(/[\p{Script=Han}]+|[a-z0-9]+/gu) ?? [];
  const terms = new Set<string>();
  if (question.includes("溫濕度")) { terms.add("溫度"); terms.add("濕度"); }
  if (question.includes("板結")) { terms.add("不透水層"); terms.add("硬實層"); }
  if (question.includes("土壤檢測")) terms.add("土壤分析");
  if (question.includes("幼嫩")) { terms.add("嫩葉"); terms.add("嫩芽"); }
  if (question.includes("整地")) terms.add("深耕");
  if (question.includes("作畦") || question.includes("畦高")) { terms.add("弧形畦"); terms.add("畦面高"); }
  if (question.includes("殘株") || question.includes("殘蔓")) { terms.add("殘留莖葉"); terms.add("殘留藷塊"); }
  if (question.includes("分梳")) terms.add("分把");
  if (question.includes("乳汁") || question.includes("蕉乳")) { terms.add("去乳汁"); terms.add("蕉乳"); }
  if (question.includes("風吹") || question.includes("支撐")) terms.add("防風支柱");
  for (const chunk of chunks) {
    if (/^[\p{Script=Han}]+$/u.test(chunk)) {
      const segments = chunk
        .replace(/如何|怎麼|什麼|為什麼|是否|可以|請問|相關|資料|證明|哪些|哪個|需要|應該|以及|或者|麻煩|告訴我/g, " ")
        .match(/[\p{Script=Han}]+/gu) ?? [];
      for (const segment of segments) {
        if (segment.length > 1) terms.add(segment);
        if (segment.length >= 4) for (let index = 0; index < segment.length - 1; index += 1) terms.add(segment.slice(index, index + 2));
      }
      continue;
    }
    if (["the", "and", "for", "with", "what", "when", "where", "which", "how", "can", "could", "should", "would", "about", "please", "tell", "me"].includes(chunk) || chunk.length < 3) continue;
    terms.add(chunk.endsWith("es") && chunk.length > 4 ? chunk.slice(0, -2) : chunk.endsWith("s") && chunk.length > 3 ? chunk.slice(0, -1) : chunk);
  }
  return [...terms];
}

export function relevanceScore(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  if (!terms.length) return 0;
  let matchedWeight = 0;
  let occurrenceBonus = 0;
  const totalWeight = terms.reduce((sum, term) => sum + Math.max(1, Math.min(term.length, 8)), 0);
  for (const term of terms) {
    const count = normalized.split(term).length - 1;
    if (count > 0) matchedWeight += Math.max(1, Math.min(term.length, 8));
    occurrenceBonus += Math.min(count, 3);
  }
  const coverage = matchedWeight / Math.max(1, totalWeight);
  return Math.min(1, coverage * 0.9 + Math.min(0.1, occurrenceBonus * 0.02));
}

export function isRelevantEvidence(text: string, question: string) {
  const terms = queryTerms(question);
  if (!terms.length) return false;
  const normalized = text.toLowerCase();
  const matched = terms.filter(term => normalized.includes(term));
  const totalWeight = terms.reduce((sum, term) => sum + Math.max(1, Math.min(term.length, 8)), 0);
  const matchedWeight = matched.reduce((sum, term) => sum + Math.max(1, Math.min(term.length, 8)), 0);
  const coverage = matchedWeight / Math.max(1, totalWeight);
  if (terms.length <= 2) return matched.length >= 1;
  return matched.length >= 2 && coverage >= 0.2;
}

export function bestExcerpts(blocks: string[], question: string, limit = 3) {
  const terms = queryTerms(question);
  return blocks
    .map(text => ({ text, score: relevanceScore(text, terms) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
    .slice(0, limit);
}
