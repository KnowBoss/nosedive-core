import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

/**
 * Sets a doc's title, the heading that opens its body.
 *
 * The rest of the body is kept.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param title The new title; an empty one is refused.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i933f159845875010ad6ed3569414a651(edit: KbEdit, quid: string, title: string): void {
	if (!title.trim()) throw new Error("--title takes a title");
	updateKbDocBody(edit, quid, (body) => {
		const under = splitTitle(body)?.under ?? body;
		return `\n# ${title.trim()}\n${under.trim() ? `\n${under.trim()}\n` : ""}`;
	});
}
