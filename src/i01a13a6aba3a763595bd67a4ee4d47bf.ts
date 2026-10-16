import { i01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./i01a13354845c7253a55b60bba87285d8.ts";
import { i01a13dee4b1d78f7a699c3777bf63587 as readRepoConfig } from "./i01a13dee4b1d78f7a699c3777bf63587.ts";

export function i01a13a6aba3a763595bd67a4ee4d47bf(dir: string) {
	const bridge = readRepoConfig(dir);
	if (!bridge?.root) return undefined;
	const doc = findKbDoc(bridge.kbDir, bridge.root);
	return doc ? { ...doc, kind: String(doc.fm.kind), bridge } : undefined;
}
