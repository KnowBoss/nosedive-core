import type { Cape } from "./i01a1336a958f71c7beec4db3195c7966.ts";

/** Each action two capes both provide, or a cape provides that core has already; empty when none clash. */
export function i01a141fbba027b2684d5b1c1879d9337(core: Cape, capes: { name: string; actions: Record<string, string> }[]): string[] {
	const owners = new Map<string, string[]>();
	for (const doc of Object.values(core.docs)) if (doc.kind === "action") owners.set(doc.name, ["core"]);
	for (const cape of capes) for (const action of Object.keys(cape.actions)) owners.set(action, [...(owners.get(action) ?? []), cape.name]);
	return [...owners]
		.filter(([, names]) => names.length > 1)
		.map(([action, names]) => `${action} is provided by ${names.join(" and ")}`);
}
