import { existsSync } from "node:fs";
import { join, relative } from "node:path";
import { Document } from "yaml";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";
import { a01a1335483aa776cb84df698b04adc06 as writeKbDoc } from "./a01a1335483aa776cb84df698b04adc06.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";

export async function i8a86ae5e03195d5192c64052d558b6fd(
	doc: { kind: string; gist: string; name: string | undefined },
	ctx: Ctx,
): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const id = mintUuid();
	const name = doc.name ?? slugName(doc.gist, id);
	const path = join(bridge.kbDir, `${id}.md`);
	if (existsSync(path)) throw new Error(`${path} already exists`);
	writeKbDoc(path, new Document({ kind: doc.kind, id, name, gist: doc.gist }), `\n# ${doc.gist}\n`);
	commitFiles(bridge.dir, [path], `crud(${id}): created ${doc.kind} ${name}`);
	ctx.out(relative(bridge.dir, path).replace(/\\/g, "/"));
}

/** The gist's first words, slugged, then the id's last six characters so names stay unique. */
function slugName(gist: string, id: string): string {
	const words = gist
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(" ")
		.filter(Boolean)
		.slice(0, 6);
	return [...words, id.slice(-6)].join("-");
}
