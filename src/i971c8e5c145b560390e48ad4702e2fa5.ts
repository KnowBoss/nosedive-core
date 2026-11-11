import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";

/**
 * Sets a doc's name.
 *
 * A name holds lowercase letters, digits, dots and dashes.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param name The new name.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i971c8e5c145b560390e48ad4702e2fa5(edit: KbEdit, quid: string, name: string): void {
	if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) throw new Error(`--name must be lowercase letters, digits, dots and dashes: ${name}`);
	updateKbDocField(edit, quid, "name", () => name);
}
