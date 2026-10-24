import { dirname, isAbsolute, relative, resolve } from "node:path";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

export type Bridge = {
	dir: string;
	configPath: string;
	config: Record<string, unknown>;
	/** Where its docs are: a ship's first deck, a cape's or base's kb. */
	kbDir: string;
	/** The id of the bridge's root doc: its kind file's, else its config's `ship`, `cape`, `base`, `root` or `backlog`. */
	root: string | undefined;
	/** Its kind file, `.nosedive/ship.md`, `cape.md` or `base.md`, when it has one. */
	rootPath?: string;
	/** Where other repos are checked out, which only a ship has. */
	workspace: string | undefined;
	/** A ship's decks, the first its kb; a repo of one kb has that one. */
	decks: { dir: string; root: string | undefined }[];
	/** Where a ship with a kind file keeps the kinds and repos its decks share. */
	kindsDir?: string;
	reposDir?: string;
};

export function i01a1335485c67c95b7efdf2f0e03cfd6(start: string): Bridge | undefined {
	const found: Bridge[] = [];
	for (let dir = resolve(start); ; dir = dirname(dir)) {
		const config = readRepoConfig(dir);
		if (config) found.push(config);
		if (dirname(dir) === dir) break;
	}
	// The nearest ship, unless it is checked out in another ship's workspace: then that ship.
	let bridge = found.find((candidate) => candidate.workspace !== undefined);
	if (!bridge) return found[0];
	for (const outer of found.slice(found.indexOf(bridge) + 1)) {
		if (outer.workspace !== undefined && within(outer.workspace, bridge.dir)) bridge = outer;
	}
	return bridge;
}

function within(parent: string, child: string): boolean {
	const rel = relative(parent, child);
	return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}
