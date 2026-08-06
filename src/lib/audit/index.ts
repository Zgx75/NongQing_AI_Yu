import { db } from "@/lib/db";

export async function audit(input: { userId?: string; action: string; entityType: string; entityId?: string; before?: unknown; after?: unknown }) {
  await db.auditLog.create({ data: {
    userId: input.userId, action: input.action, entityType: input.entityType, entityId: input.entityId,
    beforeJson: input.before === undefined ? undefined : JSON.stringify(input.before),
    afterJson: input.after === undefined ? undefined : JSON.stringify(input.after),
  }});
}
