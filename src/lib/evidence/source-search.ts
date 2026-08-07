type SearchableSource = { url: string; domain: string; searchScope: string };

type PesticideTreeNode = {
  Farmid?: string;
  Instid?: string;
  DisplayName?: string;
  HierarchyPath?: string;
  Children?: PesticideTreeNode[];
};

const LEADING_QUESTION_WORDS = /^(?:(?:請問|想請問|我想問|我想知道|請教|最近|目前|可以幫我|能否|是否|有沒有|要怎麼|該怎麼|怎麼|如何|為什麼|改善|處理|防治)\s*)+/u;

export function sourceSearchKeyword(question: string) {
  const chunks = question
    .normalize("NFKC")
    .replace(LEADING_QUESTION_WORDS, "")
    .match(/[\p{Script=Han}]{2,}|[\p{L}\p{N}]{3,}/gu) ?? [];
  const candidate = chunks.find(chunk => !/^(?:可以|應該|需要|什麼|哪些|哪裡|多久|方法|方式)$/u.test(chunk));
  if (!candidate) return question.trim().slice(0, 30);
  return /^[\p{Script=Han}]+$/u.test(candidate) ? candidate.slice(0, 2) : candidate.slice(0, 30);
}

export function sourceSearchEntryUrl(source: SearchableSource, question: string) {
  if (source.searchScope !== "SITE") return source.url;
  const url = new URL(source.url);
  if (url.hostname.toLowerCase() === "pesticide.aphia.gov.tw") {
    url.pathname = "/information/Query/Bug";
    url.search = "";
    return url.toString();
  }
  if (url.hostname.toLowerCase() === "kmweb.moa.gov.tw" && url.pathname.toLowerCase().endsWith("/knowledgebase.php")) {
    url.search = "";
    url.searchParams.set("func", "0");
    url.searchParams.set("type", "0");
    url.searchParams.set("keyword", sourceSearchKeyword(question));
    return url.toString();
  }
  return source.url;
}

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
