import { dirname, isAbsolute, relative, resolve } from "node:path";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

export type Bridge = {
	dir: string;
	configPath: string;
	config: Record<string, unknown>;
	kbDir: string;
	/** The id of the bridge's root doc: config `ship`, `cape` or `base`, or legacy `root` or `backlog`. */
	root: string | undefined;
	/** Where other repos are checked out, which only a ship has: its root's `meta.workspace`. */
	workspace: string | undefined;
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
