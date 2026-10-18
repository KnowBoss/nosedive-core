import type { GateCtx } from "./i01a1336a958f71c7beec4db3195c7966.ts";
import { i01a138b2b8f175bc95242dc33d92138b as runRepoTests } from "./i01a138b2b8f175bc95242dc33d92138b.ts";

export async function ie912ca03bb41549d86d709f98260400c(ctx: GateCtx): Promise<void> {
	runRepoTests({ core: ctx.core, repoDir: ctx.doc.repoDir, bridgeDir: ctx.bridge.dir, out: ctx.out });
}
