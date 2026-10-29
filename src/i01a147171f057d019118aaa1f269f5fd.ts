import { existsSync } from "node:fs";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";

/** A kind's meta, with its links, which name the gates its docs pass through, and whose it is: `hero` or a cape's name. */
export type KindMeta = { schema?: unknown; durable?: boolean; links?: unknown; id?: string; from?: string };

/** `capes[0]` is core. */
export function i01a147171f057d019118aaa1f269f5fd(kind: string, kbDirs: string[], capes: Cape[], hero?: Bridge): KindMeta | undefined {
	const [only, name] = kind.includes(":") ? (kind.split(":", 2) as [string, string]) : [undefined, kind];
	const core = capes[0];
	const heroName = hero?.root ? findKbDoc(hero.kbDir, hero.root)?.fm.name : undefined;

	if (!only || only === heroName) {
		// A hero repo keeps the kinds it declares in .nosedive/kinds/.
		for (const kbDir of [...kbDirs, ...(hero?.kindsDir ? [hero.kindsDir] : [])]) {
			if (!existsSync(kbDir)) continue;
			const doc = listKbDocs(kbDir).find((candidate) => candidate.fm.kind === "kind" && candidate.fm.name === name);
			if (doc) return { ...((doc.fm.meta ?? {}) as KindMeta), links: doc.fm.links ?? [], id: String(doc.fm.id), from: "hero" };
		}
		if (only) throw new Error(`${only} declares no kind ${name}`);
	}

	const worn = new Map<string, KindMeta>();
	for (const cape of capes.slice(1)) if (cape.kinds?.[name] !== undefined && !worn.has(cape.name)) worn.set(cape.name, cape.kinds[name] as KindMeta);
	// A core action runs without the hero's capes loaded; their builds recorded their kinds.
	for (const { name: capeName, build } of hero && core ? configuredCapes(hero, core) : []) {
		if (build?.kinds?.[name] !== undefined && !worn.has(capeName)) worn.set(capeName, build.kinds[name] as KindMeta);
	}
	const fromCore = core?.kinds?.[name] === undefined ? undefined : { ...(core.kinds[name] as KindMeta), from: core.name };
	if (only) {
		const meta = only === core?.name ? fromCore : worn.get(only);
		if (!meta) throw new Error(`${only} declares no kind ${name}`);
		return { ...meta, from: only };
	}
	if (worn.size > 1) throw new Error(`${[...worn.keys()].map((capeName) => `${capeName}:${name}`).join(" and ")} both declare ${name}: name one`);
	const [[capeName, meta] = []] = worn;
	return capeName ? { ...meta, from: capeName } : fromCore;
}
