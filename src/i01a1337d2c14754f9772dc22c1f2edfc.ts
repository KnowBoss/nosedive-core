import { isAbsolute, resolve } from "node:path";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";

export function i01a1337d2c14754f9772dc22c1f2edfc(bridge: Bridge, name: string): { id: string; name: string; remote: string } {
	const doc = listKbDocs(bridge.kbDir).find((candidate) => candidate.fm.kind === "repo" && candidate.fm.name === name);
	if (!doc) throw new Error(`no repo named ${name} in ${bridge.kbDir}`);
	const remotes = ((doc.fm.meta as { remotes?: Record<string, unknown> } | undefined)?.remotes ?? {}) as Record<string, unknown>;
	const first = Object.values(remotes).find((value) => typeof value === "string") as string | undefined;
	if (!first) throw new Error(`repo ${name} (${String(doc.fm.id)}) has no meta.remotes to clone from`);
	const remote = /^[a-z][a-z0-9+.-]*:\/\/|^git@/i.test(first) || isAbsolute(first) ? first : resolve(bridge.dir, first);
	return { id: String(doc.fm.id), name, remote };
}
