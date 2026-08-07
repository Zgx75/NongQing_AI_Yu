"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

type RecordOption = { id: string; label: string };
type SearchResult = { id: string; sourceName: string; sourceTitle: string | null; sourceUrl: string | null; sourceExcerpt: string | null; relevanceScore: number | null; summary: string; status: string };

export function EvidenceSearchPanel({ records, sourceCount, initialQuestion = "", initialRecordId = "" }: { records: RecordOption[]; sourceCount: number; initialQuestion?: string; initialRecordId?: string }) {
  const router = useRouter();
  const [question, setQuestion] = useState(initialQuestion);
  const [recordId, setRecordId] = useState(initialRecordId);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setError(""); setWarnings([]); setResults([]);
    const response = await fetch("/api/evidence/search", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ question, farmRecordId: recordId || null }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "Search failed. Please try again later.");
    else {
      setResults(payload.data.results);
      setWarnings(payload.data.warnings || []);
      router.refresh();
    }
    setBusy(false);
  }

  return <div className="space-y-5">
    <Card>
      <form onSubmit={search} className="space-y-4">
        <div>
          <h2 className="text-2xl font-black">Search trusted websites</h2>
          <p className="text-stone-600">The agent searches only the {sourceCount} active source{sourceCount === 1 ? "" : "s"} approved by an administrator. Results are evidence candidates and never overwrite farm records.</p>
        </div>
        {error && <ErrorState message={error}/>}
        <label><span className="label">Question or claim to verify</span><textarea className="field min-h-28" required minLength={2} maxLength={500} value={question} onChange={event => setQuestion(event.target.value)} placeholder="Example: Is a higher potassium ratio appropriate for fruiting tomatoes?"/></label>
        <label><span className="label">Link to a farm record (optional)</span><select className="field" value={recordId} onChange={event => setRecordId(event.target.value)}><option value="">Do not link a record</option>{records.map(record => <option key={record.id} value={record.id}>{record.label}</option>)}</select></label>
        <Button disabled={busy || !sourceCount}><Search className="inline" size={19}/> {busy ? "Agent is searching…" : "Search for evidence"}</Button>
      </form>
    </Card>
    {warnings.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-4"><b>Some sources did not finish</b><ul className="mt-2 list-inside list-disc text-sm">{warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}
    {results.length > 0 && <section className="space-y-3"><h2 className="text-2xl font-black">Search results</h2>{results.map(result => <Card key={result.id}>
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-[#315c3b]">{result.sourceName}</p><h3 className="text-xl font-black">{result.sourceTitle || "Related webpage"}</h3></div>{result.relevanceScore != null && <span className="rounded-full bg-[#edf4e8] px-3 py-1 text-sm font-bold">Relevance {Math.round(result.relevanceScore * 100)}%</span>}</div>
      {result.sourceExcerpt && <blockquote className="mt-3 border-l-4 border-[#315c3b] pl-4 text-stone-700">{result.sourceExcerpt}</blockquote>}
      <p className="mt-3 text-sm text-amber-900">{result.summary}</p>
      {result.sourceUrl && <a className="mt-3 inline-flex items-center gap-2 font-bold text-[#315c3b] underline" href={result.sourceUrl} target="_blank" rel="noreferrer">Open original source <ExternalLink size={17}/></a>}
    </Card>)}</section>}
  </div>;
}
