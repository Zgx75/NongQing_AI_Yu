export const TRACEABILITY_PROMPT_VERSION = "traceability-draft-v1";
export const generateTraceabilityPrompt = (facts: unknown) => `只整理提供的已確認資料，不補寫事實、不保證法規合規。缺漏列入 pendingItems，文件只能稱為申報草稿並要求人工確認。回傳 JSON：title, body, pendingItems, usedFacts, disclaimer。資料：${JSON.stringify(facts)}`;
