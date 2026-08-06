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

export function parseHtmlDocument(html: string, pageUrl: string) {
  const withoutNoise = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ").replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ");
  const title = clean(withoutNoise.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] || withoutNoise.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1] || new URL(pageUrl).hostname);
  const blocks = [...withoutNoise.matchAll(/<(?:h[1-6]|p|li|td|th|blockquote|figcaption)\b[^>]*>([\s\S]*?)<\/(?:h[1-6]|p|li|td|th|blockquote|figcaption)>/gi)]
    .map(match => clean(match[1]))
    .filter(value => value.length >= 18 && value.length <= 1_500);
  const links = [...withoutNoise.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].flatMap(match => {
    try { return [{ url: new URL(match[1], pageUrl).toString(), label: clean(match[2]) }]; } catch { return []; }
  });
  return { title, blocks: [...new Set(blocks)], links };
}

export function queryTerms(question: string) {
  const chunks = question.toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  const terms = new Set<string>();
  for (const chunk of chunks) {
    if (chunk.length > 1) terms.add(chunk);
    if (/^[\p{Script=Han}]+$/u.test(chunk) && chunk.length >= 4) {
      for (let index = 0; index < chunk.length - 1; index += 1) terms.add(chunk.slice(index, index + 2));
    }
  }
  return [...terms].filter(term => !["如何", "什麼", "是否", "可以", "相關", "資料", "證明"].includes(term));
}

export function relevanceScore(text: string, terms: string[]) {
  const normalized = text.toLowerCase();
  if (!terms.length) return 0;
  let matches = 0;
  for (const term of terms) {
    const count = normalized.split(term).length - 1;
    matches += Math.min(count, 3) * Math.max(1, Math.min(term.length, 5));
  }
  return Math.min(1, matches / Math.max(10, terms.reduce((sum, term) => sum + Math.min(term.length, 5), 0)));
}

export function bestExcerpts(blocks: string[], question: string, limit = 2) {
  const terms = queryTerms(question);
  return blocks
    .map(text => ({ text, score: relevanceScore(text, terms) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.text.length - a.text.length)
    .slice(0, limit);
}
