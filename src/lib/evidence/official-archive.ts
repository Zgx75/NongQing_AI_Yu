/** A dated, inspectable copy of official articles used when the live site is unavailable. */
import { createHash } from "node:crypto";
import snapshots from "./official-snapshots.json";
import type { EvidenceSearchResult, TrustedSourceInput } from "./search-agent";

type OfficialSnapshot = (typeof snapshots)[number];

const MAX_SEARCH_AGE_MS = 180 * 24 * 60 * 60_000;
const segmenter = new Intl.Segmenter("zh-TW", { granularity: "word" });
const cropPatterns = [
  { question: /高山茶|茶樹|茶園|茶葉|茶苗|茶菁/u, article: /茶樹|茶園|茶葉|茶菁|高山茶/u },
  { question: /甘藷|地瓜|番薯/u, article: /甘藷|地瓜|番薯/u },
  { question: /香菇/u, article: /香菇/u },
  { question: /香蕉|蕉園|蕉株|蕉苗|蕉果/u, article: /香蕉|蕉園|蕉株|蕉苗|蕉果/u },
];
const cropWords = new Set(["高山茶", "茶樹", "茶園", "茶葉", "茶苗", "茶菁", "甘藷", "地瓜", "番薯", "香菇", "香蕉", "蕉園", "蕉株", "蕉苗", "蕉果"]);
const stopWords = new Set([
  "如何", "怎麼", "什麼", "哪些", "哪個", "何時", "是否", "可能", "應該", "可以", "需要", "注意", "前後", "期間", "時候", "時機", "條件", "狀況", "情況", "影響", "管理", "處理", "方式", "方法", "安排", "檢查", "觀察", "判斷", "減少", "避免", "維持", "結果", "目的", "來源", "外觀", "特徵", "不同", "相關", "使用", "施用", "生育", "發育", "生長", "出現", "發生", "過多", "採用", "適合", "什麼事", "要注意", "及其", "以及", "並且", "進行", "初期", "後期", "已經", "還有", "之前", "之後", "田間", "作物", "植株", "農業", "栽培", "季節", "品質", "資料",
]);
const phrases = [
  "土壤檢測", "有機質肥料", "施用量", "施用位置", "一心二葉", "採摘", "成熟度", "修剪", "新梢", "褐斑", "枯梢", "截水溝", "排水", "覆蓋", "沖蝕", "補植", "定植", "株距", "扦插苗", "選苗", "剪苗", "入土節數", "輪作", "水稻", "氮肥", "施肥", "藤蔓", "塊根", "採收", "癒傷", "貯藏", "黃化", "萎凋", "菌包", "菌絲", "走菌", "轉色", "催蕾", "出菇", "浸水", "補水", "接種", "雜菌", "潮次", "休養", "吸芽", "疏果", "果指", "花器", "果房", "支柱", "防風", "倒伏", "肥培", "缺素", "除草", "淺根", "草生", "病蟲害", "蟻象", "茶餅病", "小綠葉蟬", "黃葉病", "太空包", "溫濕度", "濕度", "溫度", "水分", "通風", "石灰", "酸鹼", "含水量", "烘乾", "乾燥", "運送", "搬運", "擦傷", "壓傷", "乳汁", "套袋", "灌溉", "基肥", "追肥", "土壤", "肥料", "病害", "蟲害",
];
const aliases: string[][] = [
  ["菌包", "太空包", "菌棒"], ["氮肥", "氮素"], ["藤蔓", "莖葉", "蔓"], ["扦插苗", "藷苗", "種苗", "插植", "插苗"],
  ["貯藏", "儲藏", "保存"], ["癒傷", "傷口癒合"], ["催蕾", "菇蕾", "原基"], ["轉色", "菌膜轉色"],
  ["施肥", "肥培", "肥料"], ["有機質肥料", "有機肥料", "有機肥", "堆肥"], ["除草", "雜草"], ["覆蓋", "植被", "草生"],
  ["排水", "排水溝", "畦溝"], ["採摘", "採收"], ["吸芽", "劍芽", "接班芽"], ["疏果", "去蕾", "疏花"],
  ["選苗", "藷苗的選擇", "優良藷苗", "健康種苗"], ["剪苗", "採苗", "苗尖", "先端苗"],
  ["定植", "插植", "栽植", "植苗"], ["入土節數", "近地表的節", "節間", "水平淺植", "水平淺插"],
  ["成熟度", "成熟", "收穫適期", "收穫時期"], ["輪作", "水旱輪作", "水田輪作"],
  ["淺根", "根系分佈於表土層", "表土層"], ["枯梢", "枝枯", "枯枝"], ["褐斑", "褐化", "褐色病徵"],
  ["施用量", "使用量", "施肥量", "用量", "少量"], ["施用位置", "施肥位置", "開溝", "覆土"],
];

