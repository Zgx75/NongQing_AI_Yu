import Link from "next/link";
import { MessageCirclePlus } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { AgriculturalQa } from "@/components/qa/agricultural-qa";

type StoredCitation = { index: number; sourceName: string; title: string; url: string; excerpt: string; relevanceScore: number };
function citations(value: string): StoredCitation[] { try { const parsed = JSON.parse(value); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }

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
    <aside className="surface h-fit p-4"><Link href="/qa" className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#315c3b] px-4 font-bold text-white"><MessageCirclePlus size={19}/>新增對話</Link><h2 className="mb-2 mt-5 font-black">最近對話</h2><nav className="space-y-2">{conversations.map(item => <Link key={item.id} href={`/qa?conversationId=${item.id}`} className={`block rounded-xl p-3 text-sm ${selectedId === item.id ? "bg-[#edf4e8] font-bold" : "hover:bg-stone-100"}`}><span className="line-clamp-2">{item.title}</span><small className="text-stone-500">{item.updatedAt.toLocaleString("zh-TW")}</small></Link>)}{!conversations.length && <p className="text-sm text-stone-600">尚無問答紀錄</p>}</nav></aside>
    <AgriculturalQa initialConversationId={selectedId} initialMessages={messages.map(message => ({ id: message.id, role: message.role, content: message.content, citations: citations(message.citationsJson), provider: message.provider }))} sourceCount={sourceCount}/>
  </div>;
}
