import { existsSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { Ctx } from "./a01a1336a958f71c7beec4db3195c7966.ts";
import { a01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./a01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { a01a1335480c776ba8945020d0af333eb as mintUuid } from "./a01a1335480c776ba8945020d0af333eb.ts";
import { a01a13354894273b1be253424511ba82c as commitFiles } from "./a01a13354894273b1be253424511ba82c.ts";
import { a01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./a01a138b2b8ed775297973c2aad478c8f.ts";
import { a01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./a01a138b2b8ef7e8097e19d599ba39bcc.ts";

export async function i8a86ae5e03195d5192c64052d558b6fd(
	doc: { repo: string | undefined; kind: string; gist: string; name: string | undefined },
	ctx: Ctx,
): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const target = doc.repo ? workspaceRepo(bridge, doc.repo) : { dir: bridge.dir, kbDir: bridge.kbDir };
	const warning = checkMeta(doc.kind, {}, [target.kbDir, bridge.kbDir], ctx.capes);
	if (warning) ctx.err(`nosedive: ${warning}`);
	const id = mintUuid();
	const name = doc.name ?? slugName(doc.gist, id);
	const path = join(target.kbDir, `${id}.md`);
	if (existsSync(path)) throw new Error(`${path} already exists`);
	// A JSON string is a valid YAML scalar, whatever the gist holds.
	writeFileSync(path, `---\nkind: ${doc.kind}\nid: ${id}\nname: ${name}\ngist: ${JSON.stringify(doc.gist)}\n---\n\n# ${doc.gist}\n`);
	commitFiles(target.dir, [path], `crud(${id}): created ${doc.kind} ${name}`);
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
