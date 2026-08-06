import { cookies } from "next/headers";
import { randomBytes, createHmac } from "node:crypto";
import { db } from "@/lib/db";

const COOKIE = "nongqing_session";
const DAYS = 14;

function digest(token: string) { const secret = process.env.SESSION_SECRET; if (!secret) throw new Error("SESSION_SECRET is required"); return createHmac("sha256", secret).update(token).digest("hex"); }

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + DAYS * 86400_000);
  await db.session.create({ data: { id: digest(token), userId, expiresAt } });
  const jar = await cookies();
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", expires: expiresAt, path: "/" });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: digest(token) } });
  jar.set(COOKIE, "", { httpOnly: true, sameSite: "lax", expires: new Date(0), path: "/" });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({ where: { id: digest(token) }, include: { user: true } });
  if (!session || session.expiresAt <= new Date()) return null;
  return { id: session.user.id, name: session.user.name, email: session.user.email, role: session.user.role };
}
