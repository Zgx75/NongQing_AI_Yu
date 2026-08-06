import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fail, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-user";
import { audit } from "@/lib/audit";

const updateSchema = z.object({ isActive: z.boolean().optional(), name: z.string().trim().min(2).max(80).optional(), description: z.string().trim().max(500).optional(), searchScope: z.enum(["PAGE", "SITE"]).optional() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const id = (await params).id;
    const before = await db.trustedWebSource.findUnique({ where: { id } });
    if (!before) throw new AppError("NOT_FOUND", "找不到可信網站來源。", 404);
    const source = await db.trustedWebSource.update({ where: { id }, data: updateSchema.parse(await parseJson(request)) });
    await audit({ userId: user.id, action: "UPDATE", entityType: "TrustedWebSource", entityId: id, before, after: source });
    return ok(source);
  } catch (error) { return fail(error); }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireAdmin();
    const id = (await params).id;
    const before = await db.trustedWebSource.findUnique({ where: { id } });
    if (!before) throw new AppError("NOT_FOUND", "找不到可信網站來源。", 404);
    await db.trustedWebSource.delete({ where: { id } });
    await audit({ userId: user.id, action: "DELETE", entityType: "TrustedWebSource", entityId: id, before });
    return ok({ id });
  } catch (error) { return fail(error); }
}
