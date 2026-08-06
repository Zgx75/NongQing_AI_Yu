import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { AdminConsole } from "@/components/admin/admin-console";
import { EvidenceSourceManager } from "@/components/admin/evidence-source-manager";

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (user?.role !== "ADMIN") redirect("/dashboard");
  const [users, prompts, terms, logs, audits, sources] = await Promise.all([
    db.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true }, orderBy: { createdAt: "desc" } }),
    db.promptTemplate.findMany({ orderBy: [{ key: "asc" }, { version: "desc" }] }),
    db.agriculturalTerm.findMany({ include: { crop: true } }),
    db.aIRequestLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    db.trustedWebSource.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] }),
  ]);
  return <div className="page-shell">
    <h1 className="text-3xl font-black md:text-4xl">管理後台</h1><p className="mb-6 text-stone-600">管理可信網站、農業詞彙、提示詞版本、使用者與稽核紀錄。</p>
    <div className="grid gap-6">
      <Card><h2 className="mb-2 text-2xl font-black">可信網站來源</h2><p className="mb-5 text-stone-600">資料佐證代理只會搜尋此處啟用的網頁或網域。</p><EvidenceSourceManager sources={sources}/></Card>
      <Card><h2 className="mb-4 text-2xl font-black">農業詞彙管理</h2><AdminConsole/><div className="mt-5 overflow-x-auto"><table className="w-full text-left"><thead><tr><th>錯誤詞</th><th>正確詞</th><th>分類</th><th>狀態</th></tr></thead><tbody>{terms.map(term => <tr className="border-t" key={term.id}><td className="py-2">{term.incorrectTerm}</td><td>{term.correctedTerm}</td><td>{term.category}</td><td>{term.isActive ? "啟用" : "停用"}</td></tr>)}</tbody></table></div></Card>
      <Card><h2 className="text-2xl font-black">使用者（{users.length}）</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-left"><thead><tr><th>姓名</th><th>Email</th><th>角色</th></tr></thead><tbody>{users.map(item => <tr className="border-t" key={item.id}><td className="py-2">{item.name}</td><td>{item.email}</td><td>{item.role}</td></tr>)}</tbody></table></div></Card>
      <Card><h2 className="text-2xl font-black">提示詞版本（{prompts.length}）</h2>{prompts.map(prompt => <div className="mt-3 rounded-xl bg-stone-100 p-4" key={prompt.id}><b>{prompt.name}・v{prompt.version}</b><p className="help">{prompt.key}・{prompt.isActive ? "啟用中" : "已停用"}</p></div>)}</Card>
      <Card><h2 className="text-2xl font-black">AI 呼叫紀錄</h2>{logs.length ? logs.map(log => <div className="grid gap-1 border-b py-2 text-sm md:grid-cols-3" key={log.id}><span>{log.requestType}</span><span>{log.provider} / {log.modelName}</span><span>{log.status}・{log.createdAt.toLocaleString("zh-TW")}</span></div>) : <p>尚無資料</p>}</Card>
      <Card><h2 className="text-2xl font-black">稽核紀錄</h2>{audits.map(item => <div className="grid gap-1 border-b py-2 text-sm md:grid-cols-3" key={item.id}><span>{item.action}</span><span>{item.entityType}</span><span>{item.createdAt.toLocaleString("zh-TW")}</span></div>)}</Card>
    </div>
  </div>;
}
