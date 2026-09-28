type SearchableSource = { url: string; domain: string; searchScope: string };

type PesticideTreeNode = {
  Farmid?: string;
  Instid?: string;
  DisplayName?: string;
  HierarchyPath?: string;
  Children?: PesticideTreeNode[];
};

const LEADING_QUESTION_WORDS = /^(?:(?:請問|想請問|我想問|我想知道|請教|最近|目前|可以幫我|能否|是否|有沒有|要怎麼|該怎麼|怎麼|如何|為什麼|改善|處理|防治)\s*)+/u;
const SEARCH_FILLERS = /請問|想請問|我想問|我想知道|請教|最近|目前|可以幫我|能否|是否|有沒有|要怎麼|該怎麼|怎麼|如何|為什麼|哪些|哪種|什麼|適合|建議|方法|方式|相關|資料|告訴我|防止|給|使用|用/gu;
const GENERIC_TOPICS = new Set(["肥料", "施肥", "栽培", "種植", "病蟲害", "蟲害", "病害", "農藥", "灌溉", "澆水", "防治"]);

// These are the crop names and common aliases used by the project's crop catalog.
// Keep them separate from the question text: only the original question is sent to AI.
const CROP_SEARCH_GROUPS = [
  { names: ["高山茶", "茶樹", "茶園", "茶葉", "茶苗", "茶"], primary: "茶樹", alternate: "高山茶" },
  { names: ["甘藷", "地瓜", "番薯"], primary: "甘藷", alternate: "地瓜" },
  { names: ["香菇"], primary: "香菇", alternate: "香菇" },
  { names: ["香蕉", "蕉園", "蕉株", "蕉苗", "蕉果"], primary: "香蕉", alternate: "香蕉" },
] as const;

const SPECIFIC_TOPICS = [
  "茶菁", "乳汁", "蕉乳", "分梳", "分把", "壓傷", "擦傷", "採後", "貯藏", "分級", "乾燥", "烘乾", "降雨", "劍芽", "接班芽",
  "段木", "太空包", "出菇", "果實套袋", "套袋", "株距", "行距", "基肥", "追肥", "海拔", "氣候", "整地",
  "農藥", "藥劑", "採收", "溫濕度", "養分", "施肥", "肥料", "田間管理", "梅雨", "病蟲害", "病徵", "辨識", "防治", "栽培", "種植",
  "根系", "定植", "移植", "失水", "春芽", "寒流", "低溫", "颱風", "雜草", "吸芽", "鹽分", "通氣", "菌絲", "排水", "強風", "果房", "假莖", "象鼻蟲", "蛀孔", "積水", "草生", "葉蟎", "土壤", "修剪", "儲藏", "覆蓋",
] as const;

const SEARCH_STOP_WORDS = new Set([
  "新買", "偏弱", "出現", "發現", "發生", "遇到", "連續", "過後", "田間", "農友", "應", "應該", "可以", "可能", "哪些", "哪個", "什麼", "為何", "如何", "怎麼", "是否", "需要", "檢查", "判斷", "調整", "採取", "減少", "避免", "注意", "方式", "方法", "措施", "影響", "問題", "情況", "現象", "程度", "相關", "資料", "記錄", "比較", "不同", "同一", "一樣", "之前", "之後", "前後", "目前", "最近", "已經", "尚未", "突然", "大量", "開始", "逐漸", "仍然", "以及", "或者", "還有", "即使", "只有", "如果", "因為", "所以", "時候", "時期", "時間", "健康", "徵兆", "農業", "作物", "植株", "管理", "用途", "決定", "強度", "周圍", "萌出", "多個", "保留", "疑似", "危害", "核對", "現行", "登記", "安全", "包裝", "太緊", "擴展",
]);

export function isNegatedMention(question: string, term: string) {
  const position = question.indexOf(term);
  if (position < 0) return false;
  return /(?:沒有|未見|不是|排除|不像|非).{0,5}$/u.test(question.slice(Math.max(0, position - 10), position));
}

function questionTopicTerms(question: string, cropNames: readonly string[]) {
  const words = [...new Intl.Segmenter("zh-TW", { granularity: "word" }).segment(question)]
    .filter(word => word.isWordLike)
    .map(word => word.segment)
    .filter(word => /^[\p{Script=Han}]{2,8}$/u.test(word))
    .filter(word => !cropNames.includes(word) && !SEARCH_STOP_WORDS.has(word) && !isNegatedMention(question, word));
  return [...new Set(words)].slice(0, 7);
}

