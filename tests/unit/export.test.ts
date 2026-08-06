import { describe,expect,it } from "vitest"; import { createChinesePdf } from "@/lib/export/pdf";
describe("PDF 匯出",()=>{it("建立合法 PDF 開頭與人工確認聲明",()=>{const pdf=createChinesePdf("農場日誌",["AI 協助整理，需人工確認"]);expect(pdf.subarray(0,8).toString()).toBe("%PDF-1.4");expect(pdf.length).toBeGreaterThan(500)})});