function archiveConcepts(question: string) {
  const normalized = question.normalize("NFKC");
  const foundPhrases = phrases.filter(phrase => normalized.includes(phrase));
  const words = [...segmenter.segment(normalized)]
    .filter(item => item.isWordLike)
    .map(item => item.segment)
    .filter(word => /^[\p{Script=Han}]{2,8}$/u.test(word) && !cropWords.has(word) && !stopWords.has(word));
  const all = [...new Set([...foundPhrases, ...words])];
  return all.filter(term => !all.some(other => other !== term && other.includes(term)))
    .slice(0, 15)
    .map(term => ({ term, variants: aliases.find(group => group.includes(term)) || [term] }));
}

function matchingConcepts(block: string, concepts: ReturnType<typeof archiveConcepts>) {
  return concepts.filter(concept => concept.variants.some(variant => block.includes(variant)));
}

export function archiveUrlForSource(url: string) {
  return `/evidence/archive?url=${encodeURIComponent(url)}`;
}

export function officialArchiveByUrl(url: string): OfficialSnapshot | undefined {
  return snapshots.find(snapshot => snapshot.url === url && new URL(snapshot.url).hostname === "kmweb.moa.gov.tw");
}

export function officialArchiveDigest(snapshot: OfficialSnapshot) {
  return createHash("sha256").update(JSON.stringify({ url: snapshot.url, retrieved_at: snapshot.retrieved_at, blocks: snapshot.blocks })).digest("hex");
}

export function officialArchiveEvidence(question: string, sources: TrustedSourceInput[], now = Date.now()): EvidenceSearchResult[] {
  const source = sources.find(item => item.domain.toLowerCase() === "kmweb.moa.gov.tw" && item.searchScope === "SITE");
  const crop = cropPatterns.find(item => item.question.test(question));
  if (!source || !crop) return [];
  const concepts = archiveConcepts(question);
  if (!concepts.length) return [];
  const candidates = snapshots.flatMap(snapshot => {
    if (new URL(snapshot.url).hostname !== source.domain || !crop.article.test(snapshot.title)) return [];
    const captured = Date.parse(snapshot.retrieved_at);
    if (!Number.isFinite(captured) || captured > now || now - captured > MAX_SEARCH_AGE_MS) return [];
    return snapshot.blocks.flatMap(block => {
      if (block.length < 25 || block.length > 1_500) return [];
      const matches = matchingConcepts(block, concepts);
      if (matches.length < Math.min(2, concepts.length)) return [];
      const matchedWeight = matches.reduce((sum, concept) => sum + Math.min(5, concept.term.length), 0);
      const totalWeight = concepts.reduce((sum, concept) => sum + Math.min(5, concept.term.length), 0);
      const score = Math.min(1, 0.15 + 0.7 * matchedWeight / Math.max(1, totalWeight) + Math.min(0.15, (matches.length - 1) * 0.05));
      return [{ sourceId: source.id, sourceName: source.name, title: snapshot.title, url: snapshot.url,
        excerpt: block.slice(0, 900), relevanceScore: score, provider: "trusted-web-snapshot", retrievedAt: snapshot.retrieved_at,
        archiveUrl: archiveUrlForSource(snapshot.url) } satisfies EvidenceSearchResult];
    });
  }).sort((a, b) => b.relevanceScore - a.relevanceScore);
  const seen = new Set<string>();
  const perUrl = new Map<string, number>();
  return candidates.filter(item => {
    const key = item.excerpt.replace(/\s+/gu, "").slice(0, 160);
    if (seen.has(key) || (perUrl.get(item.url) || 0) >= 2) return false;
    seen.add(key);
    perUrl.set(item.url, (perUrl.get(item.url) || 0) + 1);
    return true;
  }).slice(0, 8);
}
