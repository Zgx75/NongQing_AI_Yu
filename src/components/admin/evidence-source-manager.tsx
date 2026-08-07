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
    if (!response.ok) setError(payload.error?.message || "Unable to add the source.");
    else { setMessage("Trusted source added."); router.refresh(); }
    setBusy("");
  }

  async function toggle(source: Source) {
    setBusy(source.id); setError("");
    const response = await fetch(`/api/admin/evidence-sources/${source.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ isActive: !source.isActive }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "Unable to update the source."); else router.refresh();
    setBusy("");
  }

  async function remove(source: Source) {
    if (!window.confirm(`Delete “${source.name}”? Existing evidence snapshots will be retained.`)) return;
    setBusy(source.id); setError("");
    const response = await fetch(`/api/admin/evidence-sources/${source.id}`, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "Unable to delete the source."); else router.refresh();
    setBusy("");
  }

  return <div className="space-y-5">
    {error && <ErrorState message={error}/>} {message && <p className="rounded-xl bg-green-50 p-4 text-green-900">{message}</p>}
    <form action={addSource} className="grid gap-3 lg:grid-cols-2">
      <label><span className="label">Source name</span><input className="field" name="name" required placeholder="Example: Tainan District Agricultural Research and Extension Station"/></label>
      <label><span className="label">Search scope</span><select className="field" name="searchScope" defaultValue="PAGE"><option value="PAGE">This page only</option><option value="SITE">Related pages on this domain</option></select></label>
      <label className="lg:col-span-2"><span className="label">Full URL</span><input className="field" name="url" type="url" required placeholder="https://example.org/agriculture/guide"/></label>
      <label className="lg:col-span-2"><span className="label">Source description (optional)</span><textarea className="field min-h-24" name="description" maxLength={500} placeholder="Describe what agricultural information this site is useful for"/></label>
      <Button className="lg:col-span-2" disabled={busy === "add"}>{busy === "add" ? "Adding…" : "Add trusted source"}</Button>
    </form>
    <div className="space-y-3">{sources.map(source => <div className="rounded-xl border bg-white p-4" key={source.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-black">{source.name}</h3><p className="help">{source.searchScope === "SITE" ? "Domain search" : "Single page"} · {source.domain}</p></div><span className={`rounded-full px-3 py-1 text-sm font-bold ${source.isActive ? "bg-green-100 text-green-900" : "bg-stone-200 text-stone-700"}`}>{source.isActive ? "Active" : "Inactive"}</span></div>
      {source.description && <p className="mt-2 text-stone-700">{source.description}</p>}
      <a href={source.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex max-w-full items-center gap-1 break-all text-sm font-bold text-[#315c3b] underline">{source.url}<ExternalLink size={15}/></a>
      <div className="mt-3 flex gap-2"><Button variant="secondary" disabled={busy === source.id} onClick={() => toggle(source)}>{source.isActive ? "Disable" : "Enable"}</Button><Button variant="danger" disabled={busy === source.id} onClick={() => remove(source)}><Trash2 className="inline" size={17}/> Delete</Button></div>
    </div>)}{!sources.length && <p className="rounded-xl border border-dashed p-6 text-center text-stone-600">No trusted websites configured.</p>}</div>
  </div>;
}
