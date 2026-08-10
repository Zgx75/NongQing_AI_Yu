import { describe, expect, it } from "vitest";
import { MockAIProvider } from "@/lib/ai/mock-provider";
import { generateBrandCopyPrompt, BRAND_PROMPT_VERSION } from "@/lib/ai/prompts/generate-brand-copy";

describe("Marketing Mix brand generation", () => {
  it("defines Product, Promotion, Place, output schema, and verified story-element rules", () => {
    const prompt = generateBrandCopyPrompt({ profile: { origin: "Nantou" }, confirmedStyleElements: ["Natural farming"] });
    expect(BRAND_PROMPT_VERSION).toContain("marketing-mix");
    expect(prompt).toContain("PRODUCT:"); expect(prompt).toContain("PROMOTION:"); expect(prompt).toContain("PLACE:");
    expect(prompt).toContain("origin -> philosophy -> product features -> emotional narrative -> call to action");
    expect(prompt).toContain("confirmedStyleElements");
  });

  it("uses a user-confirmed selectable story element as a verified fact", async () => {
    const result = await new MockAIProvider().generateBrandCopy({
      profile: { brandName: "Test Farm", crop: "Tea", origin: "Nantou" },
      type: "Brand story", targetAudience: "Households", tone: "Simple and sincere", length: "Medium",
      confirmedStyleElements: ["Pesticide-free cultivation / 無農藥栽培"],
    });
    expect(result.usedFacts).toContain("Pesticide-free cultivation / 無農藥栽培");
    expect(result.body).toContain("Pesticide-free cultivation");
  });
});
