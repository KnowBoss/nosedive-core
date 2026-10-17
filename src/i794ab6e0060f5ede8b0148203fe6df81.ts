import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

export function i794ab6e0060f5ede8b0148203fe6df81(edit: KbEdit, quid: string, heading: string, source: string): void {
	if (!heading.trim()) throw new Error("--section takes a heading");
	const text = source.trim();
	updateKbDocBody(edit, quid, (body) => {
		const split = splitTitle(body);
		if (!split) throw new Error(`${quid} has no title: set one with \`nosedive crud ${quid} --title <title>\` first`);
		const lines = split.under.split("\n");
		const start = lines.findIndex((line) => line.trimEnd() === `## ${heading.trim()}`);
		if (start === -1 && !text) throw new Error(`${quid} has no ## ${heading.trim()} section to remove`);
		const section = text ? ["", `## ${heading.trim()}`, "", text, ""] : [];
		let end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
		if (end === -1) end = lines.length;
		const next = start === -1 ? [...lines, ...section] : [...lines.slice(0, start), ...section, ...lines.slice(end)];
		const under = next.join("\n").replace(/\n{3,}/g, "\n\n").trim();
		return `\n# ${split.title}\n${under ? `\n${under}\n` : ""}`;
	});
}
