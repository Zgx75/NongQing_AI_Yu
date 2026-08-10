const restrictedBrandClaims = [
  "無毒", "零農藥", "無農藥", "自然農法", "三代家族務農", "三代務農", "有機", "治療", "療效",
  "健康功效", "政府推薦", "第一名", "全臺最佳", "百分之百有機", "pesticide-free", "pesticide free",
  "natural farming", "three generations", "organic", "non-toxic", "health benefit", "health benefits",
  "therapeutic", "government recommended", "government-endorsed", "number one", "best in Taiwan",
];

export function collectTextFacts(value: unknown): string[] {
  if (typeof value === "string" || typeof value === "number") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(collectTextFacts);
  if (value && typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(collectTextFacts);
  return [];
}

export function validateBrandClaims(text: string, verifiedFacts: string[]) {
  const normalizedText = text.toLocaleLowerCase();
  const corpus = verifiedFacts.join(" ").toLocaleLowerCase();
  return restrictedBrandClaims.filter(claim => normalizedText.includes(claim.toLocaleLowerCase()) && !corpus.includes(claim.toLocaleLowerCase()));
}

export function onlyConfirmedData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => {
    if (!value || typeof value !== "object" || !("source" in value)) return true;
    const field = value as { source?: string; confirmed?: boolean };
    return field.confirmed === true && field.source !== "UNKNOWN";
  }));
}
