const GATE = /^pass --([a-z0-9][a-z0-9-]*) <([a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)?)>(?= |$)/;
const HOOK = /^(before|after) (crud) ([a-z0-9][a-z0-9-]*(?::[a-z0-9][a-z0-9-]*)?)$/;

/**
 * `kind` is undefined when the usage takes any doc, as `<quid>`; else it is spelled as crud takes a kind: bare for the declaring cape's own.
 * A hook gate, `before crud <kind>` or `after crud <kind>`, says `when` (see crud-gates).
 */
export function i01a14fb092177d36a478d40a47166c97(usage: string): { sect: string; kind: string | undefined; when?: "before" | "after" } | undefined {
	const hook = HOOK.exec(usage);
	if (hook) return { sect: hook[2]!, kind: hook[3], when: hook[1] as "before" | "after" };
	const match = GATE.exec(usage);
	if (!match) return undefined;
	return { sect: match[1]!, kind: match[2] === "quid" ? undefined : match[2] };
}
