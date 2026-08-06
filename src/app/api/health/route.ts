import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await db.$queryRawUnsafe("SELECT 1");
    return Response.json({ status: "ok", database: "connected", aiProvider: process.env.AI_PROVIDER || "mock", storageProvider: process.env.UPLOAD_PROVIDER || "local", openDataMode: process.env.OPEN_DATA_MODE || "mock", checkedAt: new Date().toISOString() });
  } catch {
    return Response.json({ status: "error", database: "unavailable", checkedAt: new Date().toISOString() }, { status: 503 });
  }
}
