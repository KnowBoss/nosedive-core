import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a1335487317576a0afd03506ef5555 as readSource } from "./i01a1335487317576a0afd03506ef5555.ts";
import { i01a13354867d7a528cbad55b80708e50 as mergePatch } from "./i01a13354867d7a528cbad55b80708e50.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";

export async function i3ac641d4a9d757a48df1f1de031be120(quid: string, source: string, ctx: Ctx): Promise<void> {
	const patch = await readSource(source, ctx);
	if (patch === null || typeof patch !== "object" || Array.isArray(patch)) throw new Error("--meta takes a mapping");
	const bridgeKb = findBridge(ctx.cwd)?.kbDir;
	const path = updateKbDocField(ctx.cwd, quid, "meta", (meta, doc) => {
		const next = mergePatch(meta ?? {}, patch);
		const warning = checkMeta(String(doc.fm.kind), next, [doc.kbDir, ...(bridgeKb ? [bridgeKb] : [])], ctx.capes);
		if (warning) ctx.err(`nosedive: ${warning}`);
		return next;
	});
	ctx.out(path);
}
