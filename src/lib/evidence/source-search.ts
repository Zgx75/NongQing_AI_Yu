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

export function sourceSearchKeywords(question: string) {
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
