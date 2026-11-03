import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { kindVersion, onTrunk, schemaDigest } from "./i01a1335487e477549d84a6fc2c901bf6.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { i01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./i01a13354850c7ba3ba5b8ac41a7b6b11.ts";
import { i01a18e2a3b4b798d98068d4778a158e6 as docKind, type DocKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";
import { i01a18e40518e7f15a2066909dca2be43 as listKinds } from "./i01a18e40518e7f15a2066909dca2be43.ts";

/** A kind's meta, with its links, which name the gates its docs pass through, and who owns it. */
export type KindMeta = {
	schema?: unknown;
	/** The first line of its doc's `## Done when` section, empty when the section is; absent when the doc has none, which makes the kind durable. */
	doneWhen?: string;
	/** Rels by which a walked doc linking a doc of this kind makes `next` list it. */
	next?: string[];
	links?: unknown;
	id?: string;
	name: string;
	/** The seeded id of the repo that declares it. */
	owner: string;
	/** The last commit that changed its schema; asked of git when a build did not record it. */
	version?: string;
	/** Whether that commit was on its owner's origin trunk when a build recorded it. */
	published?: boolean;
	/** A digest of its schema as a build recorded it. */
	digest?: string;
	/** Its doc, from the root of the repo it is declared in. */
	file?: string;
	repoDir?: string;
	/** The doc that registers that repo with the repo asked, which a feat's scope names a work branch for. */
	repoDocId?: string;
};

/**
 * Whether docs of a kind are kept, not passing work: a kind is durable when its doc does not say when one of it is done, in a
 * `## Done when` section. A doc whose kind nothing declares is never durable.
 */
export function isDurable(kind: KindMeta | undefined): boolean {
	return kind !== undefined && kind.doneWhen === undefined;
}

/**
 * The kind a spelling names in a repo's terms: a bare name is the repo's own kind, and `<short>:<name>`, `<long>:<name>` or
 * `<quid>:<name>` is a kind of a cape it wears, core first. Nothing else is looked at, and a name two capes answer to names nothing.
 */
export function i01a147171f057d019118aaa1f269f5fd(spelling: string, hero: Bridge, capes: Cape[]): KindMeta | undefined {
	const groups = listKinds(hero, capes);
	const split = spelling.lastIndexOf(":");
	const name = spelling.slice(split + 1);
	// A repo's own id reaches its own kinds, as any other owner's does.
	if (split !== -1 && spelling.slice(0, split) === hero.id) return groups.find((group) => group.owner === hero.id)?.kinds.find((kind) => kind.name === name)?.meta;
	const found = groups.flatMap((group) => group.kinds).filter((kind) => kind.spellings.includes(spelling));
	return found.length === 1 ? found[0]!.meta : undefined;
}

/** Why a spelling names no kind, with the spellings that name a kind of that name. */
export function unknownKind(spelling: string, hero: Bridge, capes: Cape[]): Error {
	const name = spelling.slice(spelling.lastIndexOf(":") + 1);
	const reach = listKinds(hero, capes).flatMap((group) => group.kinds.filter((kind) => kind.name === name).map((kind) => kind.spellings.join(", ") || `${name} (no unambiguous spelling)`));
	return new Error(`${spelling} names no kind${reach.length > 0 ? `; ${name} is reached as ${reach.join(" and ")}` : ": `nosedive crud` lists the kinds there are"}`);
}

/** Why a bare kind the repo does not declare cannot be written, with the spellings of any cape's kind of that name. */
export function undeclaredKind(kind: string, hero: Bridge, capes: Cape[]): Error {
	const reach = listKinds(hero, capes).flatMap((group) => group.kinds.filter((each) => each.name === kind).flatMap((each) => each.spellings));
	return new Error(`no kind ${kind} is declared here, and a bare kind is the repo's own: the hero can declare one of that name${reach.length > 0 ? `; ${kind} is declared as ${reach.join(", ")}` : ""}`);
}

/**
 * What a doc's kind is in the terms it is read in: its holding repo's when that is seeded, as `crud` reads a doc in a workspace
 * checkout, else the repo acting. `kind` is that kind's declaration, if the terms have one.
 */
export function kindOfDoc(doc: { fm: Record<string, unknown>; path: string; repoDir: string }, hero: Bridge, capes: Cape[]) {
	const holder = readRepoConfig(doc.repoDir);
	const identity = docKind(doc, holder?.id);
	const seeded = holder !== undefined && holder.dir !== hero.dir;
	const terms = seeded ? holder : hero;
	// A holder is read with core, which is all its own checkout can be sure of.
	const termsCapes = seeded ? capes.slice(0, 1) : capes;
	const spelling = identity.owner === undefined || identity.owner === terms.id ? identity.name : `${identity.owner}:${identity.name}`;
	return { identity, terms, capes: termsCapes, spelling, kind: i01a147171f057d019118aaa1f269f5fd(spelling, terms, termsCapes) };
}

/** How an identity is spelled in a repo's terms. */
export function spellingOf(identity: DocKind, terms: Bridge): string {
	return identity.owner === undefined || identity.owner === terms.id ? identity.name : `${identity.owner}:${identity.name}`;
}

/** The last commit that changed the kind's schema; undefined when the schema as it stands is not committed. */
export function versionOf(kind: KindMeta): string | undefined {
	if (kind.version) return kind.version;
	if (!kind.repoDir || !kind.file) return undefined;
	return kindVersion(kind.repoDir, kind.file, kind.schema);
}

/** The digest of the kind's schema, which a scope entry keeps beside the version. */
export function digestOf(kind: KindMeta): string {
	return kind.digest ?? schemaDigest(kind.schema);
}

/** What a scope entry records of the kind it names: the published version, and the digest of the schema it was written against. */
export function pinOf(kind: KindMeta, hero: Pick<Bridge, "roots">): { version: string; schema: string } {
	return { version: assertPublished(kind, hero), schema: digestOf(kind) };
}

/** Whether the kind's owner has its git history here, which is better evidence than what a build recorded. */
function hasHistory(dir: string | undefined): dir is string {
	if (!dir || !existsSync(dir)) return false;
	const top = spawnSync("git", ["rev-parse", "--show-cdup"], { cwd: dir, encoding: "utf8" });
	return top.status === 0 && top.stdout.trim() === "";
}

/** Refuses a kind whose schema commit is on neither its owner's origin trunk nor a work branch a feat names for that owner; returns the commit. */
export function assertPublished(kind: KindMeta, hero: Pick<Bridge, "roots">): string {
	const version = versionOf(kind);
	const where = kind.repoDir;
	const refuse = () => new Error(`the schema of kind ${kind.name} is not on its owner's origin trunk or a feat's work branch: land or push it first`);
	if (!version) throw refuse();
	// A build's word is for a hero that has no history to ask; with it, the history decides.
	if (!hasHistory(where)) {
		if (kind.published) return version;
		throw refuse();
	}
	if (onTrunk(where, version)) return version;
	// A feat's scope names the work branch of each repo it works in, by that repo's doc.
	for (const root of hero.roots) {
		for (const doc of listKbDocs(root.dir)) {
			const scopes = Array.isArray(doc.fm.scopes) ? (doc.fm.scopes as Record<string, { "work-branch"?: unknown } | null>[]) : [];
			for (const scope of scopes) {
				const branch = kind.repoDocId ? scope?.[kind.repoDocId]?.["work-branch"] : undefined;
				if (typeof branch === "string" && spawnSync("git", ["merge-base", "--is-ancestor", version, `refs/remotes/origin/${branch}`], { cwd: where }).status === 0) return version;
			}
		}
	}
	throw refuse();
}
