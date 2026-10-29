import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, isAbsolute, join, resolve } from "node:path";
import { parse } from "yaml";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

const QUID = /([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.md$/i;

export function i01a13dee4b1d78f7a699c3777bf63587(dir: string): Bridge | undefined {
	const nosedive = join(dir, ".nosedive");
	const configPath = join(nosedive, "config.yaml");
	if (!existsSync(configPath)) return undefined;
	const config = (parse(readFileSync(configPath, "utf8")) ?? {}) as Record<string, unknown>;
	const text = (value: unknown) => (typeof value === "string" ? value : undefined);

	const roots = (Array.isArray(config.roots) ? config.roots : []).flatMap((path) => {
		const id = typeof path === "string" ? QUID.exec(path)?.[1]?.toLowerCase() : undefined;
		if (!id) throw new Error(`${configPath}: each of \`roots\` is a path to a doc named by its quid, not ${JSON.stringify(path)}`);
		const at = resolve(dir, path as string);
		return [{ id, dir: dirname(at), path: at }];
	});
	const workspace = text(config.workspace);
	const primary = roots.find((root) => root.id === text(config.id)?.toLowerCase()) ?? roots[0];
	const wanted = process.env.NOSEDIVE_BASE;
	const base = roots.find((root) => root.id === selectBase(roots, wanted)) ?? primary;
	const plain = !selectBase(roots, wanted) && wanted && isAbsolute(wanted) ? wanted : undefined;
	return {
		dir: resolve(dir),
		configPath,
		config,
		id: text(config.id) ?? primary?.id,
		roots,
		kbDir: primary?.dir ?? resolve(dir, "kb"),
		root: primary?.id,
		base: base?.id,
		baseDir: plain ?? base?.dir ?? resolve(dir, "kb"),
		workspace: workspace === undefined ? undefined : resolve(dir, workspace),
		kindsDir: join(nosedive, "kinds"),
		reposDir: join(nosedive, "repos"),
	};
}

/** The root a base selection names, by its quid, its doc's name or its directory's name; launch refuses a name the hero has no root by. */
export function selectBase(roots: { id: string; dir: string; path: string }[], wanted: string | undefined): string | undefined {
	if (!wanted) return undefined;
	const named = (path: string) => /^name:\s*(.+?)\s*$/m.exec(existsSync(path) ? readFileSync(path, "utf8") : "")?.[1]?.replace(/^"|"$/g, "");
	return roots.find((root) => root.id === wanted.toLowerCase() || named(root.path) === wanted || basename(root.dir) === wanted || root.dir === resolve(wanted))?.id;
}
