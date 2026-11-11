import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a1471723807d6e8ef228ad9472fff7 as readText } from "./i01a1471723807d6e8ef228ad9472fff7.ts";
import { sectionPath, writeSection } from "./i794ab6e0060f5ede8b0148203fe6df81.ts";

/**
 * Writes the sections that dot paths name in a doc's body.
 *
 * In a path `a.b`, `b` is a `###` section under the `##` section `a`; each heading the doc lacks is made, and an empty text removes the last section.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param sections Each section path to its text.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function ia2855cb936b2597b8666125991f0d31a(edit: KbEdit, quid: string, sections: Record<string, string>): void {
	for (const [path, text] of Object.entries(sections)) writeSection(edit, quid, sectionPath(path), text);
}

/** Reads each `--section:<path> <source>`'s source, and refuses more than one from stdin, `--meta -` counted (`stdin`). */
export async function readSections(sections: Record<string, string>, ctx: Ctx, stdin = 0): Promise<Record<string, string>> {
	const sources = Object.values(sections);
	if (sources.filter((source) => source === "-").length + stdin > 1) throw new Error("only one source can be read from stdin");
	const texts: Record<string, string> = {};
	for (const [path, source] of Object.entries(sections)) texts[path] = await readText(source, ctx);
	return texts;
}
