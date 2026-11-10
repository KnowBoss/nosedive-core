import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, join, relative } from "node:path";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { dropWhenOf } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a1335482f876d6808aec457f512e80 as readKbDoc } from "./i01a1335482f876d6808aec457f512e80.ts";
import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a1337d2c14754f9772dc22c1f2edfc as findRepoDoc } from "./i01a1337d2c14754f9772dc22c1f2edfc.ts";
import { i01a141f869bf7f76b5bc81aa991ff9b9 as configuredCapes, type ConfiguredCape } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import type { KindMeta } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

export type KindGroup = {
	owner: string;
	/** The owner's root doc name. */
	name: string;
	/** The name of the repo doc that registers the owner in the repo asked; its root doc name for the repo itself. */
	longName: string;
	kinds: { name: string; spellings: string[]; meta: KindMeta }[];
};

type Owner = { owner: string; name: string; longName: string; kinds: Record<string, unknown>; repoDir?: string; repoDocId?: string };

/** The repo's own kinds, bare, then each cape it wears, core first, with every spelling that reaches each of its kinds. */
export function i01a18e40518e7f15a2066909dca2be43(hero: Bridge, capes: Cape[]): KindGroup[] {
	const own = ownKinds(hero);
	const groups: KindGroup[] = [];
	if (hero.id) {
		const name = String(findKbDoc(hero.kbDir, hero.root ?? "")?.fm.name ?? basename(hero.dir));
		groups.push({ owner: hero.id, name, longName: name, kinds: Object.entries(own).map(([kind, meta]) => ({ name: kind, spellings: [kind], meta })) });
	}

	// Where a cape's history can be asked of: its source, else the hero's checkout of it, else the clone its build was made from.
	const owners = new Map<string, Owner>();
	const configured = capes[0] ? configuredCapes(hero, capes[0]) : [];
	const historyOf = (name: string, repoId: string | undefined, source?: string) => {
		const checkout = hero.workspace ? join(hero.workspace, name) : undefined;
		const clone = repoId ? join(hero.dir, ".nosedive", "capes", "src", repoId) : undefined;
		return [source, clone, checkout].find((dir) => dir !== undefined && existsSync(dir));
	};
	for (const cape of capes) {
		if (!cape.owner || cape.owner === hero.id) continue;
		const repoDocId = repoOf(hero, configured, cape.name);
		owners.set(cape.owner, { owner: cape.owner, name: cape.shortName ?? cape.name, longName: cape.name, kinds: cape.kinds, repoDir: historyOf(cape.name, repoDocId, cape.repoDir), repoDocId });
	}
	for (const worn of configured) {
		const build = worn.build;
		if (!build?.owner || build.owner === hero.id || owners.has(build.owner)) continue;
		owners.set(build.owner, { owner: build.owner, name: build.shortName ?? worn.name, longName: worn.name, kinds: build.kinds ?? {}, repoDir: historyOf(worn.name, worn.repo?.id, build.source), repoDocId: worn.repo?.id });
	}

	// A name two of them answer to reaches neither: the other names do.
	const sorted = [...owners.values()].sort((a, b) => Number(b.owner === CORE_OWNER) - Number(a.owner === CORE_OWNER));
	const taking = new Map<string, number>();
	for (const each of sorted) for (const alias of new Set([each.name, each.longName, each.owner])) taking.set(alias, (taking.get(alias) ?? 0) + 1);
	for (const each of sorted) {
		const aliases = [...new Set([each.name, each.longName, each.owner])].filter((alias) => taking.get(alias) === 1);
		const kinds = Object.entries(each.kinds).map(([name, declared]) => ({
			name,
			spellings: aliases.map((alias) => `${alias}:${name}`),
			meta: { ...(declared as object), name, owner: each.owner, repoDir: each.repoDir, repoDocId: each.repoDocId } as KindMeta,
		}));
		groups.push({ owner: each.owner, name: each.name, longName: each.longName, kinds });
	}
	return groups;
}

/** The kinds a repo declares, in its `.nosedive/kinds/`. */
function ownKinds(hero: Bridge): Record<string, KindMeta> {
	const kinds: Record<string, KindMeta> = {};
	if (!hero.kindsDir || !existsSync(hero.kindsDir)) return kinds;
	for (const file of readdirSync(hero.kindsDir).filter((name) => name.endsWith(".md")).sort()) {
		const path = join(hero.kindsDir, file);
		let doc;
		try {
			doc = { ...readKbDoc(readFileSync(path, "utf8"), path), path };
		} catch {
			continue;
		}
		const kind = docKind(doc, hero.id);
		const name = String(doc.fm.name);
		if (kind.owner !== CORE_OWNER || kind.name !== "kind" || name in kinds) continue;
		const meta = (doc.fm.meta ?? {}) as { schema?: unknown };
		const dropWhen = dropWhenOf(doc.body);
		kinds[name] = { ...meta, links: doc.fm.links ?? [], id: String(doc.fm.id), name, owner: hero.id!, file: relative(hero.dir, path).replace(/\\/g, "/"), repoDir: hero.dir, ...(dropWhen !== undefined ? { dropWhen } : {}) };
	}
	return kinds;
}

/** The repo doc that registers a cape in the hero, which the hero's feats name work branches by. */
function repoOf(hero: Bridge, configured: ConfiguredCape[], name: string): string | undefined {
	try {
		return configured.find((worn) => worn.name === name)?.repo?.id ?? findRepoDoc(hero, name).id;
	} catch {
		return undefined;
	}
}
