import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, "../src/lib/evidence/official-pdf-sources.json");
const indexPath = resolve(here, "../src/lib/evidence/official-pdf-index.json");
const sources = JSON.parse(await readFile(manifestPath, "utf8"));
const MAX_BYTES = 8_000_000;
const MAX_PAGES = 40;

function chunksOf(text) {
  const normalized = text.replace(/\s+/gu, " ").trim();
  const chunks = [];
  for (let start = 0; start < normalized.length;) {
    let end = Math.min(start + 680, normalized.length);
    if (end < normalized.length) {
      const boundary = Math.max(normalized.lastIndexOf("。", end), normalized.lastIndexOf("；", end));
      if (boundary > start + 350) end = boundary + 1;
    }
    const chunk = normalized.slice(start, end).trim();
    if (chunk.length >= 50) chunks.push(chunk);
    if (end === normalized.length) break;
    start = Math.max(start + 1, end - 110);
  }
  return chunks;
}

const documents = [];
for (const source of sources) {
  const target = new URL(source.url);
  if (target.protocol !== "https:" || target.hostname !== "kmweb.moa.gov.tw") throw new Error(`Unapproved PDF URL: ${source.url}`);
  const response = await fetch(source.url, { signal: AbortSignal.timeout(30_000), headers: { accept: "application/pdf" } });
  if (!response.ok || new URL(response.url).hostname !== target.hostname) throw new Error(`PDF unavailable: ${source.url}`);
  const declaredSize = Number(response.headers.get("content-length") || 0);
  if (declaredSize > MAX_BYTES) throw new Error(`PDF too large: ${source.url}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length > MAX_BYTES || String.fromCharCode(...bytes.slice(0, 4)) !== "%PDF") throw new Error(`Invalid PDF: ${source.url}`);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const size = bytes.length;
  const task = getDocument({ data: bytes, useSystemFonts: true, disableFontFace: true });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new Error(`Too many PDF pages: ${source.url}`);
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      const page = await pdf.getPage(number);
      const content = await page.getTextContent();
      const text = content.items.map(item => "str" in item ? item.str : "").join(" ");
      const chunks = chunksOf(text);
      if (chunks.length) pages.push({ number, chunks });
      page.cleanup();
    }
    const totalChars = pages.reduce((sum, page) => sum + page.chunks.reduce((n, chunk) => n + chunk.length, 0), 0);
    if (totalChars < 1000) throw new Error(`PDF text is too sparse for evidence: ${source.url}`);
    documents.push({ ...source, sha256, byteLength: size, pageCount: pdf.numPages, pages });
    process.stdout.write(`${source.crop}: ${pdf.numPages} pages, ${totalChars} indexed characters\n`);
  } finally {
    await task.destroy();
  }
}
await writeFile(indexPath, `${JSON.stringify({ builtAt: new Date().toISOString(), documents }, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${indexPath}\n`);
