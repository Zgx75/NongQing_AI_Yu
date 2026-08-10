"use client";

import { useState } from "react";
import { Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

type BrandProfile = { brandName: string; origin: string; farmingMethod: string; philosophy: string; productFeatures: string; sustainability: string; certificationInfo: string; contactInfo: string; storyMaterials: string; tone: string };
type Farm = { id: string; name: string; primaryCrops: string[]; brandProfile?: BrandProfile | null };
type CopyResult = { title: string; body: string; callToAction: string; hashtags: string[]; usedFacts: string[]; pendingItems: string[]; disclaimer: string; meta: { promptVersion: string; provider: string; modelName: string } };
type GenerationSettings = { type: string; targetAudience: string; tone: string; length: string; styleElements: string[] };

const tones = [{ value: "樸實真誠", label: "Simple and sincere" }, { value: "溫暖故事", label: "Warm storytelling" }, { value: "專業可信", label: "Professional and trustworthy" }, { value: "年輕生活感", label: "Young lifestyle" }, { value: "送禮質感", label: "Premium gifting" }, { value: "永續環保", label: "Sustainable" }];
const contentTypes = [{ value: "品牌故事", label: "Brand story" }, { value: "商品介紹", label: "Product description" }, { value: "商品標語", label: "Product slogan" }, { value: "Facebook 貼文", label: "Facebook post" }, { value: "Instagram 貼文", label: "Instagram post" }, { value: "顧客問答", label: "Customer Q&A" }, { value: "出貨說明", label: "Shipping notice" }];
const audiences = [{ value: "家庭消費者", label: "Households" }, { value: "年輕族群", label: "Young adults" }, { value: "銀髮族", label: "Older adults" }, { value: "送禮需求", label: "Gift buyers" }, { value: "餐廳與商家", label: "Restaurants and businesses" }];
const storyElements = [{ value: "NATURAL_FARMING", label: "Natural farming" }, { value: "PESTICIDE_FREE", label: "Pesticide-free cultivation" }, { value: "THREE_GENERATIONS", label: "Three generations of family farming" }];

export function BrandStudio({ farms }: { farms: Farm[] }) {
  const [farmId, setFarmId] = useState(farms[0]?.id || "");
  const [result, setResult] = useState<CopyResult | null>(null);
  const [settings, setSettings] = useState<GenerationSettings | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const farm = farms.find(item => item.id === farmId);

  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const selectedSettings = {
      type: String(formData.get("type")), targetAudience: String(formData.get("targetAudience")),
      tone: String(formData.get("tone")), length: String(formData.get("length")),
      styleElements: formData.getAll("styleElements").map(String),
    };
    const profile = {
      brandName: formData.get("brandName"), crop: formData.get("crop"), origin: formData.get("origin"),
      farmingMethod: formData.get("farmingMethod"), philosophy: formData.get("philosophy"),
      storyMaterials: formData.get("storyMaterials"), familyHistory: "", sustainability: formData.get("sustainability"),
      productFeatures: formData.get("productFeatures"), certificationInfo: formData.get("certificationInfo"),
      contactInfo: formData.get("contactInfo"), tone: formData.get("tone"),
    };
    const saveResponse = await fetch("/api/brand-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ farmId, ...profile }) });
    if (!saveResponse.ok) { const payload = await saveResponse.json(); setError(payload.error?.message || "Unable to save the brand profile."); setBusy(false); return; }
    const response = await fetch("/api/ai/generate-brand-copy", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ profile, ...selectedSettings, styleElementsConfirmed: formData.get("styleElementsConfirmed") === "on" }),
    });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "Unable to generate brand copy.");
    else { setResult(payload.data); setSettings(selectedSettings); }
    setBusy(false);
  }

  async function saveCopy() {
    if (!result || !settings) return;
    const response = await fetch("/api/generated-content", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ farmId, type: settings.type, targetAudience: settings.targetAudience, tone: settings.tone, length: settings.length, sourceData: { facts: result.usedFacts, styleElements: settings.styleElements, framework: "McCarthy Marketing Mix" }, title: result.title, body: result.body, callToAction: result.callToAction, hashtags: result.hashtags, modelName: result.meta.modelName }),
    });
    if (response.ok) alert("Copy draft saved."); else setError("Unable to save the copy draft.");
  }

  const fields: Array<[keyof BrandProfile, string]> = [["brandName", "Brand name"], ["origin", "Place of origin"], ["farmingMethod", "Farming method"], ["philosophy", "Business philosophy"], ["productFeatures", "Product features"], ["sustainability", "Sustainability practices"], ["certificationInfo", "Certifications"], ["contactInfo", "Contact information"]];
  return <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
    {error && <div className="lg:col-span-2"><ErrorState message={error}/></div>}
    <Card><h2 className="mb-2 text-2xl font-black">Marketing Mix brand settings</h2><p className="mb-5 text-stone-600">Product defines verified brand facts; Promotion and Place define how the draft reaches its audience.</p>
      <form key={farmId} action={submit} className="space-y-4">
        <label><span className="label">Farm</span><select className="field" value={farmId} onChange={event => { setFarmId(event.target.value); setResult(null); setSettings(null); }}>{farms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <section className="rounded-xl border border-[#b9cbb9] bg-[#f3f7ef] p-4"><h3 className="text-lg font-black text-[#315c3b]">Product — verified brand facts</h3><p className="mb-4 text-sm text-stone-600">These facts support the origin–philosophy–emotional narrative.</p>
          <div className="space-y-4"><label><span className="label">Primary crop or product</span><input className="field" name="crop" defaultValue={farm?.primaryCrops.join(", ") || ""}/></label>{fields.map(([name, label]) => <label className="block" key={name}><span className="label">{label}</span><input className="field" name={name} defaultValue={farm?.brandProfile?.[name] || ""} required={name === "brandName"}/></label>)}<label className="block"><span className="label">Brand story notes</span><textarea className="field" name="storyMaterials" rows={4} defaultValue={farm?.brandProfile?.storyMaterials || ""}/></label></div>
          <fieldset className="mt-4"><legend className="label">Selectable story elements</legend><p className="mb-2 text-sm text-amber-900">Select only statements that are true and can be substantiated.</p><div className="space-y-2">{storyElements.map(item => <label className="flex gap-3 rounded-lg bg-white p-3" key={item.value}><input className="size-5" type="checkbox" name="styleElements" value={item.value}/><span>{item.label}</span></label>)}</div></fieldset>
          <label className="mt-3 flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3"><input className="size-5" type="checkbox" name="styleElementsConfirmed" required/><span className="text-sm font-bold">I confirm that any selected story elements are accurate and supported by my farm information.</span></label>
        </section>
        <section className="rounded-xl border p-4"><h3 className="text-lg font-black text-[#315c3b]">Promotion and Place — audience and channel</h3><p className="mb-4 text-sm text-stone-600">Choose promotional copy or e-commerce customer Q&A and shipping notices.</p><div className="grid gap-3 sm:grid-cols-2">
          <label><span className="label">Content type</span><select className="field" name="type">{contentTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span className="label">Target audience</span><select className="field" name="targetAudience">{audiences.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span className="label">Brand tone</span><select className="field" name="tone" defaultValue={farm?.brandProfile?.tone || "樸實真誠"}>{tones.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label><span className="label">Length</span><select className="field" name="length"><option value="短">Short</option><option value="中">Medium</option><option value="長">Long</option></select></label>
        </div></section>
        <Button className="w-full" disabled={busy || !farmId}><Sparkles className="inline"/> {busy ? "Generating…" : "Generate Marketing Mix copy draft"}</Button>
      </form>
    </Card>
    <Card><h2 className="text-2xl font-black">Copy preview</h2>{result ? <div className="mt-4">
      <p className="help">Generation: {result.meta.promptVersion} · {result.meta.provider}</p><h3 className="mt-3 text-2xl font-black">{result.title}</h3><p className="mt-3 whitespace-pre-wrap">{result.body}</p><p className="mt-4 font-bold text-[#315c3b]">{result.callToAction}</p><p className="mt-3 text-[#315c3b]">{result.hashtags.map(tag => `#${tag}`).join(" ")}</p>
      <div className="mt-5 rounded-xl bg-stone-100 p-4"><b>Verified facts used</b><ul className="list-inside list-disc">{result.usedFacts.map(fact => <li key={fact}>{fact}</li>)}</ul></div>
      {result.pendingItems.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-4">Needs confirmation: {result.pendingItems.join(", ")}</div>}
      <p className="mt-4 text-sm font-bold text-[#7c382f]">{result.disclaimer}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Button onClick={saveCopy}>Save draft</Button><Button variant="secondary" onClick={() => navigator.clipboard.writeText(`${result.title}\n\n${result.body}\n${result.callToAction}\n${result.hashtags.map(tag => `#${tag}`).join(" ")}`)}><Copy className="inline"/> Copy</Button><a className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-bold" download="brand-copy.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${result.title}\n\n${result.body}`)}`}><Download/> Plain text</a></div>
    </div> : <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-stone-600"><Sparkles className="mx-auto mb-3" size={40}/><p>Complete the Product, Promotion, and Place settings to generate copy.</p><p className="help">Unsupported organic, pesticide-free, certification, or health claims are blocked.</p></div>}</Card>
  </div>;
}
