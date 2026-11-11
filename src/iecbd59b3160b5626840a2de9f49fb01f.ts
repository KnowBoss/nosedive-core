import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

/**
 * Replaces a doc's body under its title.
 *
 * A source that opens with a `# ` heading sets the title too, and the rest is the body; otherwise the doc keeps its title, and one with no title is refused.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param text The source's text.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function iecbd59b3160b5626840a2de9f49fb01f(edit: KbEdit, quid: string, text: string): void {
	const whole = splitTitle(text);
	updateKbDocBody(edit, quid, (body) => {
		const title = whole?.title ?? splitTitle(body)?.title;
		if (!title) throw new Error(`${quid} has no title: set one with \`nosedive crud ${quid} --title <title>\` first`);
		const under = (whole ? whole.under : text).trim();
		return `\n# ${title}\n${under ? `\n${under}\n` : ""}`;
	});
}
