import { parse } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i3ac641d4a9d757a48df1f1de031be120 as editMeta } from "./i3ac641d4a9d757a48df1f1de031be120.ts";
import { ia2855cb936b2597b8666125991f0d31a as editSections } from "./ia2855cb936b2597b8666125991f0d31a.ts";

/**
 * Sets values in a doc's meta by dot path, and writes sections, in one edit.
 *
 * Each value is read as YAML, a null removing the key, and merged as `--meta` does; each section text is written as `--section:<path>` does.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param meta Each dot path to the value as typed.
 * @param sections Each section path to its text.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i4566acc2e53a5c9cb2f745468d21fa5b(edit: KbEdit, quid: string, meta: Record<string, string>, sections: Record<string, string>, ctx: Ctx): void {
	editMeta(edit, quid, keyedMeta(meta), ctx);
	editSections(edit, quid, sections);
}

/** The merge patch `--meta:<path> <value>` flags make: each value read as YAML at its dot path, null removing it. */
export function keyedMeta(meta: Record<string, string>): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	for (const [path, value] of Object.entries(meta)) {
		const keys = path.split(".");
		if (keys.some((key) => !key)) throw new Error(`--meta:${path} names an empty key`);
		let at = patch;
		for (const key of keys.slice(0, -1)) {
			const next = at[key];
			at = at[key] = next !== null && typeof next === "object" && !Array.isArray(next) ? (next as Record<string, unknown>) : {};
		}
		at[keys.at(-1)!] = parse(value) ?? null;
	}
	return patch;
}
