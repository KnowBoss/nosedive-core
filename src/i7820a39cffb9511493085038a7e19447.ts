import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "./i01a133588b1f7d4ea13f1b5e79f02e4c.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

/**
 * Merges a mapping into a doc's scopes.
 *
 * The entries are keyed by repo: a value merges onto its key's entry, a new key is appended, and a null removes the entry. A scope that carries a kind is refused, since its kind is the root's.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param patch The mapping, read from its source.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i7820a39cffb9511493085038a7e19447(edit: KbEdit, quid: string, patch: unknown): void {
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--scopes takes a mapping");
	updateKbDocField(edit, quid, "scopes", (scopes) => {
		const next = mergeKeyedEntries(scopes, patch as Record<string, unknown>);
		for (const [key, entry] of scopeEntries(next)) if ("kind" in entry) throw new Error(`scope ${key} carries no kind: its kind is the root's`);
		return next;
	});
}
