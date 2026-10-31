import { existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

type Root = Bridge["roots"][number];
export type LocalCape = { id: string; name: string; dir: string; root: Root };

/** The directory of the nearest repo of its own at or above a directory, if any. */
function holder(dir: string): string | undefined {
	for (let at = resolve(dir); ; at = dirname(at)) {
		if (existsSync(join(at, ".nosedive", "config.yaml"))) return at;
		if (dirname(at) === at) return undefined;
	}
}

/** Whether a root's directory is held by a seeded repo nested in the hero, not by the hero. */
export function nestedRoot(hero: Pick<Bridge, "dir">, root: Pick<Root, "dir">): boolean {
	const at = holder(root.dir);
	return at !== undefined && relative(at, hero.dir) !== "";
}

export function i01a1934563e77ed886f06d04416385ef(hero: Pick<Bridge, "dir" | "roots">): LocalCape[] {
	return hero.roots.flatMap((root) => {
		const dir = nestedRoot(hero, root) ? holder(root.dir) : undefined;
		const doc = dir ? findKbDoc(root.dir, root.id) : undefined;
		if (!dir || !doc) return [];
		const kind = docKind(doc, readRepoConfig(dir)?.id);
		return kind.owner === CORE_OWNER && kind.name === "cape" ? [{ id: root.id, name: String(doc.fm.name), dir, root }] : [];
	});
}
