import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a175dbf8d67926b24029e8caa38e94 as baseline } from "./i01a175dbf8d67926b24029e8caa38e94.ts";

/** The chain, in order: each migration's doc names the one before it in meta.after, which the tests hold this to. */
export const MIGRATIONS: { id: string; name: string; run: (dir: string) => string[] }[] = [
	{ id: "01a175db-f8d6-7926-b240-29e8caa38e94", name: "baseline", run: baseline },
];

export function i01a175dbf4517dafa3a9048ecd98ab84(dir: string, chain = MIGRATIONS): string[] {
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(configPath) || chain.length === 0) return [];
	const last = parseDocument(readFileSync(configPath, "utf8")).get("last-migration");
	const from = typeof last === "string" ? chain.findIndex((each) => each.id === last) : -1;
	if (typeof last === "string" && from < 0) throw new Error(`${configPath} was migrated by a newer core, to ${last}, which this core does not have`);
	const ran: string[] = [];
	for (const migration of chain.slice(from + 1)) {
		const changed = migration.run(dir);
		if (changed.length === 0) continue;
		commitFiles(dir, changed, `migrate: ${migration.name}`);
		ran.push(migration.name);
	}
	const config = parseDocument(readFileSync(configPath, "utf8"));
	if (config.get("last-migration") !== chain.at(-1)!.id) {
		config.set("last-migration", chain.at(-1)!.id);
		writeFileSync(configPath, config.toString({ lineWidth: 0 }));
		commitFiles(dir, [configPath], `migrate: ${dirName(dir)} at ${chain.at(-1)!.name}`);
	}
	return ran;
}

function dirName(dir: string): string {
	return dir.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) ?? dir;
}
