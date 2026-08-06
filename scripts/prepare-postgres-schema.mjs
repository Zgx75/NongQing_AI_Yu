import { readFile, writeFile } from "node:fs/promises";
const source = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8");
const postgres = source.replace('provider = "sqlite"', 'provider = "postgresql"');
await writeFile(new URL("../prisma/schema.postgresql.generated.prisma", import.meta.url), postgres);
console.log("Generated prisma/schema.postgresql.generated.prisma for PostgreSQL.");
