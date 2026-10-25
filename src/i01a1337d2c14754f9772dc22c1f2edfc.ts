import { existsSync } from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a14ac0044f7142a4623b2b7eff2eb5 as homeCopy } from "./i01a14ac0044f7142a4623b2b7eff2eb5.ts";

export function i01a1337d2c14754f9772dc22c1f2edfc(bridge: Bridge, name: string): { id: string; name: string; remote: string } {
	// A ship with a kind file keeps its repos in its bridge; any other keeps them in its kb.
	const dirs = [...(bridge.reposDir && existsSync(bridge.reposDir) ? [bridge.reposDir] : []), ...new Set([...bridge.roots.map((root) => root.dir), bridge.kbDir])];
	const doc = dirs.flatMap((dir) => listKbDocs(dir)).find((candidate) => candidate.fm.kind === "repo" && candidate.fm.name === name);
	if (!doc) throw new Error(`no repo named ${name} in ${bridge.reposDir ?? bridge.kbDir}`);
	const remotes = ((doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}) as Record<string, unknown>;
	const first = Object.values(remotes).find((value) => typeof value === "string") as string | undefined;
	if (!first) {
		const home = homeCopy(bridge, name);
		if (!home) throw new Error(`repo ${name} (${String(doc.fm.id)}) has no meta.remotes, and the bridge no \`home\`, to clone from`);
		return { id: String(doc.fm.id), name, remote: home };
	}
	const remote = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(first) || isAbsolute(first) ? first : resolve(bridge.dir, first);
	return { id: String(doc.fm.id), name, remote };
}
