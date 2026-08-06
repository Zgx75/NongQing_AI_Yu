import type { ReactNode } from "react"; import { clsx } from "clsx";
export function Card({ children, className }: { children: ReactNode; className?: string }) { return <section className={clsx("surface p-5 md:p-6", className)}>{children}</section>; }
