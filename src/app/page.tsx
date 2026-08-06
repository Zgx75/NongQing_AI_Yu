import Link from "next/link";
import { ArrowRight, CheckCircle2, Mic, ShieldCheck, Sparkles, Sprout } from "lucide-react";

export default function Home() {
  return (
    <main>
      <section className="hero-pattern min-h-[620px] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-white/40 bg-white/10 px-4 py-2 font-bold">為臺灣小農設計的智慧農務助手</p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">把農事說出來，<br/><span className="text-[#ffd58f]">清楚記下每份用心</span></h1>
            <p className="mt-6 max-w-xl text-xl text-white/90">用文字、語音或照片快速整理農務紀錄、產銷履歷草稿與品牌故事。每一筆 AI 整理都先由你確認。</p>
            <Link className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#f2b554] px-8 font-black text-[#272016] hover:bg-[#ffd58f]" href="/login">
              立即登入<ArrowRight/>
            </Link>
          </div>
          <div className="surface text-[#20251f]">
            <div className="border-b border-stone-200 p-5">
              <p className="font-black text-[#315c3b]">快速農務紀錄</p>
              <p className="text-sm text-stone-600">步驟 1 / 3・說明今天做了什麼</p>
            </div>
            <div className="p-6">
              <div className="rounded-2xl bg-[#edf4e8] p-5 text-lg">「今天早上幫茶園澆水，大約一小時。」</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4"><b>已辨識</b><p>動作：澆水<br/>作物：茶<br/>時長：約一小時</p></div>
                <div className="rounded-xl border border-amber-400 bg-amber-50 p-4"><b>待你確認</b><p>田區、天氣、操作者</p></div>
              </div>
              <div className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#315c3b] font-bold text-white"><CheckCircle2/>確認後再儲存</div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1180px] px-5 py-16">
        <div className="text-center">
          <p className="font-black text-[#315c3b]">簡單、可信、可追溯</p>
          <h2 className="mt-2 text-3xl font-black">AI 幫忙整理，決定權永遠在農民手上</h2>
        </div>
        <div className="mt-9 grid-auto">
          {[
            [Mic, "適合手機操作", "大按鈕、語音錄製與逐步確認，中高齡使用者也能安心完成。"],
            [ShieldCheck, "事實與建議分開", "每個欄位標示來源；AI 推論和缺漏資料不會自動成為正式紀錄。"],
            [Sparkles, "一份資料多種用途", "由已確認的農務與品牌資料，產生日誌、申報草稿和社群文案。"],
            [Sprout, "農務資料自己掌握", "版本、附件、佐證和修改紀錄完整保存，可匯出 PDF 與 CSV。"],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Mic;
            return <article className="surface p-6" key={String(title)}><FeatureIcon className="mb-4 text-[#315c3b]" size={34}/><h3 className="text-xl font-black">{String(title)}</h3><p className="mt-2 text-stone-600">{String(text)}</p></article>;
          })}
        </div>
      </section>
      <footer className="bg-[#1f3225] px-5 py-8 text-center text-white/75">農情「AI」語 Nong-Qing AI Yu ・ AI 協助整理，所有正式資料皆需人工確認</footer>
    </main>
  );
}
