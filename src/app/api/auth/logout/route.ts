import { destroySession, getCurrentUser } from "@/lib/auth/session"; import { fail, ok } from "@/lib/api"; import { audit } from "@/lib/audit";
export async function POST() { try { const user = await getCurrentUser(); await destroySession(); if (user) await audit({ userId: user.id, action: "LOGOUT", entityType: "Session" }); return ok({ loggedOut: true }); } catch (e) { return fail(e); } }
