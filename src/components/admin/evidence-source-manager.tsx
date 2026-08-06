"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/ui/states";

type Source = { id: string; name: string; url: string; domain: string; description: string; searchScope: string; isActive: boolean };

export function EvidenceSourceManager({ sources }: { sources: Source[] }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  async function addSource(formData: FormData) {
    setBusy("add"); setError(""); setMessage("");
    const response = await fetch("/api/admin/evidence-sources", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: formData.get("name"), url: formData.get("url"), description: formData.get("description"), searchScope: formData.get("searchScope"), isActive: true }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "新增來源失敗。");
    else { setMessage("可信來源已新增。"); router.refresh(); }
    setBusy("");
  }

  async function toggle(source: Source) {
    setBusy(source.id); setError("");
    const response = await fetch(`/api/admin/evidence-sources/${source.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !source.isActive }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "更新來源失敗。"); else router.refresh();
    setBusy("");
  }

  async function remove(source: Source) {
    if (!window.confirm(`確定刪除「${source.name}」？既有佐證快照仍會保留。`)) return;
    setBusy(source.id); setError("");
    const response = await fetch(`/api/admin/evidence-sources/${source.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "刪除來源失敗。"); else router.refresh();
    setBusy("");
  }

  return <div className="space-y-5">
    {error && <ErrorState message={error}/>} {message && <p className="rounded-xl bg-green-50 p-4 text-green-900">{message}</p>}
    <form action={addSource} className="grid gap-3 lg:grid-cols-2">
      <label><span className="label">來源名稱</span><input className="field" name="name" required placeholder="例如：臺南區農業改良場"/></label>
      <label><span className="label">搜尋範圍</span><select className="field" name="searchScope" defaultValue="PAGE"><option value="PAGE">只搜尋這一頁</option><option value="SITE">搜尋同網域相關頁面</option></select></label>
      <label className="lg:col-span-2"><span className="label">完整網址</span><input className="field" name="url" type="url" required placeholder="https://example.org/agriculture/guide"/></label>
      <label className="lg:col-span-2"><span className="label">來源說明（選填）</span><textarea className="field min-h-24" name="description" maxLength={500} placeholder="說明這個網站適合查找哪些內容"/></label>
      <Button className="lg:col-span-2" disabled={busy === "add"}>{busy === "add" ? "新增中…" : "新增可信來源"}</Button>
    </form>
    <div className="space-y-3">{sources.map(source => <div className="rounded-xl border bg-white p-4" key={source.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{source.name}</h3><p className="help">{source.searchScope === "SITE" ? "同網域搜尋" : "單一頁面"}・{source.domain}</p></div><span className={`rounded-full px-3 py-1 text-sm font-bold ${source.isActive ? "bg-green-100 text-green-900" : "bg-stone-200 text-stone-700"}`}>{source.isActive ? "啟用" : "停用"}</span></div>
      {source.description && <p className="mt-2 text-stone-700">{source.description}</p>}
      <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-sm font-bold text-[#315c3b] underline">{source.url}<ExternalLink size={15}/></a>
      <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={busy === source.id} onClick={() => toggle(source)}>{source.isActive ? "停用" : "啟用"}</Button><Button variant="danger" disabled={busy === source.id} onClick={() => remove(source)}><Trash2 className="inline" size={17}/> 刪除</Button></div>
    </div>)}{!sources.length && <p className="rounded-xl border border-dashed p-6 text-center text-stone-600">尚未設定可信網站。</p>}</div>
  </div>;
}
