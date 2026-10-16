import { relative } from "node:path";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./i01a1335483aa776cb84df698b04adc06.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ee703cab227b010f588b6a as locateKbDoc } from "./i01a138b2b8ee703cab227b010f588b6a.ts";

/** Returns the doc's path relative to the bridge. `update` may throw to refuse the change. */
export function i01a14717221479ddbcac26cce4b2a059(
	cwd: string,
	id: string,
	update: (body: string, doc: { fm: Record<string, unknown> }) => string,
): string {
	const bridge = findBridge(cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const doc = locateKbDoc(bridge, id);
	if (!doc) throw new Error(`no doc ${id} in the bridge or its workspace`);
	writeKbDoc(doc.path, doc.yaml, update(doc.body, doc));
	commitFiles(doc.repoDir, [doc.path], `crud(${id}): updated ${String(doc.fm.kind)} ${String(doc.fm.name)}`);
	return relative(bridge.dir, doc.path).replace(/\\/g, "/");
}
