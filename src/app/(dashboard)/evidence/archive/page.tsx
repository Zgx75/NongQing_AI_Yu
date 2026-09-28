import { notFound } from "next/navigation";
import { officialArchiveByUrl, officialArchiveDigest } from "@/lib/evidence/official-archive";

export default async function OfficialArchivePage({ searchParams }: { searchParams: Promise<{ url?: string }> }) {
  const url = (await searchParams).url;
  const snapshot = url ? officialArchiveByUrl(url) : undefined;
  if (!snapshot) notFound();
  const captured = new Date(snapshot.retrieved_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
  return <main className="page-shell mx-auto max-w-4xl space-y-5">
    <header className="surface space-y-3 p-5">
      <p className="text-sm font-bold text-amber-800">農業部網站內容封存摘錄</p>
      <h1 className="text-2xl font-black">{snapshot.title}</h1>
      <p className="text-sm text-stone-700">擷取時間：{captured}（臺灣時間）。擷取方式：{snapshot.capture === "official search index excerpt" ? "官方搜尋索引摘錄" : snapshot.capture === "official article excerpt" ? "官方文章摘錄" : "官方文章網頁"}。這份內容供查核引用；現行資訊請以原始網站為準。</p>
      <a href={snapshot.url} target="_blank" rel="noreferrer" className="break-all font-bold text-[#315c3b] underline">開啟原始頁面：{snapshot.url}</a>
      <p className="break-all text-xs text-stone-500">內容 SHA-256：{officialArchiveDigest(snapshot)}</p>
    </header>
    <article className="surface space-y-4 p-5">
      {snapshot.blocks.map((block, index) => <p key={`${index}-${block.slice(0, 12)}`} className="whitespace-pre-wrap leading-relaxed text-stone-800">{block}</p>)}
    </article>
  </main>;
}
