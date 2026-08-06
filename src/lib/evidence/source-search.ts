type SearchableSource = { url: string; domain: string; searchScope: string };

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
  if (url.hostname.toLowerCase() === "kmweb.moa.gov.tw" && url.pathname.toLowerCase().endsWith("/knowledgebase.php")) {
    url.search = "";
    url.searchParams.set("func", "0");
    url.searchParams.set("type", "0");
    url.searchParams.set("keyword", sourceSearchKeyword(question));
    return url.toString();
  }
  return source.url;
}
