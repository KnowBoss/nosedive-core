import { parse } from "yaml";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i3ac641d4a9d757a48df1f1de031be120 as editMeta } from "./i3ac641d4a9d757a48df1f1de031be120.ts";
import { ia2855cb936b2597b8666125991f0d31a as editSections } from "./ia2855cb936b2597b8666125991f0d31a.ts";

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
