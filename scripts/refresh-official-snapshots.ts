/** Refresh dated official article captures without discarding a usable copy on fetch failure. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fetchPublicPage } from "../src/lib/evidence/url-policy";
import { parseHtmlDocument } from "../src/lib/evidence/html-search";

type Snapshot = { url: string; title: string; retrieved_at: string; capture?: string; blocks: string[] };
const path = resolve(process.cwd(), "src/lib/evidence/official-snapshots.json");
const snapshots = JSON.parse(readFileSync(path, "utf8")) as Snapshot[];
if (!Array.isArray(snapshots) || !snapshots.length) throw new Error("Official snapshot list is empty.");

async function main() {
const now = Date.now();
const expiry = 180 * 24 * 60 * 60_000;
if (process.argv.includes("--check")) {
  const stale = snapshots.filter(item => !Number.isFinite(Date.parse(item.retrieved_at)) || now - Date.parse(item.retrieved_at) > expiry);
  process.stdout.write(`${snapshots.length} official captures; ${stale.length} expired.\n`);
  for (const item of stale) process.stdout.write(`${item.retrieved_at} ${item.url}\n`);
  process.exitCode = stale.length ? 1 : 0;
} else if (process.argv.includes("--refresh")) {
  let updated = 0;
  let failed = 0;
  for (const item of snapshots) {
    try {
      const requested = new URL(item.url);
      if (requested.hostname !== "kmweb.moa.gov.tw") throw new Error("Unapproved archive domain.");
      const response = await fetchPublicPage(item.url, requested.hostname);
      const returned = new URL(response.url);
      if (returned.hostname !== requested.hostname || returned.pathname !== requested.pathname || returned.searchParams.get("id") !== requested.searchParams.get("id")) {
        throw new Error("Article URL redirected to a different page.");
      }
      const document = parseHtmlDocument(response.html, response.url);
      const blocks = document.blocks.filter(block => block.length >= 25 && block.length <= 1_500);
      if (blocks.length < 2 || blocks.join(" ").length < 150 || /全站搜尋|查無資料|頁面不存在/u.test(document.title)) {
        throw new Error("Fetched article text failed content checks.");
      }
      item.title = document.title;
      item.blocks = blocks;
      item.retrieved_at = new Date().toISOString();
      item.capture = "official article HTML";
      updated += 1;
    } catch (error) {
      failed += 1;
      process.stderr.write(`Preserved previous capture for ${item.url}: ${error instanceof Error ? error.message : String(error)}\n`);
    }
  }
  if (updated) writeFileSync(path, `${JSON.stringify(snapshots)}\n`, "utf8");
  process.stdout.write(`${updated} refreshed; ${failed} preserved after fetch failure.\n`);
  process.exitCode = failed ? 1 : 0;
} else {
  throw new Error("Use --check to inspect capture age or --refresh to update from the official site.");
}
}

main().catch(error => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
