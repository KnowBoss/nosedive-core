import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

export function i01a138b2b8ee703cab227b010f588b6a(bridge: Bridge, id: string) {
	const own = inRepo(bridge, id);
	if (own || bridge.workspace === undefined) return own;
	const workspace = bridge.workspace;
	if (!existsSync(workspace)) return undefined;
	for (const entry of readdirSync(workspace, { withFileTypes: true })) {
		if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
		const repo = workspaceRepo(bridge, entry.name);
		const config = readRepoConfig(repo.dir);
		const doc = config ? inRepo(config, id) : existsSync(repo.kbDir) ? findKbDoc(repo.kbDir, id) : undefined;
		if (doc) return { kbDir: repo.kbDir, ...doc, repoDir: repo.dir };
	}
	return undefined;
}

/** A doc of one repo: its kind file, named for its kind not its id, then its kinds, repos and decks. */
function inRepo(repo: Bridge, id: string) {
	if (repo.rootPath && repo.root === id) {
		const text = readFileSync(repo.rootPath, "utf8");
		return { ...readKbDoc(text, repo.rootPath), path: repo.rootPath, text, repoDir: repo.dir, kbDir: dirname(repo.rootPath) };
	}
	const dirs = [...(repo.kindsDir ? [repo.kindsDir] : []), ...(repo.reposDir ? [repo.reposDir] : []), ...repo.decks.map((deck) => deck.dir), repo.kbDir];
	for (const kbDir of [...new Set(dirs)]) {
		const doc = existsSync(kbDir) ? findKbDoc(kbDir, id) : undefined;
		if (doc) return { ...doc, repoDir: repo.dir, kbDir };
	}
	return undefined;
}
