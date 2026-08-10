import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { BrandStudio } from "@/components/brand/brand-studio";

export default async function Brand() {
  const user = (await getCurrentUser())!;
  const records = await db.farm.findMany({
    where: user.role === "ADMIN" ? { archivedAt: null } : { archivedAt: null, OR: [{ ownerId: user.id }, { members: { some: { userId: user.id, permission: "EDIT" } } }] },
    include: { brandProfile: true, plots: { where: { isActive: true }, include: { plantings: { where: { status: "ACTIVE" }, include: { crop: true } } } } },
  });
  const farms = records.map(farm => ({
    id: farm.id,
    name: farm.name,
    brandProfile: farm.brandProfile,
    primaryCrops: [...new Set(farm.plots.flatMap(plot => plot.plantings.map(planting => planting.crop.name)))],
  }));
  return <div className="page-shell">
    <h1 className="text-3xl font-black md:text-4xl">Brand Copy Studio</h1>
    <p className="mb-6 text-stone-600">Create editable drafts using confirmed Product facts and Promotion and Place settings from the Marketing Mix.</p>
    {farms.length ? <BrandStudio farms={farms}/> : <div className="surface p-8 text-center">Create a farm first.</div>}
  </div>;
}
