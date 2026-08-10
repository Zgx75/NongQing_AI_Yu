import { z } from "zod";
import { AppError, fail, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require-user";
import { getAIProvider } from "@/lib/ai";
import { logAI } from "@/lib/ai/log";
import { collectTextFacts, validateBrandClaims } from "@/lib/ai/safety-validator";
import { BRAND_PROMPT_VERSION } from "@/lib/ai/prompts/generate-brand-copy";

const styleFacts: Record<string, string> = {
  NATURAL_FARMING: "Natural farming / 自然農法",
  PESTICIDE_FREE: "Pesticide-free cultivation / 無農藥栽培",
  THREE_GENERATIONS: "Three generations of family farming / 三代家族務農",
};
const schema = z.object({
  profile: z.record(z.unknown()), type: z.string(), targetAudience: z.string(), tone: z.string(),
  length: z.enum(["短", "中", "長"]), styleElements: z.array(z.string().trim().min(1).max(120)).max(20).default([]),
  styleElementsConfirmed: z.literal(true, { errorMap: () => ({ message: "Confirm that the selected story elements are accurate." }) }),
});

export async function POST(request: Request) {
  const provider = getAIProvider();
  try {
    const user = await requireUser();
    const input = schema.parse(await parseJson(request));
    const payload = { profile: input.profile, type: input.type, targetAudience: input.targetAudience, tone: input.tone, length: input.length, confirmedStyleElements: [...new Set(input.styleElements.map(element => styleFacts[element] || element))] };
    const result = await provider.generateBrandCopy(payload);
    const verifiedFacts = [...collectTextFacts(input.profile), ...payload.confirmedStyleElements];
    const unsupported = validateBrandClaims(`${result.title}\n${result.body}\n${result.callToAction}\n${result.hashtags.join(" ")}`, verifiedFacts);
    if (unsupported.length) throw new AppError("UNSUPPORTED_BRAND_CLAIM", `The generated draft contained unsupported claims: ${unsupported.join(", ")}. Add verified supporting facts or generate a new draft.`, 422);
    await logAI({ userId: user.id, provider, requestType: "GENERATE_BRAND_COPY", promptVersion: BRAND_PROMPT_VERSION, payload, parsed: result, status: "SUCCESS" });
    return ok({ ...result, meta: { provider: provider.providerName, modelName: provider.modelName, promptVersion: BRAND_PROMPT_VERSION } });
  } catch (error) { return fail(error); }
}
