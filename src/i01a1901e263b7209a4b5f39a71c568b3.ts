import { existsSync } from "node:fs";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

const LOCAL = /^(?:[^:]*\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:\.md)?$/;

/** A doc of the hero repo itself, as the walk read it. */
export type HeroDoc = NonNullable<ReturnType<typeof findKbDoc>> & { repoDir: string; kbDir: string };
/** Each feat with the directory of the root that reaches it and the docs that link it so, in the order the walk met them. */
export type FeatTree = Map<string, { dir: string; parents: string[] }>;
export type FeatWalk = { feats: FeatTree; docs: Map<string, HeroDoc> };

/** Walks the hero's roots once, reading only the docs their `.feat` links reach; a root of kind cape and `parent.feat` links aside. */
export function i01a1901e263b7209a4b5f39a71c568b3(bridge: Bridge): FeatWalk {
	const feats: FeatTree = new Map();
	const docs = new Map<string, HeroDoc>();
	const missing = new Set<string>();
	const read = (id: string) => {
		if (!docs.has(id) && !missing.has(id)) {
			const doc = inHero(bridge, id);
			if (doc) docs.set(id, doc);
			else missing.add(id);
		}
		return docs.get(id);
	};
	for (const root of bridge.roots) {
		const rootDoc = read(root.id);
		const kind = rootDoc && docKind(rootDoc);
		if (kind?.owner === CORE_OWNER && kind.name === "cape") continue;
		const seen = new Set<string>();
		const queue = [root.id];
		while (queue.length > 0) {
			const at = queue.shift()!;
			if (seen.has(at)) continue;
			seen.add(at);
			const doc = read(at);
			for (const link of doc ? linkedIds(doc) : []) {
				if (typeof link.rel !== "string" || !link.rel.endsWith(".feat") || link.rel === "parent.feat") continue;
				const node = feats.get(link.id) ?? { dir: root.dir, parents: [] };
				node.parents.push(at);
				feats.set(link.id, node);
				queue.push(link.id);
			}
		}
	}
	return { feats, docs };
}

/** Every feat the hero's roots reach. */
export function featTree(bridge: Bridge): FeatTree {
	return i01a1901e263b7209a4b5f39a71c568b3(bridge).feats;
}

/** The directory of the root that reaches a feat, which is what makes it one. */
export function featRoot(bridge: Bridge, id: string): string | undefined {
	return featTree(bridge).get(id)?.dir;
}

/** The ids a doc links within its own repo, with each link's rel; a link naming another repo (<repo>:<id>) is left out. */
export function linkedIds(doc: { fm: Record<string, unknown> }): { id: string; rel: unknown }[] {
	return (Array.isArray(doc.fm.links) ? doc.fm.links : []).flatMap((link) =>
		Object.entries((link ?? {}) as Record<string, { rel?: unknown } | null>).flatMap(([key, value]) => {
			const id = LOCAL.exec(key)?.[1];
			return id ? [{ id, rel: value?.rel }] : [];
		}),
	);
}

function inHero(bridge: Bridge, id: string): HeroDoc | undefined {
	const dirs = [...(bridge.kindsDir ? [bridge.kindsDir] : []), ...(bridge.reposDir ? [bridge.reposDir] : []), ...bridge.roots.map((root) => root.dir), bridge.kbDir];
	for (const kbDir of new Set(dirs)) {
		const doc = existsSync(kbDir) ? findKbDoc(kbDir, id) : undefined;
		if (doc) return { ...doc, repoDir: bridge.dir, kbDir };
	}
	return undefined;
}
