"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronLeft, FileText, Mic, Square, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ErrorState } from "@/components/ui/states";
import { recordedAudioToWav } from "@/lib/audio/wav";

type Source = "USER_INPUT" | "USER_PROFILE" | "OPEN_DATA" | "AI_INFERENCE" | "UNKNOWN";
type Field = { value: string | number | null; source: Source; confidence: number };
type Extracted = Record<string, unknown> & { missingFields: string[]; warnings: string[] };
type Farm = { id: string; name: string; plots: { id: string; name: string }[] };

const labels: Record<string, string> = {
  recordDate: "Work date", recordTime: "Work time", farmId: "Farm", plotId: "Plot", crop: "Crop",
  variety: "Variety", actionType: "Farm activity", purpose: "Purpose", materialName: "Material name",
  amount: "Amount", unit: "Unit", dilutionRatio: "Dilution ratio", weather: "Weather",
  duration: "Duration", notes: "Notes",
};
const internalLabels: Record<string, string> = {
  recordDate: "作業日期", recordTime: "作業時間", farmId: "農場", plotId: "田區", crop: "作物",
  variety: "品種", actionType: "農務動作", purpose: "作業目的", materialName: "資材名稱",
  amount: "使用量", unit: "使用單位", dilutionRatio: "稀釋倍數", weather: "天氣",
  duration: "作業時長", notes: "備註",
};
const sourceLabel: Record<Source, string> = {
  USER_INPUT: "User input", USER_PROFILE: "Farm profile", OPEN_DATA: "Open data",
  AI_INFERENCE: "AI inference", UNKNOWN: "Unknown",
};
function displayMissingField(value: string) {
  const key = Object.keys(internalLabels).find(item => internalLabels[item] === value);
  return labels[key || value] || value;
}

