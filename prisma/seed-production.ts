import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const crops = [
    { name: "高山茶", category: "茶葉", varieties: ["青心烏龍", "金萱"] },
    { name: "地瓜", category: "根莖", varieties: ["台農57號"] },
    { name: "香菇", category: "菇類", varieties: ["示範香菇品種"] },
    { name: "香蕉", category: "水果", varieties: ["北蕉"] },
  ];
  for (const item of crops) {
    const crop = await db.crop.upsert({ where: { name: item.name }, update: { category: item.category }, create: { name: item.name, category: item.category } });
    for (const name of item.varieties) await db.cropVariety.upsert({ where: { cropId_name: { cropId: crop.id, name } }, update: {}, create: { cropId: crop.id, name } });
  }
  const prompts = [
    { key: "farm-journal", name: "農場日誌", category: "RECORD", systemPrompt: "只使用已確認資料，不補寫事實。", userPromptTemplate: "以動作—作物—天氣—效果整理；無天氣時標示未取得。" },
    { key: "traceability", name: "產銷履歷申報草稿", category: "TRACEABILITY", systemPrompt: "只能輸出草稿，不保證法規合規。", userPromptTemplate: "整理已確認欄位，缺漏列入待確認。" },
    { key: "brand-copy", name: "品牌文案", category: "BRAND", systemPrompt: "禁止未經佐證的認證、療效與最高級宣稱。", userPromptTemplate: "以產地—理念—特色—情感—行動呼籲整理。" },
  ];
  for (const item of prompts) await db.promptTemplate.upsert({ where: { key_version: { key: item.key, version: 1 } }, update: item, create: { ...item, version: 1 } });
  for (const item of [{ incorrectTerm: "高山查", correctedTerm: "高山茶", category: "作物" }, { incorrectTerm: "香姑", correctedTerm: "香菇", category: "作物" }]) await db.agriculturalTerm.upsert({ where: { incorrectTerm_correctedTerm: { incorrectTerm: item.incorrectTerm, correctedTerm: item.correctedTerm } }, update: { category: item.category, isActive: true }, create: { ...item, isActive: true } });
  console.log("Production reference data seeded without demo users.");
}

main().finally(() => db.$disconnect());
