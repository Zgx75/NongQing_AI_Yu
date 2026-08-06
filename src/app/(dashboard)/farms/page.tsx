import { db } from "@/lib/db"; import { FarmManager } from "@/components/farm/farm-manager";
export default async function Farms(){const crops=await db.crop.findMany({orderBy:{name:"asc"}});return <div className="page-shell"><h1 className="text-3xl font-black md:text-4xl">農場與田區</h1><p className="mb-6 text-stone-600">建立農場、田區與主要作物；正式紀錄只會存到您有權限的農場。</p><FarmManager crops={crops}/></div>}
