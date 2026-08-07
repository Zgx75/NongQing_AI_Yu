import { AppError } from "@/lib/api";

type Hit = { count: number; resetAt: number };
const hits = new Map<string, Hit>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000) {
  const now = Date.now();
  const hit = hits.get(key);
  if (!hit || hit.resetAt <= now) { hits.set(key, { count: 1, resetAt: now + windowMs }); return; }
  hit.count++;
  if (hit.count > limit) throw new AppError("RATE_LIMITED", "Too many requests. Please try again later.", 429);
}
