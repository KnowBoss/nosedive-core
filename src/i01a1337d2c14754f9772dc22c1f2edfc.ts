import { existsSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

export function i01a1337d2c14754f9772dc22c1f2edfc(bridge: Bridge, name: string): { id: string; name: string; remote: string } {
	// Registered repos are core repo docs by place, regardless of root kind.
	const reposDir = bridge.reposDir ?? join(bridge.dir, ".nosedive", "repos");
	const dirs = existsSync(reposDir) ? [reposDir] : [];
	const doc = dirs.flatMap((dir) => listKbDocs(dir)).find((candidate) => candidate.fm.name === name);
	if (!doc) throw new Error(`no repo named ${name} in ${bridge.reposDir ?? bridge.kbDir}`);
	const origin = ((doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}).origin;
	if (typeof origin !== "string" || !origin) throw new Error(`repo ${name} (${String(doc.fm.id)}) has no meta.remotes.origin to clone from`);
	const remote = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(origin) || isAbsolute(origin) ? origin : resolve(bridge.dir, origin);
	return { id: String(doc.fm.id), name, remote };
}
