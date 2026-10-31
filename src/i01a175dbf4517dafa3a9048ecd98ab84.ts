import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a175dbf8d67926b24029e8caa38e94 as baseline } from "./i01a175dbf8d67926b24029e8caa38e94.ts";
import { i01a18e8044c97daeb0498ee7ad07bf43 as canonicalKinds } from "./i01a18e8044c97daeb0498ee7ad07bf43.ts";

/** What a migration may ask of core: the capes it is running with, and a way to say something. */
export type MigrationCtx = Pick<Ctx, "capes" | "out">;

export type Migration = { id: string; name: string; run: (dir: string, ctx: MigrationCtx) => string[] | undefined };

/** The chain, in order: each migration's doc names the one before it in meta.after, which the tests hold this to. */
export const MIGRATIONS: Migration[] = [
	{ id: "01a175db-f8d6-7926-b240-29e8caa38e94", name: "baseline", run: baseline },
	{ id: "01a18e80-44c9-7dae-b049-8ee7ad07bf43", name: "canonical-kinds", run: canonicalKinds },
];

export function i01a175dbf4517dafa3a9048ecd98ab84(dir: string, ctx: MigrationCtx, chain = MIGRATIONS): string[] {
	const configPath = join(dir, ".nosedive", "config.yaml");
	if (!existsSync(configPath) || chain.length === 0) return [];
	const config = parseDocument(readFileSync(configPath, "utf8")).toJS() as Record<string, unknown> | null;
	const listed = Array.isArray(config?.migrations) ? config.migrations.map(String) : [];
	const last = config?.["last-migration"];
	// A config from before the list reads as having run its last migration and every one before it.
	const upTo = typeof last === "string" ? chain.findIndex((each) => each.id === last) : -1;
	if (typeof last === "string" && upTo < 0) throw newerCore(configPath, last);
	const ran = [...new Set([...chain.slice(0, upTo + 1).map((each) => each.id), ...listed])];
	for (const id of ran) if (!chain.some((each) => each.id === id)) throw newerCore(configPath, id);

	const pending = chain.filter((each) => !ran.includes(each.id));
	const listAlone = () => {
		listMigrations(configPath, ran);
		commitFiles(dir, [configPath], `migrate: ${dirName(dir)} lists its migrations`, ctx.capes[0]!.version);
	};
	if (pending.length === 0 && typeof last === "string") listAlone();
	const changed: string[] = [];
	let first = true;
	for (const migration of pending) {
		const files = migration.run(dir, ctx);
		if (!files) {
			// A migration that waits is not recorded, and the ones after it wait with it.
			if (first && typeof last === "string") listAlone();
			break;
		}
		first = false;
		ran.push(migration.id);
		// The list is rewritten from what the migration left, which may have rewritten the config itself.
		listMigrations(configPath, ran);
		commitFiles(dir, [...new Set([...files, configPath])], `migrate: ${migration.name}`, ctx.capes[0]!.version);
		if (files.length > 0) changed.push(migration.name);
	}
	return changed;
}

function newerCore(configPath: string, id: string): Error {
	return new Error(`${configPath} was migrated by a newer core, to ${id}, which this core does not have`);
}

/** Writes the list in place of `last-migration`, which it supersedes. */
function listMigrations(configPath: string, ran: string[]): void {
	const config = parseDocument(readFileSync(configPath, "utf8"));
	config.delete("last-migration");
	config.set("migrations", ran);
	writeFileSync(configPath, config.toString({ lineWidth: 0 }));
}

function dirName(dir: string): string {
	return dir.replace(/[\\/]+$/, "").split(/[\\/]/).at(-1) ?? dir;
}
