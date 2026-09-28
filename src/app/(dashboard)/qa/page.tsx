import Link from "next/link";
import { MessageCirclePlus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AgriculturalQa } from "@/components/qa/agricultural-qa";

type StoredCitation = { index: number; sourceName: string; title: string; url: string; excerpt: string; relevanceScore: number; provider?: string; retrievedAt?: string; archiveUrl?: string };
type StoredSearchDiagnostics = { runId: string; provider: string; configuredSourceCount: number; searchedSourceCount: number; candidateCount: number; answerGeneration?: { provider: string; modelName: string; promptVersion: string; groundedTemperature: number; generalTemperature: number }; sourceDiagnostics: Array<{ sourceId: string; sourceName: string; status: string; candidateCount: number; warningCount: number }>; warnings: string[] };
function citations(value: string): StoredCitation[] { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
function diagnostics(value: string): StoredSearchDiagnostics | undefined {
  try {
    const parsed = JSON.parse(value) as Partial<StoredSearchDiagnostics>;
    if (typeof parsed.provider !== "string" || !Array.isArray(parsed.sourceDiagnostics) || !Array.isArray(parsed.warnings)) return undefined;
    return { runId: typeof parsed.runId === "string" ? parsed.runId : "", provider: parsed.provider, configuredSourceCount: Number(parsed.configuredSourceCount) || 0, searchedSourceCount: Number(parsed.searchedSourceCount) || parsed.sourceDiagnostics.length, candidateCount: Number(parsed.candidateCount) || 0, answerGeneration: parsed.answerGeneration, sourceDiagnostics: parsed.sourceDiagnostics, warnings: parsed.warnings };
  } catch { return undefined; }
}

export default async function QaPage({ searchParams }: { searchParams: Promise<{ conversationId?: string }> }) {
  const user = (await getCurrentUser())!;
  const requestedId = (await searchParams).conversationId;
  const conversations = await db.qaConversation.findMany({ where: { userId: user.id }, orderBy: { updatedAt: "desc" }, take: 20 });
  const selectedId = requestedId && conversations.some(item => item.id === requestedId) ? requestedId : null;
  const [messages, sourceCount] = await Promise.all([
    selectedId ? db.qaMessage.findMany({ where: { conversationId: selectedId }, orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
    db.trustedWebSource.count({ where: { isActive: true } }),
  ]);
  return <div className="page-shell grid gap-5 lg:grid-cols-[260px_1fr]">
    <aside className="surface h-fit p-4"><Link href="/qa" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#315c3b] px-4 font-bold text-white"><MessageCirclePlus size={19}/>New conversation</Link><h2 className="mb-2 mt-5 font-black">Recent conversations</h2><nav className="space-y-2">{conversations.map(item => <Link key={item.id} href={`/qa?conversationId=${item.id}`} className={`block rounded-xl p-3 text-sm ${selectedId === item.id ? "bg-[#edf4e8] font-bold" : "hover:bg-stone-100"}`}><span className="line-clamp-2">{item.title}</span><small className="text-stone-500">{item.updatedAt.toLocaleString("en-US")}</small></Link>)}{!conversations.length && <p className="text-sm text-stone-600">No conversations yet</p>}</nav></aside>
    <AgriculturalQa initialConversationId={selectedId} initialMessages={messages.map(message => {
      const mode = message.mode === "legacy" ? (message.provider.endsWith(":general") ? "general-ai" : "legacy") : message.mode;
      const disclaimer = message.disclaimer || (mode === "general-ai"
        ? "This earlier answer used Gemini general knowledge. The links shown are related results, not citations for every statement."
        : "This earlier message does not contain a saved answer status or source note. Open the original pages to verify its claims.");
      return { id: message.id, role: message.role, content: message.content, citations: citations(message.citationsJson), provider: message.provider, mode, executionStatus: message.executionStatus, answerStatus: message.answerStatus, groundingStatus: message.groundingStatus, failureStage: message.failureStage || undefined, disclaimer, searchDiagnostics: diagnostics(message.searchDiagnosticsJson) };
    })} sourceCount={sourceCount}/>
  </div>;
}
