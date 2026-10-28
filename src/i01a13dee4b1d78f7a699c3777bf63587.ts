import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { parse } from "yaml";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";

/** The keys an older config names its root under: by its kind, then the legacy names. */
export const ROOT_KEYS = ["ship", "cape", "base", "root", "backlog"];

const QUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.md$/i;

export function i01a13dee4b1d78f7a699c3777bf63587(dir: string): Bridge | undefined {
	const nosedive = join(dir, ".nosedive");
	const configPath = join(nosedive, "config.yaml");
	if (!existsSync(configPath)) return undefined;
	const config = (parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
	const text = (value: unknown) => (typeof value === "string" ? value : undefined);

	if (Array.isArray(config.roots)) {
		const roots = config.roots.flatMap((path) => {
			const id = typeof path === "string" ? QUID.exec(path)?.[1]?.toLowerCase() : undefined;
			if (!id) throw new Error(`${configPath}: each of \`roots\` is a path to a doc named by its quid, not ${JSON.stringify(path)}`);
			const at = resolve(dir, path as string);
			return [{ id, dir: dirname(at), path: at }];
		});
		const workspace = text(config.workspace);
		return {
			dir: resolve(dir),
			configPath,
			config,
			id: text(config.id) ?? roots[0]?.id,
			roots,
			kbDir: roots[0]?.dir ?? resolve(dir, "kb"),
			root: roots[0]?.id,
			workspace: workspace === undefined ? undefined : resolve(dir, workspace),
			kindsDir: join(nosedive, "kinds"),
			reposDir: join(nosedive, "repos"),
		};
	}

	const kbDir = resolve(dir, text(config.kb) ?? "kb");
	const named = [...new Set(ROOT_KEYS.flatMap((key) => (text(config[key]) ? [text(config[key])!] : [])))];
	if (named.length > 1) throw new Error(`${configPath} names more than one root: ${named.join(", ")}`);
	const root = named[0];
	const rootDoc = root ? findKbDoc(kbDir, root) : undefined;
	const meta = (rootDoc?.fm.meta ?? {}) as { workspace?: unknown };
	// A legacy base that carries a workspace is read as a hero repo.
	const hasWorkspace = rootDoc?.fm.kind === "ship" || (rootDoc?.fm.kind === "base" && text(meta.workspace) !== undefined);
	const workspace = hasWorkspace ? resolve(dir, text(meta.workspace) ?? "workspace") : undefined;
	const roots = root ? [{ id: root, dir: kbDir, path: join(kbDir, `${root}.md`) }] : [];
	return { dir: resolve(dir), configPath, config, id: text(config.id) ?? root, roots, kbDir, root, workspace };
}
