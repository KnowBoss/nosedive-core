import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

/** Each text loses one trailing newline, which a file almost always ends with. */
export function ie9dc0e8d57db5875868f19e35aa40379(edit: KbEdit, quid: string, oldText: string, newText: string): void {
	const old = oldText.replace(/\r?\n$/, "");
	const replacement = newText.replace(/\r?\n$/, "");
	if (!old) throw new Error("--replace takes text to replace");
	updateKbDocBody(edit, quid, (body) => {
		const split = splitTitle(body);
		if (!split) throw new Error(`${quid} has no title: set one with \`nosedive crud ${quid} --title <title>\` first`);
		const found = split.under.split(old).length - 1;
		if (found !== 1) throw new Error(`--replace found its text ${found === 0 ? "nowhere" : `${found} times`} under ${quid}'s title; it replaces one place`);
		return body.slice(0, body.length - split.under.length) + split.under.replace(old, () => replacement);
	});
}
