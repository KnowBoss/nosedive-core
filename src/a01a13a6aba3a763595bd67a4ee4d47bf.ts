import { existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./a01a13354845c7253a55b60bba87285d8.ts";

export function a01a13a6aba3a763595bd67a4ee4d47bf(dir: string) {
	if (!existsSync(join(dir, ".nosedive", "config.yaml"))) return undefined;
	const bridge = findBridge(dir);
	if (!bridge || resolve(bridge.dir) !== resolve(dir) || !bridge.root) return undefined;
	const doc = findKbDoc(bridge.kbDir, bridge.root);
	return doc ? { ...doc, kind: String(doc.fm.kind), bridge } : undefined;
}
