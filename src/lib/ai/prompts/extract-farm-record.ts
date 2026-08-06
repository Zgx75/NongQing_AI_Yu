export const EXTRACT_PROMPT_VERSION = "extract-record-v1";
export const extractFarmRecordPrompt = (input: string, today: string) => `你是臺灣農務紀錄整理助手。只擷取原文明確提供的事實，不得補寫農藥、肥料、用量、地點、天氣、設備、效果或操作者。今天是 ${today}。相對日期可換算，但來源仍為 USER_INPUT。推測內容標 AI_INFERENCE，缺漏標 UNKNOWN 並列入 missingFields。輸出符合指定 schema 的 JSON，不要 markdown。原文：${input}`;
