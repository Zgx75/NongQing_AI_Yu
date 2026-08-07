import { describe, expect, it } from "vitest";
import { bestExcerpts, parseHtmlDocument } from "@/lib/evidence/html-search";
import { sourceSearchEntryUrl, sourceSearchKeyword, sourceSpecificResultUrls } from "@/lib/evidence/source-search";
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

  it("將農藥網作物與病害名稱轉成官方登記用藥查詢", () => {
    const source = { url: "https://pesticide.aphia.gov.tw/", domain: "pesticide.aphia.gov.tw", searchScope: "SITE" };
    expect(sourceSearchEntryUrl(source, "番茄晚疫病")).toBe("https://pesticide.aphia.gov.tw/information/Query/Bug");
    const html = `<script id="farmListData" type="application/json">[{"Farmid":"C09","DisplayName":"果菜類","Children":[{"Farmid":"C090903","DisplayName":"番茄"}]}]</script><script id="bugListData" type="application/json">[{"Instid":"B35","DisplayName":"晚疫病"}]</script>`;
    const url = new URL(sourceSpecificResultUrls(source, "番茄晚疫病可以使用哪些農藥", html)[0]);
    expect(url.pathname).toBe("/information/Query/BugFarmUserange");
    expect(url.searchParams.get("farm")).toBe("C090903");
    expect(url.searchParams.get("bug")).toBe("B35");
  });

  it("將用藥表格整列保留為佐證段落", () => {
    const document = parseHtmlDocument(`<table><tr><th>作物</th><th>病害</th><th>普通名稱</th></tr><tr><td>番茄</td><td>晚疫病</td><td>核准藥劑甲</td><td>稀釋倍數 2500</td><td>安全採收期 7 天</td></tr></table>`, "https://example.org/pesticide");
    expect(document.blocks).toContain("番茄 晚疫病 核准藥劑甲 稀釋倍數 2500 安全採收期 7 天");
  });
});