export function RecordWizard({ farms }: { farms: Farm[] }) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"text" | "voice" | "image">("text");
  const [text, setText] = useState("Watered the tea field this morning for about one hour.");
  const [farmId, setFarmId] = useState(farms[0]?.id || "");
  const [plotId, setPlotId] = useState("");
  const [data, setData] = useState<Extracted | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const recorder = useRef<MediaRecorder | null>(null);
  const recordingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chunks = useRef<Blob[]>([]);
  const plots = farms.find(farm => farm.id === farmId)?.plots || [];

  async function extract() {
    if (!text.trim()) { setError("Enter or record a farm activity first."); return; }
    setBusy(true); setError("");
    const response = await fetch("/api/ai/extract-record", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ text, farmId: farmId || undefined, plotId: plotId || undefined, today: new Date().toISOString().slice(0, 10) }),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error?.message || "AI processing failed."); setBusy(false); return; }
    const result = { ...payload.data }; delete result.meta;
    setData(result); setStep(2); setBusy(false);
  }

  function edit(key: string, value: string) {
    if (!data) return;
    const old = data[key] as Field;
    const next = { ...data, [key]: { ...old, value: value === "" ? null : key === "amount" ? Number(value) : value, source: "USER_INPUT" as Source, confidence: 1 } };
    next.missingFields = (next.missingFields || []).filter(item => item !== labels[key] && item !== internalLabels[key] && item !== key);
    setData(next);
  }

  async function startRecording() {
    if (!navigator.mediaDevices || typeof MediaRecorder === "undefined") { setError("This browser does not support audio recording. Please use text input."); return; }
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream); chunks.current = [];
      mediaRecorder.ondataavailable = event => { if (event.data.size) chunks.current.push(event.data); };
      mediaRecorder.onstop = async () => {
        if (recordingTimer.current) clearTimeout(recordingTimer.current);
        stream.getTracks().forEach(track => track.stop()); setRecording(false); setTranscribing(true);
        try {
          const blob = new Blob(chunks.current, { type: mediaRecorder.mimeType });
          const wav = await recordedAudioToWav(blob);
          const formData = new FormData(); formData.append("audio", new File([wav], "recording.wav", { type: "audio/wav" }));
          const response = await fetch("/api/transcription", { method: "POST", body: formData });
          const payload = await response.json();
          if (response.ok) setText(payload.data.correctedText || payload.data.text);
          else setError(payload.error?.message || "Transcription failed.");
        } catch { setError("Audio conversion or transcription failed. Please record again."); }
        finally { setTranscribing(false); }
      };
      mediaRecorder.start(); recorder.current = mediaRecorder;
      recordingTimer.current = setTimeout(() => { if (mediaRecorder.state === "recording") mediaRecorder.stop(); }, 60_000);
      setRecording(true);
    } catch { setError("Unable to access the microphone. Check your browser permission settings."); }
  }

  async function save() {
    if (!data) return;
    setBusy(true); setError("");
    const cleaned = {
      ...data,
      farmId: { ...(data.farmId as Field), value: farmId, source: "USER_PROFILE", confidence: 1 },
      plotId: { ...(data.plotId as Field), value: plotId || null, source: plotId ? "USER_PROFILE" : "UNKNOWN", confidence: plotId ? 1 : 0 },
    };
    cleaned.missingFields = (cleaned.missingFields || []).filter(item => !(plotId && ["Plot", "田區", "plotId"].includes(item)));
    const response = await fetch("/api/farm-records", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ farmId, plotId: plotId || null, rawInput: text, transcript: mode === "voice" ? text : null, structuredData: cleaned, content: "" }),
    });
    const payload = await response.json();
    if (!response.ok) { setError(payload.error?.message || "Unable to save the record."); setBusy(false); return; }
    for (const file of files) {
      const formData = new FormData(); formData.append("file", file); formData.append("farmRecordId", payload.data.id);
      await fetch("/api/uploads", { method: "POST", body: formData });
    }
    router.push(`/records/${payload.data.id}`); router.refresh();
  }

  return <div className="mx-auto max-w-3xl">
    <ol className="mb-6 grid grid-cols-3 gap-2" aria-label="Record creation steps">
      {["Describe work", "Review data", "Preview & save"].map((label, index) => <li key={label} className={`rounded-xl p-3 text-center text-sm font-bold ${step === index + 1 ? "bg-[#315c3b] text-white" : "bg-stone-200 text-stone-600"}`}><span className="block">Step {index + 1}</span>{label}</li>)}
    </ol>
    {error && <div className="mb-4"><ErrorState message={error}/></div>}

    {step === 1 && <Card>
      <h2 className="text-2xl font-black">What did you do today?</h2><p className="mb-5 text-stone-600">Type, record your voice, or attach field photos.</p>
      <div className="mb-5 grid grid-cols-3 gap-2">{[["text", FileText, "Text"], ["voice", Mic, "Voice"], ["image", Camera, "Photo"]].map(([value, IconType, label]) => { const Icon = IconType as typeof Mic; return <button key={String(value)} onClick={() => setMode(value as typeof mode)} className={`min-h-20 rounded-xl border-2 p-2 font-bold ${mode === value ? "border-[#315c3b] bg-[#edf4e8]" : "border-stone-300"}`}><Icon className="mx-auto mb-1"/>{String(label)}</button>; })}</div>
      <label><span className="label">Farm</span><select className="field" value={farmId} onChange={event => { setFarmId(event.target.value); setPlotId(""); }}><option value="">Select a farm</option>{farms.map(farm => <option value={farm.id} key={farm.id}>{farm.name}</option>)}</select></label>
      <label className="mt-4 block"><span className="label">Plot (can be confirmed later)</span><select className="field" value={plotId} onChange={event => setPlotId(event.target.value)}><option value="">Not specified</option>{plots.map(plot => <option value={plot.id} key={plot.id}>{plot.name}</option>)}</select></label>
      {mode === "voice" && <div className="mt-5 rounded-xl bg-[#edf4e8] p-5 text-center"><Button type="button" disabled={transcribing} variant={recording ? "danger" : "primary"} onClick={() => recording ? recorder.current?.stop() : void startRecording()}>{transcribing ? "Transcribing…" : recording ? <><Square className="inline"/> Stop recording</> : <><Mic className="inline"/> Start recording</>}</Button><p className="help mt-2">Each recording can be up to 60 seconds. You can edit the transcript afterward.</p></div>}
      <label className="mt-5 block"><span className="label">Farm activity or voice transcript</span><textarea className="field min-h-36" value={text} onChange={event => setText(event.target.value)} placeholder="Example: Watered the tea field this morning for about one hour."/></label>
      {mode === "image" && <div className="mt-5"><label className="label">Farm photos (JPEG, PNG, or WebP)</label><input className="field" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files || []))}/><div className="mt-2 space-y-2">{files.map((file, index) => <div className="flex items-center justify-between rounded-lg bg-stone-100 p-3" key={`${file.name}-${index}`}><span>{file.name} · {Math.ceil(file.size / 1024)} KB</span><button aria-label={`Remove ${file.name}`} onClick={() => setFiles(files.filter((_, itemIndex) => itemIndex !== index))}><Trash2/></button></div>)}</div><p className="help">Photos are stored only as record attachments. The system does not claim to diagnose pests or diseases accurately.</p></div>}
      <Button className="mt-6 w-full" disabled={busy || transcribing || !farmId} onClick={extract}>{busy ? "AI is organizing your data…" : "Next: Organize data"}</Button>
    </Card>}

    {step === 2 && data && <Card>
      <div className="mb-5"><h2 className="text-2xl font-black">Review every field</h2><p className="text-stone-600">AI inferences and unknown values shown in amber will not become official records automatically.</p></div>
      {data.warnings?.map(warning => <div key={warning} className="mb-3 rounded-xl border border-amber-400 bg-amber-50 p-3">{warning}</div>)}
      <div className="space-y-4">{Object.entries(labels).map(([key, label]) => { const field = data[key] as Field; if (!field) return null; return <label key={key} className="block rounded-xl border border-stone-300 p-4"><span className="mb-2 flex flex-wrap items-center justify-between gap-2"><b>{label}</b><Badge tone={field.source === "AI_INFERENCE" || field.source === "UNKNOWN" ? "warning" : "success"}>{sourceLabel[field.source]} · {Math.round(field.confidence * 100)}%</Badge></span>{key === "farmId" ? <select className="field" value={farmId} onChange={event => { setFarmId(event.target.value); edit(key, event.target.value); }}>{farms.map(farm => <option value={farm.id} key={farm.id}>{farm.name}</option>)}</select> : key === "plotId" ? <select className="field" value={plotId} onChange={event => { setPlotId(event.target.value); edit(key, event.target.value); }}><option value="">Needs confirmation</option>{plots.map(plot => <option value={plot.id} key={plot.id}>{plot.name}</option>)}</select> : <input className="field" value={field.value ?? ""} onChange={event => edit(key, event.target.value)} placeholder="Needs confirmation"/>}</label>; })}</div>
      {data.missingFields.length > 0 && <div className="mt-5 rounded-xl border border-amber-400 bg-amber-50 p-4"><b>Currently needs confirmation</b><p>{data.missingFields.map(displayMissingField).join(", ")}</p></div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="secondary" onClick={() => setStep(1)}><ChevronLeft className="inline"/> Edit original input</Button><Button className="flex-1" onClick={() => setStep(3)}>Next: Full preview</Button></div>
    </Card>}

    {step === 3 && data && <Card>
      <h2 className="text-2xl font-black">Preview before saving</h2><p className="mb-5 text-stone-600">This item will be saved as a draft or as needing confirmation. It will not become an official record automatically.</p>
      <div className="rounded-xl bg-[#edf4e8] p-4"><b>Original input</b><p>{text}</p></div>
      <dl className="mt-4 divide-y">{Object.entries(labels).map(([key, label]) => { const field = data[key] as Field; return field?.value != null ? <div className="grid grid-cols-[120px_1fr] gap-3 py-3" key={key}><dt className="font-bold">{label}</dt><dd>{String(field.value)} <span className="help">({sourceLabel[field.source]})</span></dd></div> : null; })}</dl>
      {data.missingFields.length > 0 && <div className="rounded-xl border border-amber-400 bg-amber-50 p-4"><b>Still needs confirmation: {data.missingFields.map(displayMissingField).join(", ")}</b></div>}
      <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row"><Button variant="secondary" onClick={() => setStep(2)}><ChevronLeft className="inline"/> Back to edit</Button><Button className="flex-1" disabled={busy} onClick={save}><Check className="inline"/> {busy ? "Saving…" : "Confirm and save draft"}</Button></div>
    </Card>}
  </div>;
}
