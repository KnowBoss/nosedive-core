import { Ajv2020 } from "ajv/dist/2020.js";
import type { Bridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";
import { i01a13354845c7253a55b60bba87285d8 as findDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";

/** Returns a warning when nothing declares the kind; throws when the meta breaks its schema. */
export function i01a138b2b8ef7e8097e19d599ba39bcc(kind: string, meta: unknown, kbDirs: string[], capes: Cape[], hero?: Bridge, pending?: ReadonlyMap<string, string>): string | undefined {
	const schema = findKind(kind, kbDirs, capes, hero)?.schema;
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
			if (pending?.has(quid)) return pending.get(quid) === expected;
			for (const kb of kbDirs) {
				const doc = findDoc(kb, quid);
				if (doc) return doc.fm.kind === expected;
			}
			const doc = hero ? locateDoc(hero, quid) : undefined;
			if (doc) return doc.fm.kind === expected;
			for (const cape of capes) {
				if (cape.docs?.[quid]) return cape.docs[quid]!.kind === expected;
			}
			return false;
		},
	});
	const validate = ajv.compile(schema as object);
	if (validate(meta ?? {})) return undefined;
	const problems = (validate.errors ?? []).map((error) => `${error.instancePath || "meta"} ${error.message}`);
	throw new Error(`meta does not fit kind ${kind}:\n  ${problems.join("\n  ")}`);
}
