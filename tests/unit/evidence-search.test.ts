import { afterEach, describe, expect, it, vi } from "vitest";
import { bestExcerpts, parseHtmlDocument } from "@/lib/evidence/html-search";
import { sourceSearchEntryUrl, sourceSearchEntryUrls, sourceSearchKeyword, sourceSearchKeywords, sourceSpecificResultUrls } from "@/lib/evidence/source-search";
import { isWithinSource, parsePublicWebUrl } from "@/lib/evidence/url-policy";
import { officialPageUrlsForQuestion } from "@/lib/evidence/official-pages";
import { officialPdfCandidates } from "@/lib/evidence/official-pdf-search";
import { evidenceCandidateUrls, searchTrustedWeb } from "@/lib/evidence/search-agent";
import { officialArchiveEvidence } from "@/lib/evidence/official-archive";

describe("可信網站搜尋", () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  const kmweb = { id: "kmweb", name: "農業知識入口網", url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=0", domain: "kmweb.moa.gov.tw", description: "", searchScope: "SITE" };

  it("在網站不可用時搜尋有日期及可檢視摘錄的官方封存資料", async () => {
    const question = "甘藷塊根採後的癒傷處理有什麼目的？貯藏環境要注意哪些條件？";
    const captured = Date.parse("2026-09-28T00:00:00Z");
    const candidates = officialArchiveEvidence(question, [kmweb], captured);
    expect(candidates.some(item => item.url.endsWith("id=19322") && item.excerpt.includes("癒傷"))).toBe(true);
    expect(candidates.every(item => item.provider === "trusted-web-snapshot" && item.retrievedAt && item.archiveUrl?.startsWith("/evidence/archive?url="))).toBe(true);
    expect(officialArchiveEvidence(question, [kmweb], Date.parse("2027-10-01T00:00:00Z"))).toEqual([]);
    vi.spyOn(Date, "now").mockReturnValue(captured);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("unexpected network request"); }));
    const search = await searchTrustedWeb(question, [kmweb]);
    expect(search.provider).toBe("trusted-official-archive");
    expect(search.results.some(item => item.archiveUrl)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("只在新封存段落直接涉及香蕉除草時提供該段落", () => {
    const found = officialArchiveEvidence("香蕉園除草如何避免傷及淺根？草生管理或地表覆蓋有哪些注意事項？", [kmweb], Date.parse("2026-09-28T00:00:00Z"));
    expect(found.some(item => item.url.endsWith("id=11195") && item.excerpt.includes("根系分佈於表土層"))).toBe(true);
    expect(found.every(item => item.url.endsWith("id=11195"))).toBe(true);
    expect(officialArchiveEvidence("香蕉果實為什麼變甜？", [kmweb], Date.parse("2026-09-28T00:00:00Z"))).toEqual([]);
  });
  it("從網頁中找出與問題相關的段落", () => {
    const document = parseHtmlDocument(`<html><head><title>番茄栽培手冊</title></head><body><p>這是一段與查詢無關的網站介紹文字。</p><p>番茄結果期應依土壤分析與植株狀況調整鉀肥，避免過量施肥。</p><a href="/guide">栽培指南</a></body></html>`, "https://example.org/tomato");
    expect(document.title).toBe("番茄栽培手冊");
    expect(document.links[0].url).toBe("https://example.org/guide");
    expect(bestExcerpts(document.blocks, "番茄結果期鉀肥", 1)[0].text).toContain("鉀肥");
  });

  it("matches banana harvest wording to the official article's processing terms", () => {
    const passages = [
      "果房套袋後應固定果軸並檢查果指與袋子的接觸位置。",
      "採收的果房應儘快完成分把、去乳汁、選別與包裝，搬運時避免擦傷和壓傷。",
    ];
    expect(bestExcerpts(passages, "香蕉採後分梳時發現乳汁沾污與壓傷，包裝前如何處理？", 1)[0].text).toContain("分把、去乳汁");
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
    expect(url.searchParams.get("keyword")).toBe("番茄結果期施肥");
    expect(sourceSearchKeyword("如何改善土壤酸化？")).toBe("土壤酸化");
  });

  it("extracts crop and intent instead of searching generic question words", () => {
    expect(sourceSearchKeywords("哪些肥料適合給茄子用")).toEqual(["茄子施肥", "茄子", "施肥"]);
    const kmweb = sourceSearchEntryUrls({ url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=0", domain: "kmweb.moa.gov.tw", searchScope: "SITE" }, "哪些肥料適合給茄子用");
    expect(kmweb.map(value => new URL(value).searchParams.get("keyword"))).toEqual(["茄子施肥", "茄子", "施肥"]);
  });

  it("keeps the question topic in four-crop site searches", () => {
    expect(sourceSearchKeywords("新買的茶苗根系偏弱，定植前應檢查哪些苗木健康徵兆？")).toContain("茶樹根系");
    expect(sourceSearchKeywords("新買的茶苗根系偏弱，定植前應檢查哪些苗木健康徵兆？")).toContain("茶苗");
    expect(sourceSearchKeywords("香蕉園土壤鹽分疑似累積時，哪些葉片與土壤徵兆值得檢查？")).toContain("香蕉鹽分");
    expect(sourceSearchKeywords("香菇太空包裝填太緊或太鬆，可能如何影響通氣與菌絲擴展？")).toContain("香菇太空包");
    expect(sourceSearchKeywords("香蕉採後分梳時發現乳汁沾污與壓傷，包裝前如何分級？")).toContain("香蕉分梳");
    expect(sourceSearchKeywords("香蕉採後分梳時發現乳汁沾污與壓傷，包裝前如何分級？")).toContain("香蕉乳汁");
    expect(sourceSearchKeywords("蕉園雨後低窪區葉片下垂如何排水？").some(keyword => keyword.startsWith("香蕉"))).toBe(true);
    const urls = sourceSearchEntryUrls({ url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=0", domain: "kmweb.moa.gov.tw", searchScope: "SITE" }, "茶苗根系如何檢查");
    expect(new URL(urls[0]).searchParams.get("display_num")).toBe("70");
    expect(sourceSearchKeywords("茶葉有褐色斑點但沒有典型茶餅病腫斑時如何診斷").every(keyword => !keyword.includes("茶餅病"))).toBe(true);
  });

  it("searches discovered article links even when a curated page matches", () => {
    const source = { id: "moa", name: "MOA", url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=0", domain: "kmweb.moa.gov.tw", description: "", searchScope: "SITE" };
    const curated = "https://kmweb.moa.gov.tw/subject/subject.php?id=123";
    const urls = evidenceCandidateUrls("茶樹根系生長", source, [curated], [{
      response: { url: "https://kmweb.moa.gov.tw/knowledgebase.php?keyword=茶樹根系", html: "" },
      document: { links: [{ url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=&type=0&keyword=茶樹根系&id=427731", label: "茶樹根系管理資訊" }] },
    }]);
    expect(urls).toContain(curated);
    expect(urls).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=427731");
  });

  it("uses each official site's actual full-text search endpoint", () => {
    const afa = sourceSearchEntryUrl({ url: "https://www.afa.gov.tw/index.php?code=list&ids=650", domain: "www.afa.gov.tw", searchScope: "SITE" }, "哪些肥料適合給茄子用");
    expect(new URL(afa).searchParams.get("code")).toBe("search");
    expect(new URL(afa).searchParams.get("keyword")).toBe("茄子施肥");
    const aphia = sourceSearchEntryUrl({ url: "https://www.aphia.gov.tw/ws.php?id=4159", domain: "www.aphia.gov.tw", searchScope: "SITE" }, "番茄病蟲害防治");
    expect(new URL(aphia).pathname).toBe("/search_wg_tran.php");
    expect(new URL(aphia).searchParams.get("keyword_q")).toBe("番茄病蟲害");
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

  it("extracts official article text separated by line breaks", () => {
    const document = parseHtmlDocument(`<title>香菇栽培</title><div class="articlepara"><div>照片</div>香菇太空包以木屑為主要材料，補充米糠提供菌絲生長所需的養分。<br><br>香菇出菇期間須依品系控制溫度與濕度，並維持菇舍通風與充足的新鮮空氣。</div>`, "https://kmweb.moa.gov.tw/theme_data.php?id=1");
    expect(document.blocks.some(block => block.includes("米糠提供菌絲"))).toBe(true);
    expect(document.blocks.some(block => block.includes("控制溫度與濕度"))).toBe(true);
  });

  it("does not treat related-article sidebar text as article evidence", () => {
    const document = parseHtmlDocument(`<title>茶園排水</title><div class="articlepara"><p>連續降雨後應檢查茶園排水溝，避免積水影響茶樹根系。</p></div><aside><p>最新消息：香蕉葉斑病農藥使用資訊。</p></aside>`, "https://kmweb.moa.gov.tw/knowledgebase.php?id=1");
    expect(document.blocks.some(block => block.includes("茶園排水溝"))).toBe(true);
    expect(document.blocks.some(block => block.includes("香蕉葉斑病"))).toBe(false);
  });

  it("selects official topic pages only for the approved domain and matching crop", () => {
    expect(officialPageUrlsForQuestion("甘藷蟻象如何防治", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=7757");
    expect(officialPageUrlsForQuestion("香蕉蟻象如何防治", "kmweb.moa.gov.tw")).not.toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=7757");
    expect(officialPageUrlsForQuestion("甘藷蟻象如何防治", "example.org")).toEqual([]);
    expect(officialPageUrlsForQuestion("甘藷種藷育苗如何挑選健康塊根", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=19318");
    expect(officialPageUrlsForQuestion("茶餅病嫩葉病斑如何辨認", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=7393");
    expect(officialPageUrlsForQuestion("茶園陽坡與陰坡的溫度差異", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=7154");
    expect(officialPageUrlsForQuestion("茶園土壤板結影響根群嗎", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/theme_data.php?id=54800&sub_theme=variety&theme=news");
    expect(officialPageUrlsForQuestion("茶小綠葉蟬使嫩芽捲縮怎麼辦", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=7398");
    expect(officialPageUrlsForQuestion("茶小綠葉蟬如何影響茶菁品質", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=24247");
    expect(officialPageUrlsForQuestion("香蕉抽穗後如何調整肥料", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=288346");
    expect(officialPageUrlsForQuestion("茶苗根系健康如何確認", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?func=1&id=24214&keyword=&type=12809");
    expect(officialPageUrlsForQuestion("甘藷生育初期如何除草", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=19318");
    expect(officialPageUrlsForQuestion("香蕉乾季灌溉如何規劃", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/theme_data.php?id=54411&sub_theme=variety&theme=news");
    expect(officialPageUrlsForQuestion("香菇太空包接種注意什麼", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/theme_data.php?id=55012&sub_theme=agri_life&theme=news");
    expect(officialPageUrlsForQuestion("茶菁採收後運送時如何避免堆積紅化", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/subject/subject.php?id=53669");
    expect(officialPageUrlsForQuestion("甘藷採後破皮如何貯藏", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=423333");
    expect(officialPageUrlsForQuestion("香菇烘乾前如何處理含水差異", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/theme_data.php?id=55135&sub_theme=variety&theme=news");
    expect(officialPageUrlsForQuestion("香蕉採後分梳時乳汁污染怎麼處理", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=283699");
    expect(officialPageUrlsForQuestion("茶園害蟲監測時如何確認葉片受害", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=241168");
    expect(officialPageUrlsForQuestion("甘藷苗圃病毒斑駁需要送驗嗎", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/knowledgebase.php?id=415972");
    expect(officialPageUrlsForQuestion("香蕉園豪雨後積水缺氧怎麼辦", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/theme_data.php?id=53021&sub_theme=agri_life&theme=news");
    expect(officialPageUrlsForQuestion("蕉園雨後低窪區積水缺氧怎麼辦", "kmweb.moa.gov.tw")).toContain("https://kmweb.moa.gov.tw/theme_data.php?id=53021&sub_theme=agri_life&theme=news");
  });

  it("selects indexed PDF pages only for a matching crop, topic, and approved site", () => {
    const site = { url: "https://kmweb.moa.gov.tw/knowledgebase.php?func=0", domain: "kmweb.moa.gov.tw", searchScope: "SITE" };
    expect(officialPdfCandidates("蕉園採後分梳與乳汁如何分級", site).map(item => item.crop)).toContain("banana");
    expect(officialPdfCandidates("甘藷病毒病苗圃如何送驗", site).map(item => item.crop)).toContain("sweet_potato");
    expect(officialPdfCandidates("茶園樹齡不同如何採樣葉片", site).map(item => item.crop)).toContain("tea");
    expect(officialPdfCandidates("香蕉黃葉病", site)).toEqual([]);
    expect(officialPdfCandidates("蕉園採後分梳與乳汁如何分級", { ...site, domain: "example.org" })).toEqual([]);
    expect(officialPdfCandidates("蕉園採後分梳與乳汁如何分級", { ...site, searchScope: "PAGE" })).toEqual([]);
  });
});
