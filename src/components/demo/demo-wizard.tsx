"use client";
import { useState } from "react";
import { CheckCircle2, ChevronLeft, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
const initial = [
  { key: "date", label: "Date", value: "Today", source: "User input" },
  { key: "time", label: "Time", value: "Morning", source: "User input" },
  { key: "farm", label: "Farm", value: "Nantou Green Mountain Tea Farm (demo)", source: "Demo data" },
  { key: "plot", label: "Plot", value: "", source: "Unknown" },
  { key: "crop", label: "Crop", value: "Tea", source: "User input" },
  { key: "action", label: "Activity", value: "Watering", source: "User input" },
  { key: "duration", label: "Duration", value: "About one hour", source: "User input" },
  { key: "weather", label: "Weather", value: "", source: "Unknown" },
  { key: "operator", label: "Operator", value: "", source: "Unknown" },
  { key: "water", label: "Water amount", value: "", source: "Unknown" },
];
export function DemoWizard() {
  const [step, setStep] = useState(1); const [text, setText] = useState("Watered the tea field this morning for about one hour."); const [fields, setFields] = useState(initial); const [done, setDone] = useState(false);
  function edit(index: number, value: string) { setFields(fields.map((field, itemIndex) => itemIndex === index ? { ...field, value, source: "User confirmed" } : field)); }
  return <div className="mx-auto max-w-3xl"><div className="mb-5 rounded-xl border border-amber-500 bg-amber-50 p-4 font-bold">Demo mode: Data stays only on this page and no sensitive information is saved. AI provider: mock.</div><ol className="mb-5 grid grid-cols-3 gap-2">{["Input", "Review", "Generate log"].map((label, index) => <li key={label} className={`rounded-xl p-3 text-center font-bold ${step === index + 1 ? "bg-[#315c3b] text-white" : "bg-stone-200"}`}>{index + 1}. {label}</li>)}</ol><section className="surface p-6">
    {step === 1 && <><h2 className="text-2xl font-black">Quick farm activity input</h2><p className="mb-4">Edit this sentence, then let the mock AI organize it.</p><textarea className="field min-h-36" value={text} onChange={event => setText(event.target.value)}/><p className="help mt-2">The demo recognizes only its preset scenario. Sign in to use the complete provider workflow.</p><Button className="mt-5 w-full" onClick={() => setStep(2)}><Sparkles className="inline"/> Organize with AI</Button></>}
    {step === 2 && <><h2 className="text-2xl font-black">Review extracted data</h2><p className="mb-5">Unknown fields remain marked as “Needs confirmation.” The system does not invent an exact plot, water amount, equipment, weather, or outcome.</p><div className="space-y-3">{fields.map((field, index) => <label className="block rounded-xl border p-4" key={field.key}><span className="flex items-center justify-between"><b>{field.label}</b><Badge tone={field.value ? "success" : "warning"}>{field.source}</Badge></span><input className="field mt-2" value={field.value} onChange={event => edit(index, event.target.value)} placeholder="Needs confirmation (you can add it in the demo)"/></label>)}</div><div className="mt-5 flex gap-3"><Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft className="inline"/>Previous</Button><Button className="flex-1" onClick={() => setStep(3)}>Generate log draft</Button></div></>}
    {step === 3 && <><h2 className="text-2xl font-black">Farm log draft</h2><p className="mt-4 rounded-xl bg-[#edf4e8] p-5">The tea field at Nantou Green Mountain Tea Farm was watered today for about one hour. {fields.find(field => field.key === "weather")?.value || "Weather data is not available."}</p><div className="mt-4 rounded-xl border border-amber-400 bg-amber-50 p-4"><b>Items to confirm</b><p>{fields.filter(field => !field.value).map(field => field.label).join(", ") || "None"}</p></div><p className="mt-4 font-bold text-[#7c382f]">This content was organized with AI assistance and requires human review. This is a demo draft, not an official record.</p>{done ? <p className="mt-5 flex items-center gap-2 rounded-xl bg-green-50 p-4 font-bold text-green-900"><CheckCircle2/>Demo review complete (not saved to the database)</p> : <div className="mt-5 flex gap-3"><Button variant="secondary" onClick={() => setStep(2)}>Back to edit</Button><Button className="flex-1" onClick={() => setDone(true)}>Confirm demo record</Button></div>}</>}
  </section></div>;
}
