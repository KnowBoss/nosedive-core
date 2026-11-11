import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

/**
 * Sets a doc's gist.
 *
 * A gist is the one line that says what the doc is.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param gist The new gist; an empty one is refused.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i7713e1ddd9c454948ec7f940be7ffe6f(edit: KbEdit, quid: string, gist: string): void {
	if (!gist.trim()) throw new Error("--gist takes a gist");
	updateKbDocField(edit, quid, "gist", () => gist.trim());
}
