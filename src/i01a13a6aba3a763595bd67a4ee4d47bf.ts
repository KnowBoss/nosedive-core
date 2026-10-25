import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

export function i01a13a6aba3a763595bd67a4ee4d47bf(dir: string, kind?: string) {
	const bridge = readRepoConfig(dir);
	for (const root of bridge?.roots ?? []) {
		const doc = findKbDoc(root.dir, root.id);
		if (doc && (kind === undefined || doc.fm.kind === kind)) return { ...doc, kind: String(doc.fm.kind), bridge: bridge! };
	}
	return undefined;
}
