import { randomUUID } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fail, ok, parseJson } from "@/lib/api";
import { requireUser } from "@/lib/auth/require-user";
import { rateLimit } from "@/lib/rate-limit";
import { searchTrustedWeb } from "@/lib/evidence/search-agent";
import { AGRICULTURAL_QA_PROMPT_VERSION, answerAgriculturalQuestion } from "@/lib/ai/agricultural-qa";
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
    const runId = randomUUID();
    const search = await searchTrustedWeb(input.question, sources);
    const grounded = await answerAgriculturalQuestion(input.question, search.results);
    const executionStatus = search.warnings.length && grounded.executionStatus === "completed" ? "degraded" : grounded.executionStatus;
    const searchDiagnostics = {
      runId,
      provider: search.provider,
      configuredSourceCount: sources.length,
      searchedSourceCount: search.sourceDiagnostics.length,
      candidateCount: search.results.length,
      answerGeneration: {
        provider: process.env.AI_PROVIDER || "unconfigured",
        modelName: process.env.AI_PROVIDER === "gemini" ? process.env.GEMINI_MODEL || "unconfigured" : process.env.AI_PROVIDER || "unconfigured",
        promptVersion: AGRICULTURAL_QA_PROMPT_VERSION,
        groundedTemperature: 0.1,
        generalTemperature: 0.2,
      },
      sourceDiagnostics: search.sourceDiagnostics,
      warnings: search.warnings,
    };
    const queryJson = JSON.stringify({ runId, question: input.question, conversationId: conversation.id, sourceIds: sources.map(source => source.id), searchDiagnostics });
    const saved = await db.$transaction(async transaction => {
      const userMessage = await transaction.qaMessage.create({ data: { conversationId: conversation.id, role: "USER", content: input.question } });
      const assistantMessage = await transaction.qaMessage.create({ data: {
        conversationId: conversation.id,
        role: "ASSISTANT",
        content: grounded.answer,
        citationsJson: JSON.stringify(grounded.citations),
        provider: grounded.provider,
        mode: grounded.mode,
        executionStatus,
        answerStatus: grounded.answerStatus,
        groundingStatus: grounded.groundingStatus,
        failureStage: grounded.failureStage,
        disclaimer: grounded.disclaimer,
        searchDiagnosticsJson: JSON.stringify(searchDiagnostics),
      } });
      await transaction.qaConversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });
      for (const result of search.results) await transaction.evidenceSnapshot.create({ data: {
        createdById: user.id, webSourceId: result.sourceId, provider: result.provider, sourceName: result.sourceName, sourceTitle: result.title, sourceUrl: result.url,
        sourceExcerpt: result.excerpt, relevanceScore: result.relevanceScore, queryJson, responseJson: JSON.stringify(result),
        summary: grounded.citations.some(citation => citation.sourceId === result.sourceId && citation.url === result.url && citation.excerpt === result.excerpt)
          ? "Passage cited in this answer. Open the original page to verify the surrounding context."
          : "Retrieved search candidate; it was not used as a direct citation in this answer.",
        status: "SUCCESS",
      } });
      if (!search.results.length) await transaction.evidenceSnapshot.create({ data: {
        createdById: user.id, provider: search.provider, sourceName: "Agricultural Q&A Search Agent", queryJson,
        responseJson: JSON.stringify({ sourceDiagnostics: search.sourceDiagnostics, warnings: search.warnings }),
        summary: search.warnings.length ? "Some source searches failed; no usable passages were returned. See diagnostics for affected sources." : "Search completed, but no sufficiently relevant content was found in approved sources.",
        status: "NOT_AVAILABLE",
      } });
      return { userMessage, assistantMessage };
    });
    await audit({ userId: user.id, action: "ASK", entityType: "QaConversation", entityId: conversation.id, after: {
      answerMode: grounded.mode,
      runId,
      executionStatus,
      answerStatus: grounded.answerStatus,
      groundingStatus: grounded.groundingStatus,
      failureStage: grounded.failureStage,
      provider: grounded.provider,
      searchProvider: search.provider,
      resultCount: search.results.length,
      citationCount: grounded.citations.length,
      sourceDiagnostics: search.sourceDiagnostics,
    } });
    return ok({ conversationId: conversation.id, messages: [saved.userMessage, { ...saved.assistantMessage, citations: grounded.citations, searchDiagnostics, mode: grounded.mode, executionStatus, answerStatus: grounded.answerStatus, groundingStatus: grounded.groundingStatus, disclaimer: grounded.disclaimer }], warnings: search.warnings });
  } catch (error) { return fail(error); }
}
