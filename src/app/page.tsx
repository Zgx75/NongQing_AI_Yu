import Link from "next/link";
import { ArrowRight, CheckCircle2, Mic, ShieldCheck, Sparkles, Sprout } from "lucide-react";

export default function Home() {
  return (
    <main>
      <section className="hero-pattern min-h-[620px] text-white">
        <div className="mx-auto grid max-w-[1180px] gap-10 px-5 py-16 md:grid-cols-2 md:items-center md:py-24">
          <div>
            <p className="mb-4 inline-flex rounded-full border border-white/40 bg-white/10 px-4 py-2 font-bold">A smart farm assistant built for Taiwan&apos;s small farms</p>
            <h1 className="text-4xl font-black leading-tight md:text-6xl">Tell us what happened,<br/><span className="text-[#ffd58f]">and preserve every detail</span></h1>
            <p className="mt-6 max-w-xl text-xl text-white/90">Use text, voice, or photos to organize farm records, traceability drafts, and brand stories. You review every AI-assisted result first.</p>
            <Link className="mt-8 inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#f2b554] px-8 font-black text-[#272016] hover:bg-[#ffd58f]" href="/login">
              Log in now<ArrowRight/>
            </Link>
          </div>
          <div className="surface text-[#20251f]">
            <div className="border-b border-stone-200 p-5">
              <p className="font-black text-[#315c3b]">Quick farm record</p>
              <p className="text-sm text-stone-600">Step 1 of 3 · Describe today&apos;s work</p>
            </div>
            <div className="p-6">
              <div className="rounded-2xl bg-[#edf4e8] p-5 text-lg">“I watered the tea field for about an hour this morning.”</div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border p-4"><b>Recognized</b><p>Action: Watering<br/>Crop: Tea<br/>Duration: About 1 hour</p></div>
                <div className="rounded-xl border border-amber-400 bg-amber-50 p-4"><b>Needs your review</b><p>Plot, weather, operator</p></div>
              </div>
              <div className="mt-5 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#315c3b] font-bold text-white"><CheckCircle2/>Review before saving</div>
            </div>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1180px] px-5 py-16">
        <div className="text-center">
          <p className="font-black text-[#315c3b]">Simple, trustworthy, and traceable</p>
          <h2 className="mt-2 text-3xl font-black">AI organizes the details. Farmers stay in control.</h2>
        </div>
        <div className="mt-9 grid-auto">
          {[
            [Mic, "Made for mobile use", "Large controls, voice recording, and step-by-step review make field entry easy for everyone."],
            [ShieldCheck, "Facts stay separate from suggestions", "Every field shows its source. AI inferences and missing details never become official records automatically."],
            [Sparkles, "One dataset, many uses", "Turn confirmed farm and brand data into journals, submission drafts, and social content."],
            [Sprout, "Your farm data stays yours", "Keep versions, attachments, evidence, and edit history together, with PDF and CSV exports."],
          ].map(([Icon, title, text]) => {
            const FeatureIcon = Icon as typeof Mic;
            return <article className="surface p-6" key={String(title)}><FeatureIcon className="mb-4 text-[#315c3b]" size={34}/><h3 className="text-xl font-black">{String(title)}</h3><p className="mt-2 text-stone-600">{String(text)}</p></article>;
          })}
        </div>
      </section>
      <footer className="bg-[#1f3225] px-5 py-8 text-center text-white/75">NongQing AI Yu · AI-assisted content must be reviewed before it becomes an official record</footer>
    </main>
  );
}
