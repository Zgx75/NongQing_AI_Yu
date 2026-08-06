import { AlertTriangle, Inbox } from "lucide-react";
export function EmptyState({ title, message }: { title: string; message: string }) { return <div className="rounded-2xl border border-dashed border-stone-400 p-8 text-center"><Inbox className="mx-auto mb-3 text-[#315c3b]" size={38}/><h3 className="text-xl font-bold">{title}</h3><p className="text-stone-600">{message}</p></div>; }
export function ErrorState({ message }: { message: string }) { return <div role="alert" className="flex gap-3 rounded-xl border border-red-300 bg-red-50 p-4 text-red-900"><AlertTriangle/><span>{message}</span></div>; }
export function LoadingCards() { return <div className="grid-auto" aria-label="資料載入中">{[1,2,3].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-stone-200" />)}</div>; }
