import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, fail, ok, parseJson } from "@/lib/api";
import { requireAdmin } from "@/lib/auth/require-user";
import { audit } from "@/lib/audit";
import { parsePublicWebUrl } from "@/lib/evidence/url-policy";

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  url: z.string().trim().min(8).max(2048),
  description: z.string().trim().max(500).default(""),
  searchScope: z.enum(["PAGE", "SITE"]).default("PAGE"),
  isActive: z.boolean().default(true),
});

export async function GET() {
  try { await requireAdmin(); return ok(await db.trustedWebSource.findMany({ orderBy: [{ isActive: "desc" }, { createdAt: "desc" }] })); }
  catch (error) { return fail(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireAdmin();
    const input = schema.parse(await parseJson(request));
    const url = parsePublicWebUrl(input.url);
    const normalizedUrl = url.toString();
    if (await db.trustedWebSource.findUnique({ where: { url: normalizedUrl } })) throw new AppError("SOURCE_EXISTS", "This URL is already in the trusted source list.", 409);
    const source = await db.trustedWebSource.create({ data: { ...input, url: normalizedUrl, domain: url.hostname.toLowerCase(), createdById: user.id } });
    await audit({ userId: user.id, action: "CREATE", entityType: "TrustedWebSource", entityId: source.id, after: source });
    return ok(source, 201);
  } catch (error) { return fail(error); }
}
