import type { Metadata } from "next"; import "./globals.css";
export const metadata: Metadata = { title: "NongQing AI Yu", description: "A smart farm record and brand content assistant for Taiwan's small farms" };
export default function RootLayout({children}:{children:React.ReactNode}) { return <html lang="en"><body>{children}</body></html>; }
