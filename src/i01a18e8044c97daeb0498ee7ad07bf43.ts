import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { wornCapes } from "./i01a141f869bf7f76b5bc81aa991ff9b9.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { i01a1337c810a7456876b831d0c873396 as capeManifest } from "./i01a1337c810a7456876b831d0c873396.ts";
import { nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";
import { pinOf, type KindMeta } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { CORE_OWNER, scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { MigrationCtx } from "./i01a175dbf4517dafa3a9048ecd98ab84.ts";

/** The kinds core's code reads, which a doc of core's is given an entry for; core's other kinds, `memo` among them, are any repo's to declare. */
const STRUCTURAL = ["action", "function", "cape", "migration", "base", "hero"];
/** Core's by place: these live in `.nosedive/`, wherever a legacy doc of them was left. */
const MANAGED = ["kind", "repo"];

type Doc = ReturnType<typeof listKbDocs>[number];
type Owner = { id: string; name: string; kinds: Record<string, unknown>; repoDir?: string; repoDocId?: string };

/** Returns undefined, having said why, while a worn cape is not built: what it declares is not known, so nothing is written. */
export function i01a18e8044c97daeb0498ee7ad07bf43(dir: string, ctx: MigrationCtx): string[] | undefined {
	const hero = readRepoConfig(dir);
	if (!hero?.id) return [];
	const core = ctx.capes[0]!;
	const changed = new Set<string>();

	const worn = wornKinds(hero, ctx);
	if (worn.unbuilt.length > 0) {
		ctx.out(`canonical-kinds: waiting for ${worn.unbuilt.join(", ")} to build, since what ${worn.unbuilt.length === 1 ? "it declares" : "they declare"} is not known yet`);
		return undefined;
	}

	const docs = [...new Set(hero.roots.filter((root) => !nestedRoot(hero, root)).map((root) => root.dir))]
		.filter((root) => existsSync(root))
		.flatMap((root) => listKbDocs(root))
		.filter((doc) => !/[\\/]\.nosedive[\\/]/.test(doc.path));

	// A plain root is a base now, whose entry is given below.
	const own = new Set(listKinds(hero, ctx.capes).find((group) => group.owner === hero.id)?.kinds.map((kind) => kind.name));
	const used = new Map<string, Doc[]>();
	for (const doc of docs) {
		const root = doc.fm.kind === "root";
		const name = root ? "base" : typeof doc.fm.kind === "string" ? doc.fm.kind : undefined;
		if (!name || own.has(name) || MANAGED.includes(name)) continue;
		if ([...scopeEntries(doc.fm.scopes)].some(([key, entry]) => entry.canonical === true && !(root && key === CORE_OWNER))) continue;
		used.set(name, [...(used.get(name) ?? []), doc]);
	}

	// What each name becomes is settled, and every entry pinned, before anything is written.
	const given = new Map<string, { owner: Owner; pin: { version: string; schema: string } }>();
	const unpinned: string[] = [];
	for (const name of used.keys()) {
		const capes = worn.owners.filter((owner) => name in owner.kinds);
		const structural = STRUCTURAL.includes(name) && core.kinds[name] !== undefined;
		if (!structural && capes.length !== 1) continue;
		const owner: Owner = structural ? { id: CORE_OWNER, name: "core", kinds: core.kinds, repoDir: core.repoDir } : capes[0]!;
		if (structural && capes.length > 0) ctx.out(`canonical-kinds: ${capes.map((each) => each.name).join(", ")} declare${capes.length === 1 ? "s" : ""} ${name}, which is core's, so core's entry was given`);
		const kind = { ...(owner.kinds[name] as object), name, owner: owner.id, repoDir: owner.repoDir, repoDocId: owner.repoDocId } as KindMeta;
		try {
			given.set(name, { owner, pin: pinOf(kind, hero) });
		} catch {
			unpinned.push(`${owner.name}:${name}`);
		}
	}
	if (unpinned.length > 0) {
		ctx.out(`canonical-kinds: waiting for the schema of ${unpinned.join(", ")} to be pushed, since an entry names a published version`);
		return undefined;
	}

	for (const doc of docs.filter((each) => each.fm.kind === "root")) {
		const entries = scopeEntries(doc.fm.scopes);
		const entry = entries.get(CORE_OWNER);
		if (entry?.canonical === true) {
			delete entry.canonical;
			delete entry.version;
			delete entry.schema;
			if (Object.keys(entry).length === 0) entries.delete(CORE_OWNER);
		}
		doc.yaml.set("kind", "base");
		doc.fm.kind = "base";
		setScopes(doc, entries);
		save(doc, changed);
	}

	for (const [name, named] of used) {
		const plural = `${named.length} doc${named.length === 1 ? "" : "s"}`;
		const pinned = given.get(name);
		if (pinned) {
			for (const doc of named) {
				const entries = scopeEntries(doc.fm.scopes);
				entries.set(pinned.owner.id, { ...entries.get(pinned.owner.id), canonical: true, ...pinned.pin });
				setScopes(doc, entries);
				save(doc, changed);
			}
			ctx.out(`canonical-kinds: ${plural} of ${name} now name ${pinned.owner.name} as its owner`);
			continue;
		}
		const capes = worn.owners.filter((owner) => name in owner.kinds);
		if (capes.length > 1) ctx.out(`canonical-kinds: ${name} is declared by more than one cape (${capes.map((each) => each.name).join(", ")}), so it was not given to either`);
		const declared = core.kinds[name] as { schema?: unknown; dropWhen?: string } | undefined;
		changed.add(mintKind(hero, name, named, declared));
		ctx.out(`canonical-kinds: declared kind ${name} here, ${declared ? "as core declares it" : "open"}, for ${plural}${declared ? "" : ": it needs a definition"}`);
	}
	return [...changed];
}

function save(doc: Doc, changed: Set<string>): void {
	writeKbDoc(doc.path, doc.yaml, doc.body);
	changed.add(doc.path);
}

function setScopes(doc: Doc, entries: Map<string, Record<string, unknown>>): void {
	if (entries.size > 0) doc.yaml.set("scopes", [...entries].map(([key, entry]) => ({ [key]: entry })));
	else doc.yaml.delete("scopes");
	doc.fm.scopes = doc.yaml.toJS().scopes;
}

/** The capes the repo wears, each with the kinds its newest build here declares, and those with no such build. */
function wornKinds(hero: Bridge, ctx: MigrationCtx): { owners: Owner[]; unbuilt: string[] } {
	const owners = new Map<string, Owner>();
	for (const cape of ctx.capes.slice(1)) {
		if (cape.owner && cape.owner !== hero.id && cape.owner !== CORE_OWNER) owners.set(cape.owner, { id: cape.owner, name: cape.shortName ?? cape.name, kinds: cape.kinds, repoDir: cape.repoDir });
	}
	const builds = capeManifest(hero.dir);
	const unbuilt = new Set<string>();
	// Every root wears capes of its own, not only the one selected.
	for (const worn of hero.roots.flatMap((root) => wornCapes({ ...hero, activeRoot: root.id }))) {
		const build = builds
			.filter((each) => each.repo === worn.id && each.ref === worn.ref)
			.sort((a, b) => a.builtAt.localeCompare(b.builtAt))
			.at(-1);
		if (!build?.owner || !build.kinds) {
			unbuilt.add(worn.name);
			continue;
		}
		if (build.owner === hero.id || build.owner === CORE_OWNER || owners.has(build.owner)) continue;
		const clones = [build.source, hero.workspace ? join(hero.workspace, worn.name) : undefined, join(hero.dir, ".nosedive", "capes", "src", worn.id)];
		owners.set(build.owner, { id: build.owner, name: build.shortName ?? worn.name, kinds: build.kinds, repoDir: clones.find((each) => each !== undefined && existsSync(each)), repoDocId: worn.id });
	}
	return { owners: [...owners.values()], unbuilt: [...unbuilt] };
}

/**
 * Declares a kind of this name in the repo's `.nosedive/kinds/`: as core declares it when `declared` says how, its Drop when copied
 * when core's has one, else open, asking the pilot to define it, and with a Drop when that says so, which keeps it not durable. Returns its path.
 */
function mintKind(hero: Bridge, name: string, named: Doc[], declared?: { schema?: unknown; dropWhen?: string }): string {
	const seen = new Map<string, unknown>();
	for (const doc of named) {
		const meta = doc.fm.meta;
		if (meta === null || typeof meta !== "object" || Array.isArray(meta)) continue;
		for (const [field, value] of Object.entries(meta)) if (!seen.has(field)) seen.set(field, value);
	}
	const minted = mintKbDoc(hero.kindsDir!, { kind: "kind", name, gist: `Found in use by the canonical-kinds migration, and ${declared ? "copied from core" : "not yet defined"}`, meta: { schema: declared ? declared.schema : { type: "object" } } });
	// Core's durable kinds say no Drop when; one not yet defined is passing work until the pilot says otherwise.
	const dropWhen = declared ? declared.dropWhen : "Not yet defined: ask the pilot.";
	const fields = seen.size > 0 ? [...seen].map(([field, value]) => `- \`${field}\`: \`${sample(value)}\``).join("\n") : "No doc of it carries meta.";
	const text = readFileSync(minted.path, "utf8");
	writeFileSync(minted.path, `${text}\nThe canonical-kinds migration found docs of kind ${name} in this repo and no kind declaring it, so it declared this one, ${declared ? "as core declares it" : "with an open schema"}, to keep them valid. Pilot: say what ${name} is for${declared ? "." : ", and close its schema."}\n\n## Meta seen in use\n\n${fields}\n${dropWhen === undefined ? "" : `\n## Drop when\n\n${dropWhen}\n`}`);
	return minted.path;
}

function sample(value: unknown): string {
	const text = JSON.stringify(value) ?? String(value);
	return text.length > 60 ? `${text.slice(0, 59)}…` : text;
}
