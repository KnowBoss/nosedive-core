import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588b1f7d4ea13f1b5e79f02e4c as mergeKeyedEntries } from "./i01a133588b1f7d4ea13f1b5e79f02e4c.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

/**
 * Merges a mapping into a doc's links.
 *
 * The keys are link targets, a doc of another repo keyed `<repo>:<path>`: a value merges onto its key's entry, a new key is appended, and a null removes the link. A link the kb's durable-link rule forbids is refused when the edit is committed.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param patch The mapping, read from its source.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i21be7cc759fb5c758e11cffdb2630902(edit: KbEdit, quid: string, patch: unknown): void {
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--links takes a mapping");
	updateKbDocField(edit, quid, "links", (links) => mergeKeyedEntries(links, patch as Record<string, unknown>));
}
