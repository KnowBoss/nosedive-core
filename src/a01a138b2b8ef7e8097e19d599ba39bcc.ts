import { Ajv2020 } from "ajv/dist/2020.js";
import type { Cape } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a13354850c7ba3ba5b8ac41a7b6b11 as listKbDocs } from "./a01a13354850c7ba3ba5b8ac41a7b6b11.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false });

/** Returns a warning when nothing declares the kind; throws when the meta breaks its schema. */
export function a01a138b2b8ef7e8097e19d599ba39bcc(kind: string, meta: unknown, kbDirs: string[], capes: Cape[]): string | undefined {
	const schema = declared(kind, kbDirs, capes);
	if (schema === undefined) return `no kind ${kind} is declared here; its meta is not checked`;
	const validate = ajv.compile(schema as object);
	if (validate(meta ?? {})) return undefined;
	const problems = (validate.errors ?? []).map((error) => `${error.instancePath || "meta"} ${error.message}`);
	throw new Error(`meta does not fit kind ${kind}:\n  ${problems.join("\n  ")}`);
}

function declared(kind: string, kbDirs: string[], capes: Cape[]): unknown {
	for (const kbDir of kbDirs) {
		const doc = listKbDocs(kbDir).find((candidate) => candidate.fm.kind === "kind" && candidate.fm.name === kind);
		if (doc) return (doc.fm.meta as { schema?: unknown } | undefined)?.schema;
	}
	for (const cape of capes) if (cape.kinds?.[kind] !== undefined) return cape.kinds[kind];
	return undefined;
}
