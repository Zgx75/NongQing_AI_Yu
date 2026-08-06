import { describe, expect, it } from "vitest";
import { bestExcerpts, parseHtmlDocument } from "@/lib/evidence/html-search";
import { sourceSearchEntryUrl, sourceSearchKeyword } from "@/lib/evidence/source-search";
import { isWithinSource, parsePublicWebUrl } from "@/lib/evidence/url-policy";

describe("可信網站搜尋", () => {
  it("從網頁中找出與問題相關的段落", () => {
    const document = parseHtmlDocument(`<html><head><title>番茄栽培手冊</title></head><body><p>這是一段與查詢無關的網站介紹文字。</p><p>番茄結果期應依土壤分析與植株狀況調整鉀肥，避免過量施肥。</p><a href="/guide">栽培指南</a></body></html>`, "https://example.org/tomato");
    expect(document.title).toBe("番茄栽培手冊");
    expect(document.links[0].url).toBe("https://example.org/guide");
    expect(bestExcerpts(document.blocks, "番茄結果期鉀肥", 1)[0].text).toContain("鉀肥");
  });

  it("只接受核准頁面或同網域結果", () => {
    const page = { url: "https://example.org/guide", domain: "example.org", searchScope: "PAGE" };
    const site = { ...page, searchScope: "SITE" };
    expect(isWithinSource("https://example.org/guide", page)).toBe(true);
    expect(isWithinSource("https://example.org/other", page)).toBe(false);
    expect(isWithinSource("https://example.org/other", site)).toBe(true);
    expect(isWithinSource("https://evil.example/guide", site)).toBe(false);
  });

  it("拒絕本機與私人網址", () => {
    expect(() => parsePublicWebUrl("http://localhost:3000/admin")).toThrow();
    expect(() => parsePublicWebUrl("http://192.168.1.5/internal")).toThrow();
  });

  it("將農業知識入口網轉成站內知識庫搜尋網址", () => {
    const source = { url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=0", domain: "kmweb.moa.gov.tw", searchScope: "SITE" };
    const url = new URL(sourceSearchEntryUrl(source, "請問番茄結果期要怎麼施肥？"));
    expect(url.pathname).toBe("/knowledgebase.php");
    expect(url.searchParams.get("func")).toBe("0");
    expect(url.searchParams.get("type")).toBe("0");
    expect(url.searchParams.get("keyword")).toBe("番茄");
    expect(sourceSearchKeyword("如何改善土壤酸化？")).toBe("土壤");
  });
});
