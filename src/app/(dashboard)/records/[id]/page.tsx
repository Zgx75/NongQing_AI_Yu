import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RecordDetailActions } from "@/components/records/record-detail-actions";

const labels: Record<string, string> = {
  recordDate: "Date", recordTime: "Time", crop: "Crop", variety: "Variety", actionType: "Activity",
  purpose: "Purpose", materialName: "Material", amount: "Amount", unit: "Unit",
  dilutionRatio: "Dilution ratio", weather: "Weather", duration: "Duration", notes: "Notes",
};
const missingFieldLabels: Record<string, string> = {
  日期: "Date", 作業日期: "Date", 時間: "Time", 作業時間: "Time", 作物: "Crop", 品種: "Variety",
  作業項目: "Activity", 農務動作: "Activity", 作業目的: "Purpose", 使用資材: "Material",
  資材名稱: "Material", 使用量: "Amount", 單位: "Unit", 使用單位: "Unit",
  稀釋倍數: "Dilution ratio", 天氣: "Weather", 作業時長: "Duration", 備註: "Notes", 田區: "Plot",
};
const sourceLabels: Record<string, string> = {
  USER_INPUT: "User input", USER_PROFILE: "Farm profile", OPEN_DATA: "Open data",
  AI_INFERENCE: "AI inference", UNKNOWN: "Unknown",
};

export default async function RecordPage({ params }: { params: Promise<{ id: string }> }) {
  const user = (await getCurrentUser())!;
  const record = await db.farmRecord.findUnique({
    where: { id: (await params).id },
    include: { farm: { include: { members: true } }, plot: true, creator: true, attachments: true, evidence: true, versions: { orderBy: { version: "desc" } } },
  });
  if (!record || (user.role !== "ADMIN" && record.farm.ownerId !== user.id && !record.farm.members.some(member => member.userId === user.id))) notFound();
  const data = JSON.parse(record.structuredDataJson) as Record<string, unknown> & { missingFields: string[] };
  const canConfirm = user.role === "ADMIN" || record.farm.ownerId === user.id || record.farm.members.some(member => member.userId === user.id && member.permission === "CONFIRM");
  const evidenceUrl = `/evidence?recordId=${record.id}&q=${encodeURIComponent(`${record.actionType || "farm activity"} ${record.rawInput}`)}`;
  const status = record.status === "CONFIRMED" ? "Confirmed record" : record.status === "DRAFT" ? "Draft" : "Needs confirmation";

  return <div className="page-shell">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3"><div><p className="font-bold text-[#315c3b]">Farm log preview</p><h1 className="text-3xl font-black">{record.actionType || "Farm record awaiting confirmation"}</h1><p>{record.farm.name} · {record.plot?.name || "Plot not confirmed"}</p></div><Badge tone={record.status === "CONFIRMED" ? "success" : "warning"}>{status}</Badge></div>
    <div className="mb-6"><RecordDetailActions id={record.id} data={data} canConfirm={canConfirm && record.status !== "CONFIRMED"}/></div>
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <Card><h2 className="mb-4 text-2xl font-black">Farm activity</h2><div className="mb-4 rounded-xl bg-[#edf4e8] p-4"><b>Farmer&apos;s original input</b><p>{record.rawInput}</p></div><dl className="divide-y">{Object.entries(labels).map(([key, label]) => { const field = data[key] as { value: unknown; source: string; confidence: number } | undefined; return <div className="grid grid-cols-[110px_1fr] gap-3 py-3" key={key}><dt className="font-bold">{label}</dt><dd>{field?.value == null ? <span className="text-amber-800">Needs confirmation</span> : String(field.value)} {field && <span className="help">· {sourceLabels[field.source] || field.source}</span>}</dd></div>; })}</dl>{record.content && <div className="mt-5 whitespace-pre-wrap rounded-xl border p-4">{record.content}</div>}</Card>
      <div className="space-y-6">
        <Card><h2 className="text-xl font-black">Items to confirm</h2>{data.missingFields?.length ? <ul className="mt-3 list-inside list-disc text-amber-900">{data.missingFields.map(item => <li key={item}>{missingFieldLabels[item] || labels[item] || item}</li>)}</ul> : <p className="mt-2 text-green-800">No missing fields</p>}</Card>
        <Card><h2 className="text-xl font-black">Attachments</h2>{record.attachments.length ? <ul>{record.attachments.map(attachment => <li key={attachment.id}>{attachment.fileName} ({Math.ceil(attachment.fileSize / 1024)} KB)</li>)}</ul> : <p className="text-stone-600">No attachments</p>}</Card>
        <Card><h2 className="text-xl font-black">Web evidence</h2><Link className="mt-3 inline-block rounded-xl bg-[#315c3b] px-4 py-3 font-bold text-white" href={evidenceUrl}>Search trusted websites</Link>{record.evidence.length ? record.evidence.map(evidence => <div key={evidence.id} className="mt-3 rounded-xl bg-stone-100 p-3"><b>{evidence.sourceName}</b><p>{evidence.summary}</p>{evidence.sourceUrl && <a className="font-bold text-[#315c3b] underline" href={evidence.sourceUrl} target="_blank" rel="noreferrer">Open original source</a>}<small className="block">{evidence.fetchedAt.toLocaleString("en-US")}</small></div>) : <p className="mt-3 text-stone-600">No web evidence has been retrieved. You can still use this draft.</p>}</Card>
        <Card><h2 className="text-xl font-black">Version information</h2><p>{record.versions.length} version{record.versions.length === 1 ? "" : "s"}</p><p className="help">Created by {record.creator.name} · {record.createdAt.toLocaleString("en-US")}</p></Card>
      </div>
    </div>
    <p className="mt-6 rounded-xl bg-amber-50 p-4 text-center font-bold">This content was organized with AI assistance and must be reviewed by the farmer or an authorized person before use.</p>
  </div>;
}
