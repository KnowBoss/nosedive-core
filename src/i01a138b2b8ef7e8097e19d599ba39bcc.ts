import { Ajv2020 } from "ajv/dist/2020.js";
import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a147171f057d019118aaa1f269f5fd as findKind } from "./i01a147171f057d019118aaa1f269f5fd.ts";

const ajv = new Ajv2020({ allErrors: true, strict: false });

/** Returns a warning when nothing declares the kind; throws when the meta breaks its schema. */
export function i01a138b2b8ef7e8097e19d599ba39bcc(kind: string, meta: unknown, kbDirs: string[], capes: Cape[]): string | undefined {
	const schema = findKind(kind, kbDirs, capes)?.schema;
	if (schema === undefined) return `no kind ${kind} is declared here; its meta is not checked`;
	const validate = ajv.compile(schema as object);
	if (validate(meta ?? {})) return undefined;
	const problems = (validate.errors ?? []).map((error) => `${error.instancePath || "meta"} ${error.message}`);
	throw new Error(`meta does not fit kind ${kind}:\n  ${problems.join("\n  ")}`);
}
