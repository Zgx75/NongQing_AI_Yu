import { PrismaClient } from "@prisma/client";
import { existsSync, readFileSync } from "node:fs";

if ((!process.env.DATABASE_URL || process.env.DATABASE_URL.startsWith("file:")) && existsSync(".env.local")) {
  const line = readFileSync(".env.local", "utf8").split(/\r?\n/).find((item) => item.startsWith("DATABASE_URL="));
  if (line) process.env.DATABASE_URL = line.slice("DATABASE_URL=".length).trim().replace(/^['\"]|['\"]$/g, "");
}
const db = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("請先設定 ADMIN_EMAIL。此指令不會建立新帳號，使用者必須先在網站註冊。");
  const user = await db.user.findUnique({ where: { email } });
  if (!user) throw new Error("找不到此 Email 的帳號，請先在正式網站完成註冊。");
  if (user.role === "ADMIN") { console.log("此帳號已經是管理員。"); return; }
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } }),
    db.auditLog.create({ data: { action: "PROMOTE_ADMIN", entityType: "User", entityId: user.id, beforeJson: JSON.stringify({ role: user.role }), afterJson: JSON.stringify({ role: "ADMIN" }) } }),
  ]);
  await db.session.deleteMany({ where: { userId: user.id } });
  console.log("帳號已升級為 ADMIN；既有登入工作階段已登出，請重新登入。");
}

main().finally(() => db.$disconnect());
