import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fail, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { searchTrustedWeb } from "@/lib/evidence/search-agent";
import { answerAgriculturalQuestion } from "@/lib/ai/agricultural-qa";
import { audit } from "@/lib/audit";

const schema = z.object({ question: z.string().trim().min(2).max(500), conversationId: z.string().trim().optional().nullable() });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    rateLimit(`agricultural-qa:${user.id}`, 10, 60_000);
    const input = schema.parse(await parseJson(request));
    let conversation = input.conversationId ? await db.qaConversation.findFirst({ where: { id: input.conversationId, userId: user.id } }) : null;
    if (input.conversationId && !conversation) throw new AppError("NOT_FOUND", "Q&A conversation not found.", 404);
    if (!conversation) conversation = await db.qaConversation.create({ data: { userId: user.id, title: input.question.slice(0, 60) } });

    const sources = await db.trustedWebSource.findMany({ where: { isActive: true }, orderBy: { createdAt: "asc" } });
    if (!sources.length) throw new AppError("NO_TRUSTED_SOURCES", "An administrator has not configured any trusted websites for agricultural Q&A.", 409);
    const search = await searchTrustedWeb(input.question, sources);
    const grounded = await answerAgriculturalQuestion(input.question, search.results);
    const queryJson = JSON.stringify({ question: input.question, conversationId: conversation.id, sourceIds: sources.map(source => source.id) });
    const saved = await db.$transaction(async transaction => {
      const userMessage = await transaction.qaMessage.create({ data: { conversationId: conversation.id, role: "USER", content: input.question } });
      const assistantMessage = await transaction.qaMessage.create({ data: { conversationId: conversation.id, role: "ASSISTANT", content: grounded.answer, citationsJson: JSON.stringify(grounded.citations), provider: grounded.provider } });
      await transaction.qaConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      for (const result of search.results) await transaction.evidenceSnapshot.create({ data: {
        createdById: user.id, webSourceId: result.sourceId, provider: result.provider, sourceName: result.sourceName, sourceTitle: result.title, sourceUrl: result.url,
        sourceExcerpt: result.excerpt, relevanceScore: result.relevanceScore, queryJson, responseJson: JSON.stringify(result), summary: "Relevant source used by the agricultural Q&A agent. Open the original page to verify it.", status: "SUCCESS",
      } });
      if (!search.results.length) await transaction.evidenceSnapshot.create({ data: { createdById: user.id, provider: search.provider, sourceName: "Agricultural Q&A Search Agent", queryJson, responseJson: JSON.stringify({ warnings: search.warnings }), summary: "No sufficiently relevant content was found in approved sources.", status: "NOT_AVAILABLE" } });
      return { userMessage, assistantMessage };
    });
    await audit({ userId: user.id, action: "ASK", entityType: "QaConversation", entityId: conversation.id, after: { answerMode: grounded.mode, provider: grounded.provider, citationCount: grounded.citations.length } });
    return ok({ conversationId: conversation.id, messages: [saved.userMessage, { ...saved.assistantMessage, citations: grounded.citations, mode: grounded.mode, disclaimer: grounded.disclaimer }], warnings: search.warnings });
  } catch (error) { return fail(error); }
}
