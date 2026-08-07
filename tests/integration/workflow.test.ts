import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { MockAIProvider } from "@/lib/ai/mock-provider";

const email = "integration@nongqing.test";
let userId = ""; let farmId = ""; let plotId = ""; let recordId = "";

describe.sequential("Core integration workflow", () => {
  beforeAll(async () => {
    const old = await db.user.findUnique({ where: { email } });
    if (old) {
      await db.farmRecord.deleteMany({ where: { creatorId: old.id } });
      await db.farm.deleteMany({ where: { ownerId: old.id } });
      await db.user.delete({ where: { id: old.id } });
    }
  });
  afterAll(async () => {
    if (userId) {
      await db.farmRecord.deleteMany({ where: { creatorId: userId } });
      await db.farm.deleteMany({ where: { ownerId: userId } });
      await db.user.delete({ where: { id: userId } });
    }
    await db.$disconnect();
  });

  it("stores a secure password that can be verified", async () => {
    const hash = await hashPassword("Test1234!");
    const user = await db.user.create({ data: { name: "Integration Test Farmer", email, passwordHash: hash, role: "FARMER" } });
    userId = user.id;
    expect(await verifyPassword("Test1234!", user.passwordHash)).toBe(true);
    expect(user.passwordHash).not.toContain("Test1234");
  });

  it("creates a farm and tea plot", async () => {
    const farm = await db.farm.create({ data: { ownerId: userId, name: "Test Farm", county: "Nantou County", district: "Puli Township", locationDescription: "Test location" } });
    farmId = farm.id;
    const plot = await db.plot.create({ data: { farmId, name: "Tea Test Plot", locationDescription: "" } });
    plotId = plot.id;
    expect(plot.farmId).toBe(farmId);
  });

  it("extracts, creates, completes, and confirms a farm record", async () => {
    const provider = new MockAIProvider();
    const extracted = await provider.extractFarmRecord({ text: "Watered the tea field today", farmId, plotId, today: "2026-07-28" });
    expect(extracted.missingFields).toContain("Weather");
    const record = await db.farmRecord.create({ data: { farmId, plotId, creatorId: userId, recordDate: new Date("2026-07-28T12:00:00"), actionType: extracted.actionType.value, rawInput: "Watered the tea field today", structuredDataJson: JSON.stringify(extracted), status: "NEEDS_CONFIRMATION" } });
    recordId = record.id;
    const confirmed = { ...extracted, missingFields: [], weather: { value: null, source: "UNKNOWN" as const, confidence: 0 }, purpose: { value: null, source: "UNKNOWN" as const, confidence: 0 } };
    await db.farmRecord.update({ where: { id: recordId }, data: { structuredDataJson: JSON.stringify(confirmed), status: "CONFIRMED", confirmedBy: userId, confirmedAt: new Date() } });
    expect((await db.farmRecord.findUnique({ where: { id: recordId } }))?.status).toBe("CONFIRMED");
  });

  it("generates journal, traceability, and brand drafts", async () => {
    const provider = new MockAIProvider();
    const facts = { crop: { value: "Tea", source: "USER_INPUT", confirmed: true }, action: { value: "Watering", source: "USER_INPUT", confirmed: true } };
    expect((await provider.generateFarmJournal({ confirmedData: facts })).disclaimer).toContain("human review");
    expect((await provider.generateTraceabilityDraft({ confirmedData: facts })).title).toContain("Submission Draft");
    expect((await provider.generateBrandCopy({ profile: { brandName: "Test Tea Farm", origin: "Nantou" }, type: "Brand story", targetAudience: "Households", tone: "Simple and sincere", length: "Medium" })).body).not.toContain("pesticide-free");
  });
});
