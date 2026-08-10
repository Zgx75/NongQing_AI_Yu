import { z } from "zod";

export const sourceSchema = z.enum(["USER_INPUT", "USER_PROFILE", "OPEN_DATA", "AI_INFERENCE", "UNKNOWN"]);
const field = <T extends z.ZodTypeAny>(value: T) => z.object({ value: value.nullable(), source: sourceSchema, confidence: z.number().min(0).max(1) });

export const extractedFarmRecordSchema = z.object({
  recordDate: field(z.string().date()), recordTime: field(z.string()), farmId: field(z.string()), plotId: field(z.string()),
  crop: field(z.string()), variety: field(z.string()), actionType: field(z.string()), purpose: field(z.string()),
  materialName: field(z.string()), amount: field(z.number()), unit: field(z.string()), dilutionRatio: field(z.string()),
  weather: field(z.string()), duration: field(z.string()), notes: field(z.string()),
  missingFields: z.array(z.string()), warnings: z.array(z.string()),
});

export const generatedDocumentSchema = z.object({
  title: z.string(), body: z.string(), pendingItems: z.array(z.string()), usedFacts: z.array(z.string()), disclaimer: z.string(),
});
export const generatedBrandCopySchema = generatedDocumentSchema.extend({ callToAction: z.string(), hashtags: z.array(z.string()) });

export type ExtractFarmRecordResult = z.infer<typeof extractedFarmRecordSchema>;
export type GeneratedDocument = z.infer<typeof generatedDocumentSchema>;
export type GeneratedBrandCopy = z.infer<typeof generatedBrandCopySchema>;

export type ExtractFarmRecordInput = { text: string; farmId?: string; plotId?: string; today?: string };
export type GenerateFarmJournalInput = { confirmedData: Record<string, unknown>; weather?: string | null };
export type GenerateTraceabilityInput = { confirmedData: Record<string, unknown> };
export type GenerateBrandCopyInput = { profile: Record<string, unknown>; type: string; targetAudience: string; tone: string; length: string; confirmedStyleElements?: string[] };