function catalogCropKeywords(question: string) {
  const crop = CROP_SEARCH_GROUPS.find(group => group.names.some(name => question.includes(name)));
  if (!crop) return [];
  const normalized = question.normalize("NFKC");
  const names = [...crop.names].sort((a, b) => b.length - a.length);
  const mentionedCropName = names.find(name => normalized.includes(name)) || crop.primary;
  const technicalText = normalized
    .replace(/出現|發生|防治|感染|可使用|有哪些|哪些|病蟲害|的|與|和|於|在|為|若|時|該|如何|其|危害|核准|合法|使用/gu, " ");
  const technical = questionTopicTerms(normalized, crop.names)
    .filter(term => /(?:病|蟬|象|菌|蟲)$/u.test(term) && !GENERIC_TOPICS.has(term))
    .sort((a, b) => b.length - a.length)[0] || [...technicalText.matchAll(/[\p{Script=Han}]{2,10}(?:病|蟬|象|菌|蟲)/gu)]
    .map(match => match[0]
      .replace(new RegExp(`^(?:${names.filter(name => name.length > 1).join("|")})`, "u"), ""))
    .filter(term => term.length >= 2 && !["病蟲", "黴菌", "哪些病"].includes(term) && !/(?:沒有|未見|不是|排除|不像)/u.test(term) && !isNegatedMention(normalized, term))
    .sort((a, b) => b.length - a.length)[0];
  const topics: string[] = SPECIFIC_TOPICS.filter(topic => normalized.includes(topic) && !isNegatedMention(normalized, topic)).sort((a, b) => normalized.indexOf(a) - normalized.indexOf(b));
  if (/肥料|基肥|追肥|施用|氮.*磷.*鉀/u.test(normalized) && !topics.includes("施肥")) topics.unshift("施肥");
  if (/氮.*磷.*鉀/u.test(normalized)) topics.unshift("氮磷鉀");
  const topicTerms = [...new Set([
    ...topics.filter(topic => !GENERIC_TOPICS.has(topic)),
    ...questionTopicTerms(normalized, crop.names),
    ...topics.filter(topic => GENERIC_TOPICS.has(topic)),
  ])];
  if (technical) {
    const cropTerm = crop.primary === "茶樹" ? `茶${technical.replace(/^茶/u, "")}` : `${crop.primary}${technical}`;
    const aliasTerm = crop.primary === "茶樹" ? "" : crop.alternate !== crop.primary ? `${crop.alternate}${technical}` : "";
    const diseaseAlias = normalized.includes("黃葉病") && crop.primary === "香蕉" ? "香蕉黃葉病" : "";
    return [...new Set([cropTerm, diseaseAlias, aliasTerm, ...topicTerms.slice(0, 2).map(term => `${crop.primary}${term}`), technical, mentionedCropName, crop.primary].filter(Boolean))].slice(0, 5);
  }
  const specific = topicTerms.slice(0, 4).map(term => `${crop.primary}${term}`);
  const alias = crop.alternate !== crop.primary && topicTerms[0] ? `${crop.alternate}${topicTerms[0]}` : "";
  return [...new Set([...specific.slice(0, 3), mentionedCropName, alias, crop.primary].filter(Boolean))].slice(0, 5);
}

export function sourceSearchKeywords(question: string) {
  const catalogKeywords = catalogCropKeywords(question);
  if (catalogKeywords.length) return catalogKeywords;
  const normalized = question.normalize("NFKC").replace(/[？?！!，,。.;；:：]/g, " ");
  const topicHints = [
    ...( /肥料|施肥/u.test(normalized) ? ["施肥", "肥料"] : []),
    ...( /怎麼種|如何種|種植|栽培/u.test(normalized) ? ["栽培", "種植"] : []),
    ...( /病蟲害/u.test(normalized) ? ["病蟲害"] : []),
    ...( /蟲害|害蟲/u.test(normalized) ? ["蟲害"] : []),
    ...( /病害/u.test(normalized) ? ["病害"] : []),
    ...( /農藥|藥劑|用藥/u.test(normalized) ? ["農藥"] : []),
    ...( /灌溉|澆水/u.test(normalized) ? ["灌溉"] : []),
  ];
  const cleaned = normalized
    .replace(LEADING_QUESTION_WORDS, "")
    .replace(SEARCH_FILLERS, " ");
  const segments = cleaned.match(/[\p{Script=Han}]{2,12}|[\p{L}\p{N}]{3,30}/gu) ?? [];
  const subjects = cleaned
    .replace(/病蟲害|蟲害|病害|肥料|施肥|栽培|種植|農藥|灌溉|澆水|防治/gu, " ")
    .replace(/種\s*$/u, " ")
    .match(/[\p{Script=Han}]{2,12}|[\p{L}\p{N}]{3,30}/gu) ?? [];
  const primary = subjects[0] || segments.find(segment => !GENERIC_TOPICS.has(segment)) || topicHints[0] || normalized.trim().slice(0, 20);
  const combined = subjects[0] && topicHints[0] ? `${subjects[0]}${topicHints[0]}` : "";
  return [...new Set([combined, primary, ...topicHints, ...segments].filter(Boolean))].slice(0, 3);
}

