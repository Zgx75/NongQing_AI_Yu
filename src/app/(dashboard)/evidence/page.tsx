import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { EvidenceSearchPanel } from "@/components/evidence/evidence-search-panel";

export default async function EvidencePage({ searchParams }: { searchParams: Promise<{ q?: string; recordId?: string }> }) {
  const user = (await getCurrentUser())!;
  const params = await searchParams;
  const farmAccess = { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] };
  const [list, records, sourceCount] = await Promise.all([
    db.evidenceSnapshot.findMany({
      where: user.role === "ADMIN" ? {} : { OR: [{ createdById: user.id }, { farmRecord: { farm: farmAccess } }] },
      include: { farmRecord: { include: { farm: true, plot: true } }, webSource: true },
      orderBy: { fetchedAt: "desc" }, take: 100,
    }),
    db.farmRecord.findMany({ where: { farm: user.role === "ADMIN" ? {} : farmAccess }, include: { farm: true }, orderBy: { createdAt: "desc" }, take: 100 }),
    db.trustedWebSource.count({ where: { isActive: true } }),
  ]);
  const recordOptions = records.map(record => ({ id: record.id, label: `${record.farm.name}・${record.actionType || record.rawInput.slice(0, 30)}` }));
  return <div className="page-shell space-y-6">
    <div><h1 className="text-3xl font-black md:text-4xl">網頁資料佐證</h1><p className="text-stone-600">由搜尋代理從管理員核准的網站尋找相關段落，保留網址與快照供人工核對。</p></div>
    <EvidenceSearchPanel records={recordOptions} sourceCount={sourceCount} initialQuestion={params.q || ""} initialRecordId={params.recordId || ""}/>
    <section><h2 className="mb-4 text-2xl font-black">歷史佐證</h2>{list.length ? <div className="space-y-4">{list.map(item => <Card key={item.id}>
      <div className="flex flex-wrap justify-between gap-3"><div><p className="font-bold text-[#315c3b]">{item.sourceName}</p><h3 className="text-xl font-black">{item.sourceTitle || item.summary}</h3><p className="text-stone-600">{item.farmRecord ? `${item.farmRecord.farm.name}・${item.farmRecord.plot?.name || "田區待確認"}` : "獨立查證"}</p></div><Badge tone={item.status === "SUCCESS" ? "success" : item.status === "FAILED" ? "danger" : "warning"}>{item.status === "SUCCESS" ? "找到候選" : item.status === "NOT_AVAILABLE" ? "未找到" : item.status}</Badge></div>
      {item.sourceExcerpt && <blockquote className="mt-3 border-l-4 border-[#315c3b] pl-4 text-stone-700">{item.sourceExcerpt}</blockquote>}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-sm"><span>搜尋時間：{item.fetchedAt.toLocaleString("zh-TW")}</span><span>Provider：{item.provider}</span>{item.relevanceScore != null && <span>相關度：{Math.round(item.relevanceScore * 100)}%</span>}</div>
      {item.sourceUrl && <a className="mt-3 inline-block break-all font-bold text-[#315c3b] underline" href={item.sourceUrl} target="_blank" rel="noreferrer">開啟原始資料</a>}
      {item.errorMessage && <p className="mt-3 rounded-xl bg-red-50 p-3 text-red-900">{item.errorMessage}</p>}
    </Card>)}</div> : <EmptyState title="尚無網頁佐證" message="輸入問題後，搜尋代理會將相關來源保存在這裡。"/>}</section>
  </div>;
}
