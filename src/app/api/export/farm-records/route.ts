import { db } from "@/lib/db"; import { requireUser } from "@/lib/auth/require-user"; import { AppError, fail } from "@/lib/api"; import { createChinesePdf } from "@/lib/export/pdf";
const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
export async function GET(request: Request) {
  try {
    const user = await requireUser(); const query = new URL(request.url).searchParams; const format = query.get("format") || "csv"; const id = query.get("id");
    const records = await db.farmRecord.findMany({ where: { ...(id ? { id } : {}), farm: user.role === "ADMIN" ? {} : { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] } }, include: { farm: true, plot: true, creator: true, evidence: true } });
    if (id && !records.length) throw new AppError("NOT_FOUND", "No exportable record was found.", 404);
    if (format === "pdf") {
      const record = records[0]; if (!record) throw new AppError("NOT_FOUND", "There are no records to export.", 404);
      const pending = JSON.parse(record.structuredDataJson).missingFields?.join(", ") || "None";
      const pdf = createChinesePdf("Farm Log", [`Farm: ${record.farm.name}`, `Created: ${record.createdAt.toLocaleString("en-US")}`, `Document status: ${record.status}`, `Farm activity: ${record.content || record.rawInput}`, `Items to confirm: ${pending}`, `External sources: ${record.evidence.map(evidence => evidence.sourceName).join(", ") || "None"}`, "Organized with AI assistance; human review is required."]);
      return new Response(pdf, { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="farm-record-${record.id}.pdf"` } });
    }
    const rows = [["Date", "Farm", "Plot", "Farm activity", "Content", "Status"], ...records.map(record => [record.recordDate?.toISOString().slice(0, 10) || "", record.farm.name, record.plot?.name || "", record.actionType || "", record.content || record.rawInput, record.status])];
    return new Response("\ufeff" + rows.map(row => row.map(csvCell).join(",")).join("\r\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": "attachment; filename=farm-records.csv" } });
  } catch (error) { return fail(error); }
}