export function sourceSearchKeyword(question: string) {
  return sourceSearchKeywords(question)[0] || question.trim().slice(0, 30);
}

export function sourceSearchEntryUrls(source: SearchableSource, question: string) {
  if (source.searchScope !== "SITE") return [source.url];
  const url = new URL(source.url);
  const keywords = sourceSearchKeywords(question);
  if (url.hostname.toLowerCase() === "pesticide.aphia.gov.tw") {
    url.pathname = "/information/Query/Bug";
    url.search = "";
    return [url.toString()];
  }
  if (url.hostname.toLowerCase() === "kmweb.moa.gov.tw" && url.pathname.toLowerCase().endsWith("/knowledgebase.php")) {
    return keywords.map(keyword => {
      const target = new URL(url);
      target.search = "";
      target.searchParams.set("func", "0");
      target.searchParams.set("type", "0");
      target.searchParams.set("keyword", keyword);
      target.searchParams.set("display_num", "70");
      return target.toString();
    });
  }
  if (url.hostname.toLowerCase() === "www.afa.gov.tw") {
    return keywords.map(keyword => {
      const target = new URL("/cht/index.php", url);
      target.searchParams.set("act", "article");
      target.searchParams.set("code", "search");
      target.searchParams.set("postFlag", "1");
      target.searchParams.set("keyword", keyword);
      return target.toString();
    });
  }
  if (url.hostname.toLowerCase() === "www.aphia.gov.tw") {
    return keywords.map(keyword => {
      const target = new URL("/search_wg_tran.php", url);
      target.searchParams.set("keyword_q", keyword);
      return target.toString();
    });
  }
  return [source.url];
}

export function sourceSearchEntryUrl(source: SearchableSource, question: string) { return sourceSearchEntryUrls(source, question)[0]; }

function embeddedJson(html: string, id: string): PesticideTreeNode[] {
  const pattern = new RegExp(`<script\\b[^>]*id=["']${id}["'][^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const value = pattern.exec(html)?.[1];
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed as PesticideTreeNode[] : [];
  } catch {
    return [];
  }
}

function flattenTree(nodes: PesticideTreeNode[]): PesticideTreeNode[] {
  return nodes.flatMap(node => [node, ...flattenTree(node.Children ?? [])]);
}

function bestMention(nodes: PesticideTreeNode[], question: string, idKey: "Farmid" | "Instid") {
  return flattenTree(nodes)
    .filter(node => node[idKey] && node.DisplayName && question.includes(node.DisplayName))
    .sort((a, b) => {
      const lengthDifference = (b.DisplayName?.length ?? 0) - (a.DisplayName?.length ?? 0);
      if (lengthDifference) return lengthDifference;
      const aPriority = idKey === "Farmid" && a.Farmid?.startsWith("C") ? 1 : 0;
      const bPriority = idKey === "Farmid" && b.Farmid?.startsWith("C") ? 1 : 0;
      return bPriority - aPriority;
    })[0];
}

export function sourceSpecificResultUrls(source: SearchableSource, question: string, html: string) {
  const host = new URL(source.url).hostname.toLowerCase();
  if (source.searchScope !== "SITE" || host !== "pesticide.aphia.gov.tw") return [];
  const farm = bestMention(embeddedJson(html, "farmListData"), question, "Farmid");
  const bug = bestMention(embeddedJson(html, "bugListData"), question, "Instid");
  if (!farm?.Farmid || !bug?.Instid) return [];
  const url = new URL("/information/Query/BugFarmUserange", source.url);
  url.searchParams.set("flag", "0");
  url.searchParams.set("farm", farm.Farmid);
  url.searchParams.set("bug", bug.Instid);
  return [url.toString()];
}
