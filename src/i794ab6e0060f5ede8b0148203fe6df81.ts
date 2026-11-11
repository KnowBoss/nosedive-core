import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a14717207d7277a493c7adb10ed32f as splitTitle } from "./i01a14717207d7277a493c7adb10ed32f.ts";
import { i01a14717221479ddbcac26cce4b2a059 as updateKbDocBody } from "./i01a14717221479ddbcac26cce4b2a059.ts";

/**
 * Writes the section a heading names in a doc's body.
 *
 * The heading is found in any case, and the section is added at the end of the body when the doc lacks it. An empty source removes the section, its subsections with it.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param heading The section's `##` heading.
 * @param source The section's text, read from its source.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i794ab6e0060f5ede8b0148203fe6df81(edit: KbEdit, quid: string, heading: string, source: string): void {
	if (!heading.trim()) throw new Error("--section takes a heading");
	writeSection(edit, quid, [heading.trim()], source);
}

/** A `--section:<path>` path, its headings parent first: `dropped.<id>` is `### <id>` under `## Dropped`. */
export function sectionPath(path: string): string[] {
	const headings = path.split(".").map((heading) => heading.trim());
	if (headings.some((heading) => !heading)) throw new Error(`--section:${path} names an empty heading`);
	return headings;
}

/** Writes the section at `path`, `##` first and one level deeper each step, making each heading it lacks; an empty source removes the last. */
export function writeSection(edit: KbEdit, quid: string, path: string[], source: string): void {
	const text = source.trim();
	updateKbDocBody(edit, quid, (body) => {
		const split = splitTitle(body);
		if (!split) throw new Error(`${quid} has no title: set one with \`nosedive crud ${quid} --title <title>\` first`);
		let lines = split.under.split("\n");
		let [from, to] = [0, lines.length];
		for (const [depth, heading] of path.entries()) {
			const last = depth === path.length - 1;
			const hashes = "#".repeat(depth + 2);
			let start = find(lines, from, to, hashes, heading);
			if (start === -1) {
				if (!text) throw new Error(`${quid} has no ${path.map((each, at) => `${"#".repeat(at + 2)} ${each}`).join(" > ")} section to remove`);
				lines = [...lines.slice(0, to), "", `${hashes} ${heading}`, "", ...lines.slice(to)];
				start = to + 1;
				to += 3;
			}
			const end = endOf(lines, start, to, depth + 2);
			if (last) {
				// A section is all under its heading, its subsections too: written or removed whole.
				const section = text ? ["", `${hashes} ${heading}`, "", text, ""] : [];
				lines = [...lines.slice(0, start), ...section, ...lines.slice(end)];
			} else [from, to] = [start + 1, end];
		}
		const under = lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
		return `\n# ${split.title}\n${under ? `\n${under}\n` : ""}`;
	});
}

/** All under the section at `path` in a body, trimmed; undefined when it has none. */
export function readSection(body: string, path: string[]): string | undefined {
	const lines = (splitTitle(body)?.under ?? body).split("\n");
	let [from, to] = [0, lines.length];
	for (const [depth, heading] of path.entries()) {
		const start = find(lines, from, to, "#".repeat(depth + 2), heading);
		if (start === -1) return undefined;
		[from, to] = [start + 1, endOf(lines, start, to, depth + 2)];
	}
	return lines.slice(from, to).join("\n").trim();
}

/** A heading is found in any case, so `dropped.<id>` finds `## Dropped`; one made is spelled as given. */
function find(lines: string[], from: number, to: number, hashes: string, heading: string): number {
	const wanted = `${hashes} ${heading}`.toLowerCase();
	for (let index = from; index < to; index += 1) if (lines[index]!.trimEnd().toLowerCase() === wanted) return index;
	return -1;
}

/** Where the section begun at `start` ends: the next heading of its level or shallower, within `to`. */
function endOf(lines: string[], start: number, to: number, level: number): number {
	for (let index = start + 1; index < to; index += 1) {
		const match = /^(#{1,6}) /.exec(lines[index]!);
		if (match && match[1]!.length <= level) return index;
	}
	return to;
}
