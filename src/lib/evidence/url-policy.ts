import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "@/lib/api";
import { cached } from "@/lib/open-data/cache";

const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 20_000;
const PAGE_CACHE_TTL_MS = 5 * 60_000;

function isPrivateIp(address: string) {
  const value = address.toLowerCase();
  if (value === "::1" || value === "::" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return true;
  const ipv4 = value.startsWith("::ffff:") ? value.slice(7) : value;
  if (isIP(ipv4) !== 4) return false;
  const [a, b] = ipv4.split(".").map(Number);
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}

export function parsePublicWebUrl(input: string) {
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { throw new AppError("INVALID_SOURCE_URL", "請輸入完整的 http 或 https 網址。", 422); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new AppError("INVALID_SOURCE_URL", "僅接受不含帳號密碼的 http 或 https 網址。", 422);
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || isPrivateIp(host)) throw new AppError("UNSAFE_SOURCE_URL", "不能使用本機或私人網路網址。", 422);
  url.hash = "";
  return url;
}

async function assertPublicDns(url: URL) {
  if (isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) throw new AppError("UNSAFE_SOURCE_URL", "來源網址解析到私人網路。", 422);
    return;
  }
  let addresses;
  try { addresses = await lookup(url.hostname, { all: true, verbatim: true }); }
  catch { throw new AppError("SOURCE_UNREACHABLE", `無法解析來源網域：${url.hostname}`, 502); }
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new AppError("UNSAFE_SOURCE_URL", "來源網址解析到私人網路。", 422);
}

export function normalizeComparableUrl(input: string) {
  const url = parsePublicWebUrl(input);
  url.searchParams.sort();
  if (url.pathname !== "/") url.pathname = url.pathname.replace(/\/$/, "");
  return url.toString();
}

export function isWithinSource(candidate: string, source: { url: string; domain: string; searchScope: string }) {
  let url: URL;
  try { url = parsePublicWebUrl(candidate); } catch { return false; }
  if (source.searchScope === "PAGE") return normalizeComparableUrl(url.toString()) === normalizeComparableUrl(source.url);
  return url.hostname.toLowerCase() === source.domain.toLowerCase();
}

async function fetchPublicPageAttempt(input: string, allowedDomain: string) {
  let url = parsePublicWebUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (url.hostname.toLowerCase() !== allowedDomain.toLowerCase()) throw new AppError("SOURCE_REDIRECT_BLOCKED", "來源重新導向到未核准的網域。", 502);
    await assertPublicDns(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "accept": "text/html,application/xhtml+xml,text/plain;q=0.9", "accept-language": "zh-TW,zh;q=0.9,en;q=0.5", "user-agent": "NongQingEvidenceAgent/1.0 (+https://nong-qing-ai-yu.vercel.app)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new AppError("SOURCE_FETCH_FAILED", "來源回傳無效的重新導向。", 502);
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new AppError("SOURCE_FETCH_FAILED", `來源回應 ${response.status}。`, 502);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) throw new AppError("UNSUPPORTED_SOURCE", "此來源不是可搜尋的網頁文字；PDF 請改用搜尋服務模式。", 422);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) throw new AppError("SOURCE_TOO_LARGE", "來源頁面超過大小限制。", 422);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new AppError("SOURCE_TOO_LARGE", "來源頁面超過大小限制。", 422);
    return { url: url.toString(), html: new TextDecoder().decode(buffer), contentType };
  }
  throw new AppError("SOURCE_REDIRECT_LIMIT", "來源重新導向次數過多。", 502);
}

export async function fetchPublicPage(input: string, allowedDomain: string) {
  const normalized = parsePublicWebUrl(input).toString();
  const result = await cached(`trusted-page:${normalized}`, PAGE_CACHE_TTL_MS, async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { return await fetchPublicPageAttempt(normalized, allowedDomain); }
      catch (error) {
        if (error instanceof AppError) throw error;
        lastError = error;
        if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
    const timedOut = lastError instanceof Error && (lastError.name === "TimeoutError" || /aborted|timeout/i.test(lastError.message));
    throw new AppError(timedOut ? "SOURCE_TIMEOUT" : "SOURCE_FETCH_FAILED", timedOut ? "來源網站回應較慢，重試後仍逾時，請稍後再試。" : "來源網站暫時無法連線，請稍後再試。", 502);
  });
  return result.data;
}
