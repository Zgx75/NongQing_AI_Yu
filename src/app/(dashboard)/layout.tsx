import { redirect } from "next/navigation"; import { getCurrentUser } from "@/lib/auth/session"; import { DashboardShell } from "@/components/layout/dashboard-shell";
export default async function Layout({children}:{children:React.ReactNode}) { const user=await getCurrentUser(); if(!user) redirect("/login"); return <DashboardShell user={user}>{children}</DashboardShell>; }
