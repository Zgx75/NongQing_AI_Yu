import type { ExtractFarmRecordResult } from "@/lib/ai/schemas";

export function fieldsRequiringConfirmation(data: ExtractFarmRecordResult) {
  return Object.entries(data).filter(([, v]) => v && typeof v === "object" && "source" in v && ["AI_INFERENCE", "UNKNOWN"].includes(v.source)).map(([key]) => key);
}

export function hasUnconfirmedFacts(data: ExtractFarmRecordResult) {
  return fieldsRequiringConfirmation(data).length > 0 || data.missingFields.length > 0;
}

export function parseRelativeDate(text: string, now = new Date()) {
  const date = new Date(now); date.setHours(12, 0, 0, 0);
  if (text.includes("昨天")) date.setDate(date.getDate() - 1);
  else if (!text.includes("今天")) return null;
  return date.toISOString().slice(0, 10);
}
