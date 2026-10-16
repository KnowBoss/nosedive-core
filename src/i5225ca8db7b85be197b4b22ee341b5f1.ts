import type { Ctx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a1335485c67c95b7efdf2f0e03cfd6 as findBridge } from "./i01a1335485c67c95b7efdf2f0e03cfd6.ts";
import { i01a133588bcc7f8bae725ff70d8f6800 as updateKbDocField } from "./i01a133588bcc7f8bae725ff70d8f6800.ts";
import { i01a138b2b8ef7e8097e19d599ba39bcc as checkMeta } from "./i01a138b2b8ef7e8097e19d599ba39bcc.ts";

export async function i5225ca8db7b85be197b4b22ee341b5f1(quid: string, kind: string, ctx: Ctx): Promise<void> {
	const bridgeKb = findBridge(ctx.cwd)?.kbDir;
	const path = updateKbDocField(ctx.cwd, quid, "kind", (_kind, doc) => {
		const warning = checkMeta(kind, doc.fm.meta, [doc.kbDir, ...(bridgeKb ? [bridgeKb] : [])], ctx.capes);
		if (warning) ctx.err(`nosedive: ${warning}`);
		return kind;
	});
	ctx.out(path);
}
