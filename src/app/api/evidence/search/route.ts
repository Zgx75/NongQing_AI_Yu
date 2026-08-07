import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fail, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require-user";
import { searchTrustedWeb } from "@/lib/evidence/search-agent";
import { rateLimit } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";

const schema = z.object({ question: z.string().trim().min(2).max(500), farmRecordId: z.string().trim().optional().nullable() });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    rateLimit(`evidence-search:${user.id}`, 10, 60_000);
    const input = schema.parse(await parseJson(request));
    if (input.farmRecordId) {
      const record = await db.farmRecord.findUnique({ where: { id: input.farmRecordId }, include: { farm: { include: { members: true } } } });
      if (!record || (user.role !== "ADMIN" && record.farm.ownerId !== user.id && !record.farm.members.some(member => member.userId === user.id))) throw new AppError("NOT_FOUND", "Record not found, or you do not have permission to view it.", 404);
    }
    const sources = await db.trustedWebSource.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (!sources.length) throw new AppError("NO_TRUSTED_SOURCES", "An administrator has not configured any trusted websites to search.", 409);
    const output = await searchTrustedWeb(input.question, sources);
    const queryJson = JSON.stringify({ question: input.question, sourceIds: sources.map(source => source.id) });
    const saved = output.results.length ? await Promise.all(output.results.map(result => db.evidenceSnapshot.create({ data: {
      farmRecordId: input.farmRecordId || null,
      createdById: user.id,
      webSourceId: result.sourceId,
      provider: result.provider,
      sourceName: result.sourceName,
      sourceTitle: result.title,
      sourceUrl: result.url,
      sourceExcerpt: result.excerpt,
      relevanceScore: result.relevanceScore,
      queryJson,
      responseJson: JSON.stringify(result),
      summary: "The search agent found a relevant passage. Open the original source to decide whether it supports the claim.",
      status: "SUCCESS",
    } }))) : [await db.evidenceSnapshot.create({ data: {
      farmRecordId: input.farmRecordId || null,
      createdById: user.id,
      provider: output.provider,
      sourceName: "Trusted Website Search Agent",
      queryJson,
      responseJson: JSON.stringify({ warnings: output.warnings }),
      summary: "No sufficiently relevant content was found in approved sources.",
      status: "NOT_AVAILABLE",
    } })];
    await audit({ userId: user.id, action: "SEARCH", entityType: "EvidenceSnapshot", after: { question: input.question, provider: output.provider, resultCount: output.results.length, sourceCount: sources.length } });
    return ok({ provider: output.provider, results: saved, warnings: output.warnings });
  } catch (error) { return fail(error); }
}
