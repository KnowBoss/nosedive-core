import { relative } from "node:path";
import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a13354894273b1be253424511ba82c as commitFiles } from "./i01a13354894273b1be253424511ba82c.ts";
import { i01a138b2b8ed775297973c2aad478c8f as workspaceRepo } from "./i01a138b2b8ed775297973c2aad478c8f.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";
import { i01a141f869c07c4da8288927a559c8ae as mintKbDoc } from "./i01a141f869c07c4da8288927a559c8ae.ts";

export async function i6c9390d5a8e5583881960839391345db(
	doc: { repo: string | undefined; kind: string; gist: string; name: string | undefined; meta: string | undefined },
	ctx: Ctx,
): Promise<void> {
	const bridge = findBridge(ctx.cwd);
	if (!bridge) throw new Error("not in a bridge: run `nosedive seed` first");
	const target = doc.repo ? workspaceRepo(bridge, doc.repo) : { dir: bridge.dir, kbDir: bridge.kbDir };
	const meta = doc.meta === undefined ? {} : await readSource(doc.meta, ctx);
	if (meta === null || typeof meta !== "object" || Array.isArray(meta)) throw new Error("--meta takes a mapping");
	const warning = checkMeta(doc.kind, meta, [target.kbDir, bridge.kbDir], ctx.capes);
	if (warning) ctx.err(`nosedive: ${warning}`);
	const minted = mintKbDoc(target.kbDir, { kind: doc.kind, gist: doc.gist, name: doc.name, meta: meta as Record<string, unknown> });
	commitFiles(target.dir, [minted.path], `crud(${minted.id}): created ${doc.kind} ${minted.name}`);
	ctx.out(relative(bridge.dir, minted.path).replace(/\\/g, "/"));
}
