import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse } from "yaml";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";

/** The keys an older config names its root under: by its kind, then the legacy names. */
export const ROOT_KEYS = ["ship", "cape", "base", "root", "backlog"];
/** The kinds a repo can be by its kind file, `.nosedive/<kind>.md`. */
export const KIND_FILES = ["ship", "cape", "base"];

export function i01a13dee4b1d78f7a699c3777bf63587(dir: string): Bridge | undefined {
	const nosedive = join(dir, ".nosedive");
	const configPath = join(nosedive, "config.yaml");
	const kindFiles = KIND_FILES.filter((kind) => existsSync(join(nosedive, `${kind}.md`)));
	if (!existsSync(configPath) && kindFiles.length === 0) return undefined;
	if (kindFiles.length > 1) throw new Error(`${nosedive} holds ${kindFiles.map((kind) => `${kind}.md`).join(" and ")}: a repo is one of ship, cape or base`);
	const config = existsSync(configPath) ? ((parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>) : {};
	const text = (value: unknown) => (typeof value === "string" ? value : undefined);

	if (kindFiles.length === 1) {
		const rootPath = join(nosedive, `${kindFiles[0]}.md`);
		const doc = readKbDoc(readFileSync(rootPath, "utf8"), rootPath);
		const meta = (doc.fm.meta ?? {}) as { workspace?: unknown; decks?: unknown };
		const ship = kindFiles[0] === "ship";
		const decks = ship
			? Object.entries((meta.decks ?? {}) as Record<string, unknown>).map(([deck, root]) => ({ dir: resolve(dir, deck), root: text(root) }))
			: [];
		const kbDir = decks[0]?.dir ?? resolve(dir, text(config.kb) ?? "kb");
		return {
			dir: resolve(dir),
			configPath,
			config,
			kbDir,
			root: text(doc.fm.id),
			rootPath,
			workspace: ship ? resolve(dir, text(meta.workspace) ?? "workspace") : undefined,
			decks: decks.length > 0 ? decks : [{ dir: kbDir, root: undefined }],
			kindsDir: ship ? join(nosedive, "kinds") : undefined,
			reposDir: ship ? join(nosedive, "repos") : undefined,
		};
	}

	const kbDir = resolve(dir, text(config.kb) ?? "kb");
	const roots = [...new Set(ROOT_KEYS.flatMap((key) => (text(config[key]) ? [text(config[key])!] : [])))];
	if (roots.length > 1) throw new Error(`${configPath} names more than one root: ${roots.join(", ")}`);
	const root = roots[0];
	const rootDoc = root ? findKbDoc(kbDir, root) : undefined;
	const meta = (rootDoc?.fm.meta ?? {}) as { workspace?: unknown };
	// A legacy base that carries a workspace is read as a ship.
	const hasWorkspace = rootDoc?.fm.kind === "ship" || (rootDoc?.fm.kind === "base" && text(meta.workspace) !== undefined);
	const workspace = hasWorkspace ? resolve(dir, text(meta.workspace) ?? "workspace") : undefined;
	return { dir: resolve(dir), configPath, config, kbDir, root, workspace, decks: [{ dir: kbDir, root }] };
}
