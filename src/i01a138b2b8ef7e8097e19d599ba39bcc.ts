import { Ajv2020 } from "ajv/dist/2020.js";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind, kindOfDoc } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";
import { scopeEntries, type DocKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

/**
 * Returns a warning when nothing declares the kind; throws when the meta breaks its schema.
 * `kind` is spelled in the terms of `hero`; `pending` holds the kinds docs are about to have.
 */
export function i01a138b2b8ef7e8097e19d599ba39bcc(kind: string, meta: unknown, hero: Bridge, capes: Cape[], pending?: ReadonlyMap<string, DocKind>): string | undefined {
	const schema = findKind(kind, hero, capes)?.schema;
	if (schema === undefined) return `no kind ${kind} is declared here; its meta is not checked`;
	// Each validation owns its resolver, so one hero's refs cannot leak into another.
	const ajv = new Ajv2020({ allErrors: true, strict: false });
	ajv.addKeyword({
		keyword: "kind",
		type: "string",
		schemaType: "string",
		metaSchema: { type: "string", minLength: 1 },
		errors: false,
		error: { message: "must resolve to a doc of the declared kind" },
		validate(expected: string, given: string) {
			if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(given)) return false;
			// Docs are named by lowercase quids, which a case-sensitive filesystem tells apart.
			const quid = given.toLowerCase();
			const wanted = findKind(expected, hero, capes);
			const name = wanted?.name ?? expected.slice(expected.lastIndexOf(":") + 1);
			const is = (found: DocKind) => found.name === name && (!wanted || found.owner === wanted.owner);
			if (pending?.has(quid)) return is(pending.get(quid)!);
			const doc = locateDoc(hero, quid);
			if (doc) return is(kindOfDoc(doc, hero, capes).identity);
			for (const cape of capes) {
				if (cape.docs?.[quid]) return cape.docs[quid]!.kind === name;
			}
			return false;
		},
	});
	const validate = ajv.compile(schema as object);
	if (validate(meta ?? {})) return undefined;
	const problems = (validate.errors ?? []).map((error) => `${error.instancePath || "meta"} ${error.message}`);
	throw new Error(`meta does not fit kind ${kind}:\n  ${problems.join("\n  ")}`);
}

/**
 * Checks the meta of a doc and of each scope entry that has one, each against its kind in the terms the doc is read in:
 * the root's kind for the doc's meta, and for an entry's the root's kind name as its key's owner declares it. Returns the warnings.
 */
export function checkDocMeta(doc: { fm: Record<string, unknown>; path: string; repoDir: string }, hero: Bridge, capes: Cape[], pending?: ReadonlyMap<string, DocKind>): string[] {
	const { identity, terms, capes: read, spelling } = kindOfDoc(doc, hero, capes);
	const warnings = [i01a138b2b8ef7e8097e19d599ba39bcc(spelling, doc.fm.meta, terms, read, pending)];
	for (const [key, entry] of scopeEntries(doc.fm.scopes)) {
		if (entry.meta !== undefined) warnings.push(i01a138b2b8ef7e8097e19d599ba39bcc(`${key}:${identity.name}`, entry.meta, terms, read, pending));
	}
	return warnings.filter((warning) => warning !== undefined);
}
