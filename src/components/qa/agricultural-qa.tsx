"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bot, ExternalLink, Send, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

type Citation = { index: number; sourceName: string; title: string; url: string; excerpt: string; relevanceScore: number };
type Message = { id: string; role: string; content: string; citations: Citation[]; provider?: string; disclaimer?: string };

export function AgriculturalQa({ initialConversationId, initialMessages, sourceCount }: { initialConversationId: string | null; initialMessages: Message[]; sourceCount: number }) {
  const router = useRouter();
  const [conversationId, setConversationId] = useState(initialConversationId);
  const [messages, setMessages] = useState(initialMessages);
  const [question, setQuestion] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function ask(event: React.FormEvent) {
    event.preventDefault();
    const text = question.trim();
    if (text.length < 2 || busy) return;
    const optimistic: Message = { id: `pending-${Date.now()}`, role: "USER", content: text, citations: [] };
    setMessages(current => [...current, optimistic]); setQuestion(""); setBusy(true); setError(""); setWarnings([]);
    const response = await fetch("/api/qa", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question: text, conversationId }) });
    const payload = await response.json();
    if (!response.ok) {
      setMessages(current => current.filter(message => message.id !== optimistic.id));
      setQuestion(text); setError(payload.error?.message || "目前無法回答，請稍後再試。");
    } else {
      const returned = payload.data.messages as Array<{ id: string; role: string; content: string; citations?: Citation[]; provider?: string; disclaimer?: string }>;
      setMessages(current => [...current.filter(message => message.id !== optimistic.id), ...returned.map(message => ({ ...message, citations: message.citations || [] }))]);
      setWarnings(payload.data.warnings || []);
      if (!conversationId) {
        setConversationId(payload.data.conversationId);
        router.replace(`/qa?conversationId=${payload.data.conversationId}`);
      }
      router.refresh();
    }
    setBusy(false);
  }

  return <div className="flex min-h-[68vh] flex-col rounded-2xl border border-[#d6d0bf] bg-[#fffdf8] shadow-sm">
    <header className="border-b p-4 md:p-5"><h1 className="text-2xl font-black">農業問答助手</h1><p className="text-sm text-stone-600">回答前會搜尋 {sourceCount} 個已核准來源；沒有來源就不猜測。</p></header>
    <div className="flex-1 space-y-5 overflow-y-auto p-4 md:p-6" aria-live="polite">
      {!messages.length && <div className="mx-auto max-w-xl rounded-2xl bg-[#edf4e8] p-6 text-center"><Bot className="mx-auto mb-3 text-[#315c3b]" size={42}/><h2 className="text-xl font-black">可以詢問栽培、施肥或病蟲害知識</h2><p className="mt-2 text-stone-600">例如：「番茄結果期的肥培管理要注意什麼？」系統會先找來源，再整理回答。</p></div>}
      {messages.map(message => <article key={message.id} className={`flex gap-3 ${message.role === "USER" ? "justify-end" : "justify-start"}`}>
        {message.role !== "USER" && <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#315c3b] text-white"><Bot size={21}/></span>}
        <div className={`max-w-3xl rounded-2xl p-4 ${message.role === "USER" ? "bg-[#315c3b] text-white" : "border bg-white"}`}>
          <div className="whitespace-pre-wrap">{message.content}</div>
          {message.citations.length > 0 && <div className="mt-4 space-y-2 border-t pt-3"><b className="text-sm">引用來源</b>{message.citations.map(citation => <a key={`${message.id}-${citation.index}`} href={citation.url} target="_blank" rel="noreferrer" className="block rounded-xl bg-stone-100 p-3 text-sm hover:bg-stone-200"><span className="font-black text-[#315c3b]">[{citation.index}] {citation.sourceName}</span><span className="mt-1 flex items-center gap-1 font-bold">{citation.title}<ExternalLink size={14}/></span><span className="mt-1 block text-stone-600">相關度 {Math.round(citation.relevanceScore * 100)}%</span></a>)}</div>}
          {message.role !== "USER" && <p className="mt-3 border-t pt-3 text-xs font-bold text-amber-900">{message.disclaimer || "回答由核准網站資料協助整理，重要決策請核對原文與最新公告。"}</p>}
        </div>
        {message.role === "USER" && <span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#6d552e] text-white"><UserRound size={21}/></span>}
      </article>)}
      {busy && <div className="flex items-center gap-3 text-stone-600"><span className="grid size-10 place-items-center rounded-full bg-[#315c3b] text-white"><Bot size={21}/></span><span className="animate-pulse">正在搜尋可信來源並整理回答…</span></div>}
    </div>
    <div className="border-t p-4 md:p-5">{error && <div className="mb-3"><ErrorState message={error}/></div>}{warnings.length > 0 && <details className="mb-3 rounded-xl bg-amber-50 p-3 text-sm"><summary className="cursor-pointer font-bold">部分來源未完成（{warnings.length}）</summary><ul className="mt-2 list-inside list-disc">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></details>}
      <form onSubmit={ask} className="flex items-end gap-3"><label className="flex-1"><span className="sr-only">農業問題</span><textarea className="field min-h-20 resize-y" value={question} onChange={event => setQuestion(event.target.value)} maxLength={500} required placeholder="輸入農業問題…"/></label><Button className="shrink-0" disabled={busy || sourceCount === 0 || question.trim().length < 2}><Send className="inline" size={19}/> 送出</Button></form>
      <p className="mt-2 text-xs text-stone-600">農藥、法規與安全採收期請以產品標示及主管機關最新公告為準。</p>
    </div>
  </div>;
}
