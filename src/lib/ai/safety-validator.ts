const prohibited = ["無毒", "零農藥", "治療", "療效", "政府推薦", "第一名", "全臺最佳", "百分之百有機"];

export function validateBrandClaims(text: string, verifiedFacts: string[]) {
  const corpus = verifiedFacts.join(" ");
  return prohibited.filter((claim) => text.includes(claim) && !corpus.includes(claim));
}

export function onlyConfirmedData(data: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(data).filter(([, value]) => {
    if (!value || typeof value !== "object" || !("source" in value)) return true;
    const v = value as { source?: string; confirmed?: boolean };
    return v.confirmed === true && v.source !== "UNKNOWN";
  }));
}
