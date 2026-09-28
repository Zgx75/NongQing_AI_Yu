import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { AppError } from "@/lib/api";
import { cached } from "@/lib/open-data/cache";

const MAX_RESPONSE_BYTES = 1_500_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 20_000;
const PAGE_CACHE_TTL_MS = 60 * 60_000;

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
  catch { throw new AppError("INVALID_SOURCE_URL", "Enter a complete HTTP or HTTPS URL.", 422); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw new AppError("INVALID_SOURCE_URL", "Only HTTP or HTTPS URLs without embedded credentials are accepted.", 422);
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || isPrivateIp(host)) throw new AppError("UNSAFE_SOURCE_URL", "Local and private-network URLs are not allowed.", 422);
  url.hash = "";
  return url;
}

async function assertPublicDns(url: URL) {
  if (isIP(url.hostname)) {
    if (isPrivateIp(url.hostname)) throw new AppError("UNSAFE_SOURCE_URL", "The source URL resolves to a private network.", 422);
    return;
  }
  let addresses;
  try { addresses = await lookup(url.hostname, { all: true, verbatim: true }); }
  catch { throw new AppError("SOURCE_UNREACHABLE", `Unable to resolve the source domain: ${url.hostname}`, 502); }
  if (!addresses.length || addresses.some(item => isPrivateIp(item.address))) throw new AppError("UNSAFE_SOURCE_URL", "The source URL resolves to a private network.", 422);
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
    if (url.hostname.toLowerCase() !== allowedDomain.toLowerCase()) throw new AppError("SOURCE_REDIRECT_BLOCKED", "The source redirected to an unapproved domain.", 502);
    await assertPublicDns(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { "accept": "text/html,application/xhtml+xml,text/plain;q=0.9", "accept-language": "zh-TW,zh;q=0.9,en;q=0.5", "user-agent": "NongQingEvidenceAgent/1.0 (+https://nong-qing-ai-yu.vercel.app)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new AppError("SOURCE_FETCH_FAILED", "The source returned an invalid redirect.", 502);
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new AppError("SOURCE_FETCH_FAILED", `The source returned HTTP ${response.status}.`, 502);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml") && !contentType.includes("text/plain")) throw new AppError("UNSUPPORTED_SOURCE", "This source is not searchable webpage text. Use search-service mode for PDFs.", 422);
    const length = Number(response.headers.get("content-length") || 0);
    if (length > MAX_RESPONSE_BYTES) throw new AppError("SOURCE_TOO_LARGE", "The source page exceeds the size limit.", 422);
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_RESPONSE_BYTES) throw new AppError("SOURCE_TOO_LARGE", "The source page exceeds the size limit.", 422);
    return { url: url.toString(), html: new TextDecoder().decode(buffer), contentType };
  }
  throw new AppError("SOURCE_REDIRECT_LIMIT", "The source redirected too many times.", 502);
}

export async function fetchPublicPage(input: string, allowedDomain: string) {
  const normalized = parsePublicWebUrl(input).toString();
  const ttl = allowedDomain.toLowerCase() === "pesticide.aphia.gov.tw" ? 5 * 60_000 : PAGE_CACHE_TTL_MS;
  const result = await cached(`trusted-page:${normalized}`, ttl, async () => {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try { return await fetchPublicPageAttempt(normalized, allowedDomain); }
      catch (error) {
        const retryableHttp = error instanceof AppError && /HTTP (?:429|5\d\d)\b/u.test(error.message);
        const retryableDns = error instanceof AppError && error.code === "SOURCE_UNREACHABLE";
        if (error instanceof AppError && !retryableHttp && !retryableDns) throw error;
        lastError = error;
        if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    const timedOut = lastError instanceof Error && (lastError.name === "TimeoutError" || /aborted|timeout/i.test(lastError.message));
    throw new AppError(timedOut ? "SOURCE_TIMEOUT" : "SOURCE_FETCH_FAILED", timedOut ? "The source website remained too slow after retrying. Please try again later." : "The source website is temporarily unreachable. Please try again later.", 502);
  });
  return result.data;
}

/** Reads a bounded PDF from an already approved source domain for hash verification. */
export async function fetchPublicPdf(input: string, allowedDomain: string) {
  const maxBytes = 8_000_000;
  let url = parsePublicWebUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    if (url.hostname.toLowerCase() !== allowedDomain.toLowerCase()) throw new AppError("SOURCE_REDIRECT_BLOCKED", "The PDF redirected to an unapproved domain.", 502);
    await assertPublicDns(url);
    const response = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: { accept: "application/pdf", "user-agent": "NongQingEvidenceAgent/1.0 (+https://nong-qing-ai-yu.vercel.app)" },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) throw new AppError("SOURCE_FETCH_FAILED", "The PDF returned an invalid redirect.", 502);
      url = new URL(location, url);
      continue;
    }
    if (!response.ok) throw new AppError("SOURCE_FETCH_FAILED", `The PDF returned HTTP ${response.status}.`, 502);
    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("application/pdf") && !contentType.includes("application/octet-stream")) throw new AppError("UNSUPPORTED_SOURCE", "The approved URL no longer serves a PDF.", 422);
    if (Number(response.headers.get("content-length") || 0) > maxBytes) throw new AppError("SOURCE_TOO_LARGE", "The PDF exceeds the size limit.", 422);
    const reader = response.body?.getReader();
    if (!reader) throw new AppError("SOURCE_FETCH_FAILED", "The PDF response is empty.", 502);
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new AppError("SOURCE_TOO_LARGE", "The PDF exceeds the size limit.", 422); }
      chunks.push(value);
    }
    const bytes = Buffer.concat(chunks, total);
    if (bytes.subarray(0, 4).toString("ascii") !== "%PDF") throw new AppError("UNSUPPORTED_SOURCE", "The approved URL no longer serves a PDF.", 422);
    return { url: url.toString(), bytes };
  }
  throw new AppError("SOURCE_REDIRECT_LIMIT", "The PDF redirected too many times.", 502);
}
