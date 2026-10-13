import { relative } from "node:path";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a13354845c7253a55b60bba87285d8 as findKbDoc } from "./a01a13354845c7253a55b60bba87285d8.ts";
import { a01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./a01a1335483aa776cb84df698b04adc06.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";

/** Returns the doc's path relative to the bridge. */
export function a01a133588bcc7f8bae725ff70d8f6800(
	cwd: string,
	id: string,
	field: string,
	update: (current: unknown) => unknown,
): string {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const doc = findKbDoc(bridge.kbDir, id);
	if (!doc) throw new Error(`no doc ${id} in ${bridge.kbDir}`);
	const next = update(doc.fm[field]);
	const empty = next === undefined || next === null || (typeof next === "object" && Object.keys(next).length === 0);
	if (empty) doc.yaml.delete(field);
	else doc.yaml.set(field, next);
	writeKbDoc(doc.path, doc.yaml, doc.body);
	commitFiles(bridge.dir, [doc.path], `crud(${id}): updated ${String(doc.fm.kind)} ${String(doc.fm.name)}`);
	return relative(bridge.dir, doc.path).replace(/\\/g, "/");
}
