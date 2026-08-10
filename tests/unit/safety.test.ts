import { describe, expect, it } from "vitest";
import { collectTextFacts, onlyConfirmedData, validateBrandClaims } from "@/lib/ai/safety-validator";

describe("AI safety validation", () => {
  it("blocks unsupported Chinese and English promotional claims", () => {
    expect(validateBrandClaims("全臺最佳無毒蔬菜", [])).toEqual(expect.arrayContaining(["無毒", "全臺最佳"]));
    expect(validateBrandClaims("Certified pesticide-free natural farming", [])).toEqual(expect.arrayContaining(["pesticide-free", "natural farming"]));
  });

  it("allows a restricted statement when it is present in confirmed facts", () => {
    expect(validateBrandClaims("Our farm uses pesticide-free cultivation.", ["Pesticide-free cultivation / 無農藥栽培"])).not.toContain("pesticide-free");
  });

  it("collects nested profile text as verified facts", () => {
    expect(collectTextFacts({ origin: "Nantou", details: ["Tea", { method: "Natural farming" }] })).toEqual(["Nantou", "Tea", "Natural farming"]);
  });

  it("passes only manually confirmed structured fields to generation", () => {
    const safe = onlyConfirmedData({ crop: { value: "Tea", source: "USER_INPUT", confirmed: true }, weather: { value: "Sunny", source: "AI_INFERENCE", confirmed: false } });
    expect(safe).toHaveProperty("crop"); expect(safe).not.toHaveProperty("weather");
  });
});
