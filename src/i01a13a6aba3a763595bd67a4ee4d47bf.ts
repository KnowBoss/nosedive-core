import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { nestedRoot } from "./i01a1934563e77ed886f06d04416385ef.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";
import { CORE_OWNER, i01a18e2a3b4b798d98068d4778a158e6 as docKind } from "./i01a18e2a3b4b798d98068d4778a158e6.ts";

/** `kind` names one of core's kinds; the `kind` it returns is the root's own name, qualified by its owner when core is not. */
export function i01a13a6aba3a763595bd67a4ee4d47bf(dir: string, kind?: string) {
	const bridge = readRepoConfig(dir);
	for (const root of bridge?.roots ?? []) {
		// A local cape's root is its cape's, never the hero's.
		if (nestedRoot(bridge!, root)) continue;
		const doc = findKbDoc(root.dir, root.id);
		if (!doc) continue;
		const identity = docKind(doc, bridge!.id);
		if (kind !== undefined && (identity.owner !== CORE_OWNER || identity.name !== kind)) continue;
		return { ...doc, kind: identity.owner === CORE_OWNER ? identity.name : `${identity.owner}:${identity.name}`, bridge: bridge! };
	}
	return undefined;
}
