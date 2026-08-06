import { z } from "zod";

export const emailSchema = z.string().trim().email("Email 格式不正確").max(200);
export const passwordSchema = z.string().min(8, "密碼至少需要 8 個字元").max(128);
export const idSchema = z.string().min(1);
export const optionalText = z.string().trim().max(5000).default("");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "請輸入姓名").max(80), email: emailSchema, password: passwordSchema,
  role: z.enum(["FARMER", "COOPERATIVE"]).default("FARMER"), consent: z.literal(true, { errorMap: () => ({ message: "請先同意資料使用聲明" }) }),
});
export const loginSchema = z.object({ email: emailSchema, password: z.string().min(1, "請輸入密碼") });
export const farmSchema = z.object({
  name: z.string().trim().min(1, "請輸入農場名稱").max(120), county: z.string().trim().min(1), district: z.string().trim().min(1),
  locationDescription: z.string().trim().min(1).max(500), introduction: optionalText, philosophy: optionalText,
  farmingMethod: optionalText, certificationInfo: optionalText, contactName: z.string().trim().max(80).default(""),
});
export const plotSchema = z.object({
  farmId: idSchema, name: z.string().trim().min(1).max(120), area: z.number().positive().nullable().optional(), areaUnit: z.string().max(30).nullable().optional(),
  locationDescription: z.string().trim().max(500).default(""), isActive: z.boolean().default(true),
  cropId: idSchema.optional(), cropVarietyId: idSchema.optional(), plantedAt: z.string().date().optional(), expectedHarvestAt: z.string().date().optional(),
});
