import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

export function iecbd59b3160b5626840a2de9f49fb01f(edit: KbEdit, quid: string, text: string): void {
	updateKbDocBody(edit, quid, (body) => {
		const split = splitTitle(body);
		if (!split) throw new Error(`${quid} has no title: set one with \`nosedive crud ${quid} --title <title>\` first`);
		return `\n# ${split.title}\n${text.trim() ? `\n${text.trim()}\n` : ""}`;
	});
}
