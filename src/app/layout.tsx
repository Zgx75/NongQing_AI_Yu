import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata = { title: "農情「AI」語", description: "臺灣小農的智慧農務紀錄與品牌內容助手" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="zh-Hant"><body>{children}</body></html>; }
