import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const baseUrl = process.env.DEPLOY_URL;
if (!baseUrl) throw new Error("DEPLOY_URL is required");
const email = `smoke-${Date.now()}@example.invalid`;

async function main() { try {
  const register = await fetch(`${baseUrl}/api/auth/register`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "線上煙霧測試", email, password: "SmokeTest-Only-9347!", role: "FARMER", consent: true }) });
  if (register.status !== 201) throw new Error(`Registration failed: ${register.status} ${await register.text()}`);
  const cookie = register.headers.getSetCookie()[0]?.split(";")[0];
  if (!cookie) throw new Error("Session cookie missing");
  const farms = await fetch(`${baseUrl}/api/farms`, { headers: { cookie } });
  if (!farms.ok) throw new Error(`Authenticated API failed: ${farms.status}`);
  console.log("Production registration and authenticated API smoke test passed.");
} finally {
  const user = await db.user.findUnique({ where: { email } });
  if (user) { await db.session.deleteMany({ where: { userId: user.id } }); await db.user.delete({ where: { id: user.id } }); }
  await db.$disconnect();
} }

void main();
