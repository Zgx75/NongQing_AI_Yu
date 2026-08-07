"use client";

import { useState } from "react";
import { Copy, Download, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";

type Farm = { id: string; name: string; brandProfile?: Record<string, string> | null };
type CopyResult = { title: string; body: string; callToAction: string; hashtags: string[]; usedFacts: string[]; pendingItems: string[]; disclaimer: string; meta: { promptVersion: string; provider: string; modelName: string } };
const tones = [{ value: "樸實真誠", label: "Simple and sincere" }, { value: "溫暖故事", label: "Warm storytelling" }, { value: "專業可信", label: "Professional and trustworthy" }, { value: "年輕生活感", label: "Young lifestyle" }, { value: "送禮質感", label: "Premium gifting" }, { value: "永續環保", label: "Sustainable" }];
const contentTypes = [{ value: "品牌故事", label: "Brand story" }, { value: "商品介紹", label: "Product description" }, { value: "商品標語", label: "Product slogan" }, { value: "Facebook 貼文", label: "Facebook post" }, { value: "Instagram 貼文", label: "Instagram post" }, { value: "顧客問答", label: "Customer Q&A" }, { value: "出貨說明", label: "Shipping note" }];
const audiences = [{ value: "家庭消費者", label: "Households" }, { value: "年輕族群", label: "Young adults" }, { value: "銀髮族", label: "Older adults" }, { value: "送禮需求", label: "Gift buyers" }, { value: "餐廳與商家", label: "Restaurants and businesses" }];

export function BrandStudio({ farms }: { farms: Farm[] }) {
  const [farmId, setFarmId] = useState(farms[0]?.id || "");
  const [result, setResult] = useState<CopyResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const farm = farms.find(item => item.id === farmId);

  async function submit(formData: FormData) {
    setBusy(true); setError("");
    const profile = { brandName: formData.get("brandName"), origin: formData.get("origin"), farmingMethod: formData.get("farmingMethod"), philosophy: formData.get("philosophy"), storyMaterials: formData.get("storyMaterials"), familyHistory: "", sustainability: formData.get("sustainability"), productFeatures: formData.get("productFeatures"), certificationInfo: formData.get("certificationInfo"), contactInfo: formData.get("contactInfo"), tone: formData.get("tone") };
    const saveResponse = await fetch("/api/brand-profile", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ farmId, ...profile }) });
    if (!saveResponse.ok) { const payload = await saveResponse.json(); setError(payload.error?.message || "Unable to save the brand profile."); setBusy(false); return; }
    const response = await fetch("/api/ai/generate-brand-copy", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ profile, type: formData.get("type"), targetAudience: formData.get("audience"), tone: formData.get("tone"), length: formData.get("length") }) });
    const payload = await response.json();
    if (!response.ok) setError(payload.error?.message || "Unable to generate brand copy."); else setResult(payload.data);
    setBusy(false);
  }

  async function saveCopy() {
    if (!result) return;
    const type = (document.querySelector('[name="type"]') as HTMLSelectElement)?.value || "品牌故事";
    const response = await fetch("/api/generated-content", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ farmId, type, targetAudience: "消費者", tone: "樸實真誠", length: "中", sourceData: { facts: result.usedFacts }, title: result.title, body: result.body, callToAction: result.callToAction, hashtags: result.hashtags, modelName: result.meta.modelName }) });
    if (response.ok) alert("Copy draft saved."); else setError("Unable to save the copy draft.");
  }

  const fields = [["brandName", "Brand name"], ["origin", "Place of origin"], ["farmingMethod", "Farming method"], ["philosophy", "Business philosophy"], ["productFeatures", "Product features"], ["sustainability", "Sustainability practices"], ["certificationInfo", "Certifications"], ["contactInfo", "Contact information"]];
  return <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
    {error && <div className="lg:col-span-2"><ErrorState message={error}/></div>}
    <Card><h2 className="mb-4 text-2xl font-black">Brand profile and generation settings</h2><form action={submit} className="space-y-4">
      <label><span className="label">Farm</span><select className="field" value={farmId} onChange={event => { setFarmId(event.target.value); setResult(null); }}>{farms.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {fields.map(([name, label]) => <label key={name}><span className="label">{label}</span><input className="field" name={name} defaultValue={farm?.brandProfile?.[name] || ""} required={name === "brandName"}/></label>)}
      <label><span className="label">Brand story notes</span><textarea className="field" name="storyMaterials" rows={4} defaultValue={farm?.brandProfile?.storyMaterials || ""}/></label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label><span className="label">Content type</span><select className="field" name="type">{contentTypes.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="label">Target audience</span><select className="field" name="audience">{audiences.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="label">Brand tone</span><select className="field" name="tone" defaultValue={farm?.brandProfile?.tone || "樸實真誠"}>{tones.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
        <label><span className="label">Length</span><select className="field" name="length"><option value="短">Short</option><option value="中">Medium</option><option value="長">Long</option></select></label>
      </div>
      <Button className="w-full" disabled={busy || !farmId}><Sparkles className="inline"/> {busy ? "Generating…" : "Generate brand copy draft"}</Button>
    </form></Card>
    <Card><h2 className="text-2xl font-black">Copy preview</h2>{result ? <div className="mt-4">
      <p className="help">Generation: {result.meta.promptVersion} · {result.meta.provider}</p><h3 className="mt-3 text-2xl font-black">{result.title}</h3><p className="mt-3 whitespace-pre-wrap">{result.body}</p><p className="mt-4 font-bold text-[#315c3b]">{result.callToAction}</p><p className="mt-3 text-[#315c3b]">{result.hashtags.map(tag => `#${tag}`).join(" ")}</p>
      <div className="mt-5 rounded-xl bg-stone-100 p-4"><b>Facts used</b><ul className="list-inside list-disc">{result.usedFacts.map(fact => <li key={fact}>{fact}</li>)}</ul></div>
      {result.pendingItems.length > 0 && <div className="mt-3 rounded-xl bg-amber-50 p-4">Needs confirmation: {result.pendingItems.join(", ")}</div>}
      <p className="mt-4 text-sm font-bold text-[#7c382f]">{result.disclaimer}</p>
      <div className="mt-5 flex flex-wrap gap-3"><Button onClick={saveCopy}>Save draft</Button><Button variant="secondary" onClick={() => navigator.clipboard.writeText(`${result.title}\n\n${result.body}\n${result.callToAction}\n${result.hashtags.map(tag => `#${tag}`).join(" ")}`)}><Copy className="inline"/> Copy</Button><a className="inline-flex min-h-12 items-center gap-2 rounded-xl px-4 font-bold" download="brand-copy.txt" href={`data:text/plain;charset=utf-8,${encodeURIComponent(`${result.title}\n\n${result.body}`)}`}><Download/> Plain text</a></div>
    </div> : <div className="mt-6 rounded-xl border border-dashed p-10 text-center text-stone-600"><Sparkles className="mx-auto mb-3" size={40}/><p>Complete the profile to generate copy.</p><p className="help">The system will not make unsupported organic, pesticide-free, or health claims.</p></div>}</Card>
  </div>;
}
