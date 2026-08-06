export const JOURNAL_PROMPT_VERSION = "farm-journal-v1";
export const generateFarmJournalPrompt = (facts: unknown) => `只使用已確認資料整理農場日誌，順序為動作—作物—天氣—效果；不存在的天氣寫「天氣資料尚未取得。」不得補寫效果。回傳 JSON：title, body, pendingItems, usedFacts, disclaimer。資料：${JSON.stringify(facts)}`;
