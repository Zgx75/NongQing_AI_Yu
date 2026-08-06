import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";

if ((!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) && existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find(item => item.startsWith("DATABASE_URL="));
  if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim().replace(/^['\"]|['\"]$/g, "");
}

const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const name = process.env.TRUSTED_SOURCE_NAME?.trim();
  const inputUrl = process.env.TRUSTED_SOURCE_URL?.trim();
  const searchScope = process.env.TRUSTED_SOURCE_SCOPE === "PAGE" ? "PAGE" : "SITE";
  if (!email || !name || !inputUrl) throw new Error("請設定 ADMIN_EMAIL、TRUSTED_SOURCE_NAME 與 TRUSTED_SOURCE_URL。");
  const parsed = new URL(inputUrl);
  if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("可信來源必須使用 http 或 https。");
  parsed.hash = "";
  const url = parsed.toString();
  const admin = await db.user.findUnique({ where: { email } });
  if (!admin || admin.role !== "ADMIN") throw new Error("找不到指定的管理員帳號。");
  const existing = await db.trustedWebSource.findUnique({ where: { url } });
  const source = existing
    ? await db.trustedWebSource.update({ where: { id: existing.id }, data: { name, domain: parsed.hostname.toLowerCase(), searchScope, isActive: true } })
    : await db.trustedWebSource.create({ data: { name, url, domain: parsed.hostname.toLowerCase(), description: "農業知識入口網的農業知識庫", searchScope, isActive: true, createdById: admin.id } });
  await db.auditLog.create({ data: { userId: admin.id, action: existing ? "UPDATE" : "CREATE", entityType: "TrustedWebSource", entityId: source.id, beforeJson: existing ? JSON.stringify(existing) : undefined, afterJson: JSON.stringify(source) } });
  console.log(JSON.stringify({ id: source.id, name: source.name, url: source.url, searchScope: source.searchScope, isActive: source.isActive }));
}

main().finally(() => db.$disconnect());
