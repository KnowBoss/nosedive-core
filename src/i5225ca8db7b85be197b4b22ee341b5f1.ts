import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import type { KbEdit } from "./i01a14ab1d36771eea2bc6f13bdeb0526.ts";
import { checkDocMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { assertPublished, i01a147171f057d019118aaa1f269f5fd as findKind, kindOfDoc, undeclaredKind, unknownKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { scopeEntries } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

export function i5225ca8db7b85be197b4b22ee341b5f1(edit: KbEdit, quid: string, kind: string, ctx: Ctx): void {
	if (!/^([a-z0-9][a-z0-9.-]*:)?[a-z0-9][a-z0-9.-]*$/.test(kind)) throw new Error(`--kind must be lowercase letters, digits, dots and dashes, after its owner and a colon if it is not this repo's: ${kind}`);
	const doc = edit.doc(quid);
	edit.unchecked?.add(doc);
	const { terms, capes } = kindOfDoc(doc, edit.bridge, ctx.capes);
	const found = findKind(kind, terms, capes);
	if (!found) throw kind.includes(":") ? unknownKind(kind, terms, capes) : undeclaredKind(kind, terms, capes);

	// The doc names its kind's owner in its canonical scope, if the owner is not the repo that holds it.
	const entries = scopeEntries(doc.fm.scopes);
	for (const [key, entry] of entries) {
		if (entry.canonical !== true) continue;
		delete entry.canonical;
		if (entry.meta === undefined) delete entry.version;
		if (Object.keys(entry).length === 0) entries.delete(key);
	}
	if (found.owner !== readRepoConfig(doc.repoDir)?.id) entries.set(found.owner, { ...entries.get(found.owner), canonical: true, version: assertPublished(found, edit.bridge) });

	const name = found.name;
	doc.yaml.set("kind", name);
	doc.fm.kind = name;
	if (entries.size > 0) doc.yaml.set("scopes", [...entries].map(([key, entry]) => ({ [key]: entry })));
	else doc.yaml.delete("scopes");
	doc.fm.scopes = doc.yaml.toJS().scopes;
	edit.change(doc);
	if (!edit.unchecked) for (const warning of checkDocMeta(doc, edit.bridge, ctx.capes)) ctx.err(`nosedive: ${warning}`);
}
