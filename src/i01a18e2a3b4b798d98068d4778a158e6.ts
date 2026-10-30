import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

/** Core's seeded id, the owner of the kinds it declares. */
export const CORE_OWNER = "01a1336b-c0b8-7cde-b7c6-285196062297";

/** `owner` is undefined for a doc in a repo that is not seeded. */
export type DocKind = { owner: string | undefined; name: string };

/** A doc's scopes by key; a key repeated, or an entry that is no mapping, is refused. */
export function scopeEntries(scopes: unknown): Map<string, Record<string, unknown>> {
	const entries = new Map<string, Record<string, unknown>>();
	if (scopes === undefined || scopes === null) return entries;
	if (!Array.isArray(scopes)) throw new Error("scopes must be a list of keyed entries");
	for (const item of scopes) {
		if (item === null || typeof item !== "object" || Array.isArray(item)) throw new Error("each of scopes is a mapping from a key to its entry");
		for (const [key, entry] of Object.entries(item)) {
			if (entries.has(key)) throw new Error(`scopes repeat the key ${key}`);
			if (entry === null || typeof entry !== "object" || Array.isArray(entry)) throw new Error(`scope ${key} must be a mapping`);
			entries.set(key, entry as Record<string, unknown>);
		}
	}
	return entries;
}

/**
 * `holder` is the id of the seeded repo the doc is in, found from its path when not given.
 * Managed kinds and repos are core's by their place, whatever their `kind` says.
 */
export function i01a18e2a3b4b798d98068d4778a158e6(doc: { fm: Record<string, unknown>; path: string }, holder?: string): DocKind {
	const place = resolve(doc.path).replace(/\\/g, "/");
	if (/\/\.nosedive\/kinds\/[^/]+$/.test(place)) return { owner: CORE_OWNER, name: "kind" };
	if (/\/\.nosedive\/repos\/[^/]+$/.test(place)) return { owner: CORE_OWNER, name: "repo" };
	const canonical = [...scopeEntries(doc.fm.scopes)].filter(([, entry]) => entry.canonical === true).map(([key]) => key);
	if (canonical.length > 1) throw new Error(`${doc.path} has more than one canonical scope: ${canonical.join(" and ")}`);
	return { owner: canonical[0] ?? holder ?? holdingRepo(doc.path)?.id, name: String(doc.fm.kind) };
}

/** The seeded repo whose git checkout holds a path; a repo that is not seeded holds nothing, even inside a hero's workspace. */
function holdingRepo(path: string) {
	for (let dir = dirname(resolve(path)); ; dir = dirname(dir)) {
		if (existsSync(resolve(dir, ".git"))) return readRepoConfig(dir);
		if (dirname(dir) === dir) return undefined;
	}
}
