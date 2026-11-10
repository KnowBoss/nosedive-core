import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseDocument } from "yaml";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a1335480147d0686528aee80f8ee34 as namespacedUuid } from "./i01a1335480147d0686528aee80f8ee34.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a14b30eb0e72e28934c918000a26ac as loadCape } from "./i01a14b30eb0e72e28934c918000a26ac.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

type Run = (dir: string, ctx: MigrationCtx) => string[] | undefined;
type CapeMigration = { id: string; name: string; after: string | undefined; run: Run };

/** A cape's migrations in chain order: each follows the one its meta.after names, the first naming none of the cape's. */
export function capeMigrations(cape: Cape): CapeMigration[] {
	const all = Object.entries(cape.docs).flatMap(([id, doc]): CapeMigration[] => {
		const { fm } = readKbDoc(doc.text);
		if (fm.kind !== "migration") return [];
		const run = (cape.index as Record<string, unknown>)[namespacedUuid(id, cape.id)];
		if (typeof run !== "function") throw new Error(`${cape.name}'s migration ${String(fm.name)} has no code in its build`);
		const after = (fm.meta as { after?: unknown } | undefined)?.after;
		return [{ id, name: String(fm.name), after: typeof after === "string" ? after : undefined, run: run as Run }];
	});
	const ids = new Set(all.map((each) => each.id));
	const chain: CapeMigration[] = [];
	let next = all.filter((each) => !each.after || !ids.has(each.after));
	if (next.length > 1) throw new Error(`${cape.name}'s migrations start in more than one place: ${next.map((each) => each.name).join(", ")}`);
	while (next.length === 1) {
		chain.push(next[0]!);
		next = all.filter((each) => each.after === next[0]!.id);
		if (next.length > 1) throw new Error(`${cape.name}'s migrations ${next.map((each) => each.name).join(" and ")} both follow ${chain.at(-1)!.name}`);
	}
	if (chain.length !== all.length) throw new Error(`${cape.name}'s migrations do not make one chain`);
	return chain;
}

/** The worn capes' migrations a run would try, writing nothing: each as `<cape>:<name>`, with its gist and its doc's path where that is on disk. */
export async function pendingCapeMigrations(dir: string, ctx: MigrationCtx): Promise<{ id: string; name: string; gist: string; path?: string }[]> {
	const configPath = join(dir, ".nosedive", "config.yaml");
	const bridge = findBridge(dir);
	if (!existsSync(configPath) || !bridge || bridge.dir !== dir) return [];
	const core = ctx.capes[0]!;
	const pending: { id: string; name: string; gist: string; path?: string }[] = [];
	for (const worn of configuredCapes(bridge, core)) {
		if (!worn.build || !worn.repo) continue;
		const cape = await loadCape(dir, worn.build, core);
		const source = worn.repo.dir ?? worn.build.source ?? join(dir, ".nosedive", "capes", "src", worn.repo.id);
		const kbDir = existsSync(source) ? (readRepoConfig(source)?.kbDir ?? join(source, "kb")) : undefined;
		for (const migration of capeMigrations(cape)) {
			if (listed(configPath).includes(`${worn.repo.id}:${migration.id}`)) continue;
			const path = kbDir ? findKbDoc(kbDir, migration.id)?.path : undefined;
			pending.push({ id: migration.id, name: `${worn.name}:${migration.name}`, gist: String(readKbDoc(cape.docs[migration.id]!.text).fm.gist ?? ""), ...(path ? { path } : {}) });
		}
	}
	return pending;
}

export async function i01a1b30d4b537775a4e1260cd7fb9067(dir: string, ctx: MigrationCtx): Promise<string[]> {
	const configPath = join(dir, ".nosedive", "config.yaml");
	const bridge = findBridge(dir);
	if (!existsSync(configPath) || !bridge || bridge.dir !== dir) return [];
	const core = ctx.capes[0]!;
	const changed: string[] = [];
	for (const worn of configuredCapes(bridge, core)) {
		if (!worn.build || !worn.repo) continue;
		const cape = await loadCape(dir, worn.build, core);
		for (const migration of capeMigrations(cape)) {
			const entry = `${worn.repo.id}:${migration.id}`;
			if (listed(configPath).includes(entry)) continue;
			const files = migration.run(dir, ctx);
			if (!files) break;
			const config = parseDocument(readFileSync(configPath, "utf8"));
			config.set("migrations", [...listed(configPath), entry]);
			writeFileSync(configPath, config.toString({ lineWidth: 0 }));
			commitFiles(dir, [...new Set([...files, configPath])], `migrate: ${worn.name}:${migration.name}`, core.version);
			if (files.length > 0) changed.push(`${worn.name}:${migration.name}`);
		}
	}
	return changed;
}

function listed(configPath: string): string[] {
	const config = parseDocument(readFileSync(configPath, "utf8")).toJS() as { migrations?: unknown } | null;
	return Array.isArray(config?.migrations) ? config.migrations.map(String) : [];
}
