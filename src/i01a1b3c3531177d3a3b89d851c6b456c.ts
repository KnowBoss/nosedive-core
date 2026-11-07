import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

/** One past legacy nosedive's own level, so legacy reads the hero as seeded by a newer package. */
const FENCE = 3;

export function i01a1b3c3531177d3a3b89d851c6b456c(dir: string, ctx: MigrationCtx): string[] {
	const path = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(path)) return [];
	const config = parseDocument(readFileSync(path, "utf8"));
	const level = config.get("compatibility-level");
	if (typeof level !== "number" || level >= FENCE) return [];
	config.set("compatibility-level", FENCE);
	writeFileSync(path, config.toString());
	ctx.out(`legacy-fence: compatibility-level ${level} raised to ${FENCE}, so legacy nosedive will not seed this hero`);
	return [path];
}
