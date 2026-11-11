import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { i01a13354867d7a528cbad55b80708e50 as mergePatch } from "./i01a13354867d7a528cbad55b80708e50.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { kindOfDoc, pinOf } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

/**
 * Merges a mapping into a doc's meta.
 *
 * The keys merge onto the doc's meta, and a null removes one. The result is checked against the schema of the doc's kind, and a mismatch is a warning on stderr. A doc held by no seeded repo keeps the meta in a scope entry for its kind instead of in its own.
 *
 * @param edit The edit this change is made in, which the caller commits.
 * @param quid The doc to change: its quid, or a path ending `<quid>.md`.
 * @param patch The mapping, read from its source.
 * @param ctx Where it runs, and how it reads and prints.
 * @returns Nothing; the change is in the edit.
 * @nosedive-feat 01a1336b-c0b8-7cde-b7c6-285196062297
 */
export function i3ac641d4a9d757a48df1f1de031be120(edit: KbEdit, quid: string, patch: unknown, ctx: Ctx): void {
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--meta takes a mapping");
	const doc = edit.doc(quid);
	edit.unchecked?.add(doc);
	const { identity, terms, capes, spelling, kind } = kindOfDoc(doc, edit.bridge, ctx.capes);
	if (!kind) {
		throw new Error(`the kind ${spelling} of ${quid} is not declared where the doc is read; the hero can declare one of that name`);
	}
	const check = (as: string, meta: unknown) => {
		const warning = edit.unchecked ? undefined : checkMeta(as, meta, terms, capes);
		if (warning) ctx.err(`nosedive: ${warning}`);
	};

	if (identity.owner !== undefined) {
		const next = mergePatch(doc.fm.meta ?? {}, patch);
		check(spelling, next);
		set(doc, "meta", next);
	} else {
		const entries = scopeEntries(doc.fm.scopes);
		const entry = entries.get(terms.id!) ?? {};
		const meta = mergePatch(entry.meta ?? {}, patch);
		check(spelling, meta);
		const pin = pinOf(kind, edit.bridge);
		if (meta !== null && typeof meta === "object" && Object.keys(meta).length > 0) entries.set(terms.id!, { ...entry, ...pin, meta });
		else {
			const { meta: _meta, version: _version, schema: _schema, ...rest } = entry;
			if (Object.keys(rest).length > 0) entries.set(terms.id!, rest);
			else entries.delete(terms.id!);
		}
		set(doc, "scopes", entries.size > 0 ? [...entries].map(([key, value]) => ({ [key]: value })) : undefined);
	}
	edit.change(doc);
}

/** Sets a field of the doc, or removes it when it is left empty. */
function set(doc: ReturnType<KbEdit["doc"]>, field: string, value: unknown): void {
	if (value === undefined || value === null || (typeof value === "object" && Object.keys(value).length === 0)) {
		doc.yaml.delete(field);
		delete doc.fm[field];
	} else {
		doc.yaml.set(field, value);
		doc.fm[field] = value;
	}
}
