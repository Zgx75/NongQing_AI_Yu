export const BRAND_PROMPT_VERSION = "brand-copy-v1";
export const generateBrandCopyPrompt = (input: unknown) => `只使用提供的品牌資料，採產地—理念—產品特色—情感敘事—行動呼籲。沒有依據不得宣稱無毒、有機、零農藥、療效、健康功效、通過認證、第一名、最佳或政府推薦。回傳 JSON：title, body, callToAction, hashtags, pendingItems, usedFacts, disclaimer。資料：${JSON.stringify(input)}`;
