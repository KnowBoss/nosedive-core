import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

export type Bridge = {
	dir: string;
	configPath: string;
	config: Record<string, unknown>;
	/** The repo's quid: config `id`, else its first root's. */
	id: string | undefined;
	/** The docs its docs hang from, each in the directory holding its docs. */
	roots: { id: string; dir: string; path: string }[];
	/** Its primary root's directory. */
	kbDir: string;
	/** Its primary root's id: the root whose id is config `id`, else its first. */
	root: string | undefined;
	/** The selected base's id: the root NOSEDIVE_BASE names, else the primary, whose capes a plain directory wears. */
	base: string | undefined;
	/** Where crud writes: the selected base's directory, or the plain directory NOSEDIVE_BASE names. */
	baseDir: string;
	/** Where other repos are checked out, which only a hero repo has. */
	workspace: string | undefined;
	/** Where it keeps the kinds and repos its roots share. */
	kindsDir?: string;
	reposDir?: string;
};

export function i01a1335485c67c95b7efdf2f0e03cfd6(start: string): Bridge | undefined {
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		const config = readRepoConfig(dir);
		if (config) return config;
		if (dirname(dir) === dir) return undefined;
	}
}

/** The hero whose workspace holds a directory, and the checkout it sits in; the workspace directory itself is in none. */
export function insideWorkspace(start: string): { hero: Bridge; checkout: string } | undefined {
	const at = resolve(start);
	for (let dir = dirname(at); ; dir = dirname(dir)) {
		const hero = readRepoConfig(dir);
		if (hero?.workspace !== undefined) {
			const rel = relative(hero.workspace, at);
			if (rel !== "" && !rel.startsWith("..") && !isAbsolute(rel)) return { hero, checkout: join(hero.workspace, rel.split(sep)[0]!) };
		}
		if (dirname(dir) === dir) return undefined;
	}
}
